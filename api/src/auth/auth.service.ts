import { HttpStatus, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { Mailer } from '../mail/mailer';
import { VerificationService } from '../mail/verification.service';
import type { LoginInput, PasswordInput, PasswordResetInput, SignupInput } from './auth.dto';
import { JwtService } from './jwt.service';

interface UserRow {
  id: number;
  email: string;
  password: string;
  nickname: string;
  twoFactorEnabled: boolean;
}

const SELECT_USER = 'SELECT id, email, password, nickname, two_factor_enabled AS "twoFactorEnabled" FROM users';

export const userResponse = (u: UserRow) => ({ id: u.id, email: u.email, nickname: u.nickname, twoFactorEnabled: u.twoFactorEnabled });

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
  async signup(input: SignupInput) {
    const email = normalize(input.email);
    const nickname = input.nickname.trim();
    if (await this.db.one('SELECT 1 FROM users WHERE email = $1', [email])) throw ApiError.conflict('이미 가입된 이메일이에요');
    if (await this.db.one('SELECT 1 FROM users WHERE nickname = $1', [nickname])) throw ApiError.conflict('이미 사용 중인 닉네임이에요');
    // 닉네임 중복 같은 다른 문제를 먼저 알려 주고, 번호는 마지막에 확인해서 쓴다
    await this.verification.verify(email, 'SIGNUP', input.code);
    const user = await this.db.one<UserRow>(
      `INSERT INTO users (email, password, nickname) VALUES ($1, $2, $3)
       RETURNING id, email, password, nickname, two_factor_enabled AS "twoFactorEnabled"`,
      [email, await bcrypt.hash(input.password, 10), nickname],
    );
    return this.toAuth(user!);
  }

  /** 비밀번호가 맞으면 토큰을 준다. 2단계 인증이 켜져 있으면 대신 이메일로 번호를 보내고 challenge 를 준다 */
  async login(input: LoginInput) {
    const user = await this.db.one<UserRow>(`${SELECT_USER} WHERE email = $1`, [normalize(input.email)]);
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, '이메일 또는 비밀번호가 맞지 않아요');
    }
    if (user.twoFactorEnabled) {
      const challenge = await this.verification.send(user.email, 'LOGIN', user.id);
      return { twoFactorRequired: true, challenge, maskedEmail: mask(user.email) };
    }
    return { ...this.toAuth(user), twoFactorRequired: false };
  }

  /** 2단계 인증 로그인: 이메일로 받은 번호 확인 */
  async verifyLogin(challenge: string, code: string) {
    return this.toAuth(await this.find(await this.verification.verifyChallenge('LOGIN', challenge, code)));
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
    await this.mailer.sendNotice(
      user.email,
      '비밀번호가 바뀌었어요',
      '방금 비밀번호 재설정으로 루프 계정의 비밀번호가 바뀌었어요.\n직접 바꾼 것이 아니라면 바로 비밀번호를 다시 재설정하고 2단계 인증을 켜 주세요.',
    );
  }

  async me(userId: number) {
    return userResponse(await this.find(userId));
  }

  /** 닉네임은 토큰에도 들어 있으므로 새 토큰을 함께 돌려준다 */
  async updateProfile(userId: number, rawNickname: string) {
    const user = await this.find(userId);
    const nickname = rawNickname.trim();
    if (nickname !== user.nickname && (await this.db.one('SELECT 1 FROM users WHERE nickname = $1', [nickname]))) {
      throw ApiError.conflict('이미 사용 중인 닉네임이에요');
    }
    await this.db.execute('UPDATE users SET nickname = $1 WHERE id = $2', [nickname, userId]);
    return this.toAuth({ ...user, nickname });
  }

  async changePassword(userId: number, input: PasswordInput) {
    const user = await this.find(userId);
    if (!(await bcrypt.compare(input.currentPassword, user.password))) throw ApiError.badRequest('지금 비밀번호가 맞지 않아요');
    if (input.currentPassword === input.newPassword) throw ApiError.badRequest('지금 비밀번호와 다른 비밀번호를 입력해 주세요');
    await this.db.execute('UPDATE users SET password = $1 WHERE id = $2', [await bcrypt.hash(input.newPassword, 10), userId]);
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

  private toAuth(user: UserRow) {
    return { token: this.jwt.issue(user.id, user.nickname), user: userResponse(user) };
  }
}
