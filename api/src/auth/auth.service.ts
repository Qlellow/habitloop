import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { Mailer } from '../mail/mailer';
import { VerificationService } from '../mail/verification.service';
import type { LoginInput, PasswordInput, PasswordResetInput, SignupInput } from './auth.dto';
import { describeDevice } from './device';
import { JwtService, type AuthUser } from './jwt.service';

interface UserRow {
  id: number;
  email: string;
  password: string;
  nickname: string;
  twoFactorEnabled: boolean;
  /** 생년월일로 나이를 확인했는지 · 만 19세 이상인지 */
  ageChecked?: boolean;
  adult?: boolean;
  birthDate?: string | null;
}

const USER_COLUMNS = `id, email, password, nickname, two_factor_enabled AS "twoFactorEnabled",
  birth_date IS NOT NULL AS "ageChecked", to_char(birth_date, 'YYYY-MM-DD') AS "birthDate", coalesce(birth_date <= (current_date - interval '19 years'), false) AS adult`;
const SELECT_USER = `SELECT ${USER_COLUMNS} FROM users`;

export const userResponse = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  nickname: u.nickname,
  twoFactorEnabled: u.twoFactorEnabled,
  ageChecked: !!u.ageChecked,
  adult: !!u.adult,
  birthDate: u.birthDate ?? undefined,
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
    return this.toAuth(user!, userAgent);
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
    await this.db.execute('UPDATE users SET password = $1 WHERE id = $2', [await bcrypt.hash(input.newPassword, 10), user.id]);
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
    await this.db.execute('UPDATE users SET password = $1 WHERE id = $2', [await bcrypt.hash(input.newPassword, 10), userId]);
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
