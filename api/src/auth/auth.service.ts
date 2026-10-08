import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { ApiError } from '../common/api-error';
import { clamp, cursorPage } from '../common/cursor-page';
import { Database } from '../db/database';
import { Mailer } from '../mail/mailer';
import { VerificationService } from '../mail/verification.service';
import { ChannelsService } from '../channels/channels.service';
import { RewardsService } from '../users/rewards.service';
import type { LoginInput, PasswordInput, PasswordResetInput, SignupInput } from './auth.dto';
import { describeDevice } from './device';
import { JwtService, type AuthUser } from './jwt.service';

interface UserRow {
  id: number;
  uid: string;
  email: string;
  password: string;
  nickname: string;
  twoFactorEnabled: boolean;
  /** 생년월일로 나이를 확인했는지 · 만 19세 이상인지 */
  ageChecked?: boolean;
  adult?: boolean;
  /** 관리자가 이용을 정지했는지 */
  suspended?: boolean;
  birthDate?: string | null;
  avatarUrl?: string | null;
  banner?: string | null;
  points?: number;
  customBanner?: boolean;
}

/** 기본 배너 (누구나 무료). 화면에서 쓰는 색은 @loop/shared 의 BANNER_PRESETS */
export const BANNER_PRESETS = ['sky', 'sunset', 'mint', 'grape', 'peach', 'night', 'forest', 'mono'];
/** 커스텀 배너를 여는 데 드는 포인트 (한 번 열면 계속 바꿀 수 있다) */
export const CUSTOM_BANNER_COST = 300;

const USER_COLUMNS = `id, uid::text AS uid, email, password, nickname, two_factor_enabled AS "twoFactorEnabled",
  birth_date IS NOT NULL AS "ageChecked", to_char(birth_date, 'YYYY-MM-DD') AS "birthDate",
  CASE WHEN avatar_id IS NULL THEN NULL ELSE '/api/images/' || avatar_id END AS "avatarUrl", banner, points,
  custom_banner AS "customBanner", coalesce(birth_date <= (current_date - interval '19 years'), false) AS adult,
  suspended_at IS NOT NULL AS suspended`;
const SELECT_USER = `SELECT ${USER_COLUMNS} FROM users`;

export const userResponse = (u: UserRow) => ({
  // 바깥에는 UUID 만 보인다 (내부 정수 id 는 숨김)
  id: u.uid,
  email: u.email,
  nickname: u.nickname,
  twoFactorEnabled: u.twoFactorEnabled,
  ageChecked: !!u.ageChecked,
  adult: !!u.adult,
  birthDate: u.birthDate ?? undefined,
  avatarUrl: u.avatarUrl ?? undefined,
  banner: u.banner ?? undefined,
  points: u.points ?? 0,
  customBanner: !!u.customBanner,
});

const normalize = (email: string) => email.trim().toLowerCase();

/** someone123@example.com → so******23@example.com */
export function mask(email: string): string {
  const at = email.indexOf('@');
  if (at <= 2) return `${email[0]}***${email.slice(Math.max(at, 0))}`;
  const local = email.slice(0, at);
  if (local.length <= 4) return local[0] + '*'.repeat(local.length - 1) + email.slice(at);
  return local.slice(0, 2) + '*'.repeat(local.length - 4) + local.slice(-2) + email.slice(at);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly verification: VerificationService,
    private readonly mailer: Mailer,
    private readonly rewards: RewardsService,
    private readonly channels: ChannelsService,
  ) {}

  /** 회원가입 1단계: 이메일로 인증번호 보내기 */
  async sendSignupCode(rawEmail: string) {
    const email = normalize(rawEmail);
    if (await this.db.one('SELECT 1 FROM users WHERE email = $1', [email])) throw ApiError.conflict('이미 가입된 이메일이에요');
    await this.verification.send(email, 'SIGNUP', null);
  }

  /** 닉네임을 쓸 수 있는지 (2~20자, 아직 아무도 안 쓰는지) */
  async nicknameAvailable(raw: string) {
    const nickname = String(raw ?? '').trim();
    if (nickname.length < 2 || nickname.length > 20) return { available: false, reason: '닉네임은 2~20자로 정해 주세요' };
    const taken = !!(await this.db.one('SELECT 1 FROM users WHERE nickname = $1', [nickname]));
    return taken ? { available: false, reason: '이미 사용 중인 닉네임이에요' } : { available: true };
  }

  /** 회원가입 2단계: 받은 번호가 맞으면 계정을 만든다 */
  async signup(input: SignupInput, userAgent = '') {
    const email = normalize(input.email);
    const nickname = input.nickname.trim();
    if (await this.db.one('SELECT 1 FROM users WHERE email = $1', [email])) throw ApiError.conflict('이미 가입된 이메일이에요');
    if (await this.db.one('SELECT 1 FROM users WHERE nickname = $1', [nickname])) throw ApiError.conflict('이미 사용 중인 닉네임이에요');
    // 닉네임 중복 같은 다른 문제를 먼저 알려 주고, 번호는 마지막에 확인해서 쓴다
    await this.verification.verify(email, 'SIGNUP', input.code);
    const user = await this.db.one<UserRow>(
      `INSERT INTO users (email, password, nickname) VALUES ($1, $2, $3)
       RETURNING ${USER_COLUMNS}`,
      [email, await bcrypt.hash(input.password, 10), nickname],
    );
    // 초대 코드로 가입했으면 초대한 사람과 나 모두 포인트
    await this.rewards.signedUp(user!.id, input.ref);
    return this.toAuth(await this.find(user!.id), userAgent);
  }

  /** 비밀번호가 맞으면 토큰을 준다. 2단계 인증이 켜져 있으면 대신 이메일로 번호를 보내고 challenge 를 준다 */
  async login(input: LoginInput, userAgent = '') {
    const user = await this.db.one<UserRow>(`${SELECT_USER} WHERE email = $1`, [normalize(input.email)]);
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, '이메일 또는 비밀번호가 맞지 않아요');
    }
    if (user.twoFactorEnabled) {
      const challenge = await this.verification.send(user.email, 'LOGIN', user.id);
      return { twoFactorRequired: true, challenge, maskedEmail: mask(user.email) };
    }
    return { ...(await this.toAuth(user, userAgent)), twoFactorRequired: false };
  }

  /**
   * 소셜 로그인으로 확인된 사용자. 2단계 인증을 켰으면 비밀번호 로그인과 똑같이 이메일 번호를 한 번 더 받는다
   * (내부용 주소로 가입한 소셜 계정은 2단계 인증을 켤 수 없으니 해당 없음)
   */
  async socialLogin(userId: number, userAgent = '') {
    const user = await this.find(userId);
    if (user.twoFactorEnabled) {
      const challenge = await this.verification.send(user.email, 'LOGIN', user.id);
      return { twoFactorRequired: true as const, challenge, maskedEmail: mask(user.email) };
    }
    return { ...(await this.toAuth(user, userAgent)), twoFactorRequired: false as const };
  }

  /** 2단계 인증 로그인: 이메일로 받은 번호 확인 */
  async verifyLogin(challenge: string, code: string, userAgent = '') {
    return this.toAuth(await this.find(await this.verification.verifyChallenge('LOGIN', challenge, code)), userAgent);
  }

  async resendLoginCode(challenge: string) {
    return { challenge: await this.verification.resendChallenge('LOGIN', challenge) };
  }

  /**
   * 비밀번호 재설정 1단계: 가입한 이메일로 인증번호를 보낸다.
   * 2단계 인증을 켰는지와 상관없이 항상 이메일 인증을 거친다 (이메일만 알면 남의 비밀번호를 바꿀 수 있으면 안 된다)
   */
  async sendPasswordResetCode(rawEmail: string) {
    const user = await this.db.one<UserRow>(`${SELECT_USER} WHERE email = $1`, [normalize(rawEmail)]);
    if (!user) throw ApiError.notFound('가입된 이메일이 아니에요');
    const challenge = await this.verification.send(user.email, 'PASSWORD_RESET', user.id);
    return { challenge: challenge!, maskedEmail: mask(user.email) };
  }

  async resendPasswordResetCode(challenge: string) {
    return { challenge: await this.verification.resendChallenge('PASSWORD_RESET', challenge) };
  }

  /** 비밀번호 재설정 2단계: 번호가 맞으면 새 비밀번호를 정할 때 쓸 토큰을 준다 (10분 유효, 한 번만) */
  async verifyPasswordResetCode(challenge: string, code: string) {
    const user = await this.find(await this.verification.verifyChallenge('PASSWORD_RESET', challenge, code));
    return { resetToken: this.jwt.issueReset(user.id, user.password) };
  }

  /** 비밀번호 재설정 3단계: 새 비밀번호로 바꾸고 알림 메일을 보낸다 */
  async resetPassword(input: PasswordResetInput) {
    const expired = () => ApiError.badRequest('재설정 시간이 지났어요. 처음부터 다시 시도해 주세요');
    const claims = this.jwt.parseReset(input.resetToken);
    if (!claims) throw expired();
    const user = await this.db.one<UserRow>(`${SELECT_USER} WHERE id = $1`, [claims.id]);
    // 이미 이 토큰으로 바꿨거나 그사이 비밀번호가 바뀌었으면 다시 쓸 수 없다
    if (!user || !this.jwt.matchesPassword(claims.pv, user.password)) throw expired();
    if (await bcrypt.compare(input.newPassword, user.password)) throw ApiError.badRequest('지금 비밀번호와 다른 비밀번호를 입력해 주세요');
    await this.db.execute('UPDATE users SET password = $1, has_password = TRUE WHERE id = $2', [await bcrypt.hash(input.newPassword, 10), user.id]);
    // 비밀번호를 잊어서 바꾼 것이므로 로그인돼 있던 모든 기기를 로그아웃한다 (훔친 토큰도 함께 막힌다)
    await this.db.execute('DELETE FROM sessions WHERE user_id = $1', [user.id]);
    await this.mailer.sendNotice(
      user.email,
      '비밀번호가 바뀌었어요',
      '방금 비밀번호 재설정으로 루프 계정의 비밀번호가 바뀌었고, 로그인돼 있던 모든 기기에서 로그아웃했어요.\n직접 바꾼 것이 아니라면 바로 비밀번호를 다시 재설정하고 2단계 인증을 켜 주세요.',
    );
  }

  async me(userId: number) {
    return userResponse(await this.find(userId));
  }

  /** 닉네임은 토큰에도 들어 있으므로 새 토큰을 함께 돌려준다 (같은 기기 세션을 그대로 쓴다) */
  async updateProfile(me: AuthUser, rawNickname: string) {
    const userId = me.id;
    const user = await this.find(userId);
    const nickname = rawNickname.trim();
    if (nickname !== user.nickname && (await this.db.one('SELECT 1 FROM users WHERE nickname = $1', [nickname]))) {
      throw ApiError.conflict('이미 사용 중인 닉네임이에요');
    }
    await this.db.execute('UPDATE users SET nickname = $1 WHERE id = $2', [nickname, userId]);
    const { token } = this.jwt.issue(userId, nickname, me.sid);
    return { token, user: userResponse({ ...user, nickname }) };
  }

  /** 비밀번호를 바꾸면 지금 기기만 남기고 다른 기기는 모두 로그아웃한다 */
  async changePassword(me: AuthUser, input: PasswordInput) {
    const userId = me.id;
    const user = await this.find(userId);
    if (!(await bcrypt.compare(input.currentPassword, user.password))) throw ApiError.badRequest('지금 비밀번호가 맞지 않아요');
    if (input.currentPassword === input.newPassword) throw ApiError.badRequest('지금 비밀번호와 다른 비밀번호를 입력해 주세요');
    await this.db.execute('UPDATE users SET password = $1, has_password = TRUE WHERE id = $2', [await bcrypt.hash(input.newPassword, 10), userId]);
    await this.db.execute('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [userId, me.sid]);
  }

  /** 로그아웃: 이 기기의 세션만 지운다. 이 토큰은 바로 못 쓰게 되고 다른 기기는 그대로다 */
  async logout(me: AuthUser | undefined) {
    if (me) await this.db.execute('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [me.sid, me.id]);
  }

  /** 로그인한 기기 목록 (최근에 쓴 순) */
  async sessions(me: AuthUser) {
    const rows = await this.db.query<{ id: string; userAgent: string; createdAt: Date; lastUsedAt: Date }>(
      `SELECT id, user_agent AS "userAgent", created_at AS "createdAt", last_used_at AS "lastUsedAt" FROM sessions
       WHERE user_id = $1 AND expires_at > now() ORDER BY (id = $2) DESC, last_used_at DESC`,
      [me.id, me.sid],
    );
    return rows.map((r) => ({
      id: r.id,
      device: describeDevice(r.userAgent),
      createdAt: new Date(r.createdAt).toISOString(),
      lastUsedAt: new Date(r.lastUsedAt).toISOString(),
      current: r.id === me.sid,
    }));
  }

  /** 다른 기기 하나 로그아웃 */
  async revokeSession(me: AuthUser, id: string) {
    const removed = await this.db.execute('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [id, me.id]);
    if (!removed) throw ApiError.notFound('이미 로그아웃된 기기예요');
  }

  /** 지금 기기만 남기고 모두 로그아웃 */
  async revokeOtherSessions(me: AuthUser) {
    await this.db.execute('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [me.id, me.sid]);
  }

  /**
   * 나이 확인: 생년월일을 저장한다. 만 19세 이상이면 19세 이상 채널·카테고리를 볼 수 있다.
   * 지금은 테스트 중이라 다시 바꿀 수 있다 (실서비스에서는 한 번만 저장하게 막을 것)
   * 지금은 본인이 입력한 생년월일로 확인한다 (휴대폰 본인인증 같은 외부 인증은 붙이지 않았다)
   */
  async verifyAge(userId: number, birthDate: string) {
    await this.find(userId);
    const d = new Date(`${birthDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== birthDate) {
      throw ApiError.badRequest('생년월일을 YYYY-MM-DD 로 입력해 주세요');
    }
    if (d.getUTCFullYear() < 1900 || d.getTime() > Date.now()) throw ApiError.badRequest('생년월일을 다시 확인해 주세요');
    await this.db.execute('UPDATE users SET birth_date = $1 WHERE id = $2', [birthDate, userId]);
    return userResponse(await this.find(userId));
  }

  /** 내가 올린 이미지인지 (다른 사람 이미지를 내 프로필로 쓸 수 없게) */
  private async requireOwnImage(userId: number, imageId: string) {
    if (!/^[A-Za-z0-9_-]{16,32}$/.test(imageId) || !(await this.db.one('SELECT 1 FROM images WHERE id = $1 AND owner_id = $2', [imageId, userId]))) {
      throw ApiError.badRequest('이미지를 다시 올려 주세요');
    }
  }

  /** 프로필 사진 바꾸기 (null 이면 기본: 닉네임 첫 글자) */
  async setAvatar(userId: number, imageId: string | null) {
    if (imageId) await this.requireOwnImage(userId, imageId);
    await this.db.execute('UPDATE users SET avatar_id = $1 WHERE id = $2', [imageId, userId]);
    return userResponse(await this.find(userId));
  }

  /**
   * 배너: 'p:기본배너' (무료) · 'i:이미지id' (커스텀 배너, 포인트로 연 사람만) · null (배너 없음)
   */
  async setBanner(userId: number, banner: string | null) {
    const user = await this.find(userId);
    if (banner) {
      const [kind, value] = [banner.slice(0, 2), banner.slice(2)];
      if (kind === 'p:') {
        if (!BANNER_PRESETS.includes(value)) throw ApiError.badRequest('없는 배너예요');
      } else if (kind === 'i:') {
        if (!user.customBanner) throw ApiError.forbidden(`커스텀 배너는 ${CUSTOM_BANNER_COST}P 로 연 뒤에 쓸 수 있어요`);
        await this.requireOwnImage(userId, value);
      } else {
        throw ApiError.badRequest('없는 배너예요');
      }
    }
    await this.db.execute('UPDATE users SET banner = $1 WHERE id = $2', [banner, userId]);
    return userResponse(await this.find(userId));
  }

  /** 커스텀 배너 열기: 포인트를 한 번 쓰면 그 뒤로는 자유롭게 바꿀 수 있다 */
  async unlockCustomBanner(userId: number) {
    const user = await this.find(userId);
    if (user.customBanner) return userResponse(user);
    await this.db.transaction(async () => {
      const spent = await this.db.execute(
        'UPDATE users SET points = points - $1, custom_banner = TRUE WHERE id = $2 AND points >= $1 AND NOT custom_banner',
        [CUSTOM_BANNER_COST, userId],
      );
      if (!spent) throw ApiError.badRequest(`포인트가 부족해요 (필요 ${CUSTOM_BANNER_COST}P, 지금 ${user.points ?? 0}P)`);
      await this.db.execute("INSERT INTO point_logs (user_id, delta, reason) VALUES ($1, $2, '커스텀 배너 열기')", [userId, -CUSTOM_BANNER_COST]);
    });
    return userResponse(await this.find(userId));
  }

  /**
   * 포인트 내역 (키셋 페이지네이션). order: latest 최신순 · oldest 오래된순, type: earn 적립만 · spend 사용만
   */
  async pointLogs(userId: number, query: { order?: string; type?: string; cursor?: number; size?: number }) {
    const oldest = query.order === 'oldest';
    const size = clamp(query.size ?? 30, 1, 100);
    const params: unknown[] = [userId, size + 1];
    let where = 'user_id = $1';
    if (query.type === 'earn') where += ' AND delta > 0';
    if (query.type === 'spend') where += ' AND delta < 0';
    if (query.cursor != null) {
      params.push(query.cursor);
      where += oldest ? ' AND id > $3' : ' AND id < $3';
    }
    const rows = await this.db.query<{ id: number }>(
      `SELECT id, delta, reason, created_at AS "createdAt" FROM point_logs WHERE ${where} ORDER BY id ${oldest ? 'ASC' : 'DESC'} LIMIT $2`,
      params,
    );
    return cursorPage(rows, size);
  }

  /** 회원 탈퇴 1단계: 가입한 이메일로 인증번호 보내기 (비밀번호가 없는 소셜 계정도 같은 방법으로 확인) */
  async sendWithdrawCode(userId: number) {
    const user = await this.find(userId);
    await this.verification.send(user.email, 'WITHDRAW', userId);
    return { maskedEmail: mask(user.email) };
  }

  /**
   * 회원 탈퇴 2단계: 번호가 맞으면 개인정보를 지우고 계정을 닫는다.
   * - 글 · 댓글 · 공감은 남기고, 작성자는 '탈퇴한 사용자 ○○○○' 로 보인다 (다른 사람의 대화가 끊기지 않게)
   * - 이메일 · 비밀번호 · 사진 · 배너 · 생일 · 소셜 연결 · 로그인 기기 · 포인트 · 배지 · 출석 · 팔로우 · 북마크 · 알림 · 차단 목록은 지운다
   * - 내가 만든 채널은 관리자 → 매니저 → 팔로워 순(먼저 들어온 사람)으로 넘긴다. 아무도 없으면 주인 없는 채널로 남는다
   * 이메일을 비우므로 같은 이메일로 다시 가입할 수 있다
   */
  async withdraw(userId: number, code: string) {
    const user = await this.find(userId);
    await this.verification.verify(user.email, 'WITHDRAW', code);
    await this.db.transaction(async () => {
      const owned = await this.db.query<{ id: number }>('SELECT id FROM channels WHERE owner_id = $1', [userId]);
      for (const { id } of owned) {
        const heir = await this.db.one<{ userId: number }>(
          `SELECT user_id AS "userId" FROM channel_members WHERE channel_id = $1 AND user_id <> $2
           ORDER BY CASE role WHEN 'ADMIN' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END, joined_at, id LIMIT 1`,
          [id, userId],
        );
        await this.db.execute('UPDATE channels SET owner_id = $1 WHERE id = $2', [heir?.userId ?? null, id]);
        if (heir) await this.db.execute("UPDATE channel_members SET role = 'OWNER' WHERE channel_id = $1 AND user_id = $2", [id, heir.userId]);
      }
      // 팔로우를 끊으면 채널 팔로워 수도 줄인다
      await this.db.execute(
        'UPDATE channels c SET member_count = greatest(c.member_count - 1, 0) FROM channel_members m WHERE m.channel_id = c.id AND m.user_id = $1',
        [userId],
      );
      for (const table of ['channel_members', 'channel_bookmarks', 'user_identities', 'sessions', 'user_badges', 'attendance', 'point_logs', 'notifications']) {
        await this.db.execute(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
      }
      await this.db.execute('DELETE FROM user_blocks WHERE blocker_id = $1', [userId]);
      const tag = randomBytes(2).toString('hex');
      await this.db.execute(
        `UPDATE users SET email = $2, password = $3, has_password = FALSE, nickname = $4, two_factor_enabled = FALSE,
                avatar_id = NULL, banner = NULL, custom_banner = FALSE, birth_date = NULL, points = 0,
                invite_code = upper(substr(md5(random()::text), 1, 8)), withdrawn_at = now()
         WHERE id = $1`,
        [userId, `withdrawn+${userId}@deleted.loop`, await bcrypt.hash(randomBytes(24).toString('base64url'), 10), `탈퇴한 사용자 ${tag}`],
      );
    });
    this.channels.popularCache.clear();
    await this.mailer
      .sendNotice(user.email, '회원 탈퇴가 끝났어요', '그동안 루프와 함께해 주셔서 고마워요.\n작성한 글과 댓글은 남아 있고, 작성자는 \'탈퇴한 사용자\'로 보여요.')
      .catch(() => undefined);
  }

  /** 2단계 인증 켜기 1단계: 내 이메일로 번호 보내기 */
  async sendTwoFactorCode(userId: number) {
    const user = await this.find(userId);
    if (user.twoFactorEnabled) throw ApiError.badRequest('이미 2단계 인증을 쓰고 있어요');
    await this.verification.send(user.email, 'ENABLE_2FA', userId);
  }

  /** 2단계 인증 켜기 2단계: 번호가 맞으면 켜고 알림 메일을 보낸다 */
  async enableTwoFactor(userId: number, code: string) {
    const user = await this.find(userId);
    await this.verification.verify(user.email, 'ENABLE_2FA', code);
    await this.db.execute('UPDATE users SET two_factor_enabled = TRUE WHERE id = $1', [userId]);
    await this.mailer.sendNotice(
      user.email,
      '2단계 인증이 켜졌어요',
      '이제 로그인할 때 비밀번호와 함께 이 이메일로 받은 인증번호를 입력해야 해요.\n직접 켠 것이 아니라면 바로 비밀번호를 바꿔 주세요.',
    );
    return userResponse({ ...user, twoFactorEnabled: true });
  }

  /** 2단계 인증 끄기: 비밀번호를 한 번 더 확인한다 */
  async disableTwoFactor(userId: number, password: string) {
    const user = await this.find(userId);
    if (!(await bcrypt.compare(password, user.password))) throw ApiError.badRequest('비밀번호가 맞지 않아요');
    if (user.twoFactorEnabled) {
      await this.db.execute('UPDATE users SET two_factor_enabled = FALSE WHERE id = $1', [userId]);
      await this.mailer.sendNotice(
        user.email,
        '2단계 인증이 꺼졌어요',
        '이제 비밀번호만으로 로그인할 수 있어요.\n직접 끈 것이 아니라면 바로 비밀번호를 바꾸고 2단계 인증을 다시 켜 주세요.',
      );
    }
    return userResponse({ ...user, twoFactorEnabled: false });
  }

  private async find(userId: number): Promise<UserRow> {
    const user = await this.db.one<UserRow>(`${SELECT_USER} WHERE id = $1`, [userId]);
    if (!user) throw ApiError.unauthorized();
    return user;
  }

  /** 로그인 성공: 이 기기의 세션을 만들고 그 세션 id 가 든 토큰을 준다 */
  private async toAuth(user: UserRow, userAgent: string) {
    // 관리자가 이용을 정지한 계정은 (비밀번호 · 소셜 · 2단계 인증 모두) 로그인할 수 없다
    if (user.suspended) throw ApiError.forbidden('이용이 정지된 계정이에요. 사이트 아래 "문의 남기기"로 알려 주세요');
    const sid = randomBytes(16).toString('base64url');
    const { token, expiresAt } = this.jwt.issue(user.id, user.nickname, sid);
    // 만료된 세션은 로그인할 때 같이 치운다
    await this.db.execute('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()', [user.id]);
    await this.db.execute('INSERT INTO sessions (id, user_id, user_agent, expires_at) VALUES ($1, $2, $3, $4)', [
      sid,
      user.id,
      userAgent.slice(0, 300),
      expiresAt,
    ]);
    return { token, user: userResponse(user) };
  }
}
