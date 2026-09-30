import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { CODE_TTL_MINUTES, Mailer, type CodePurpose } from './mailer';

export const MAX_ATTEMPTS = 5;
const HOURLY_LIMIT = 10;
/** 비밀번호를 확인한 뒤 이 시간 안에만 로그인 인증번호를 다시 받을 수 있다 */
const CHALLENGE_TTL_MS = 30 * 60_000;

interface CodeRow {
  id: number;
  email: string;
  purpose: CodePurpose;
  codeHash: string;
  userId: number | null;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

const SELECT_CODE = `SELECT id, email, purpose, code_hash AS "codeHash", user_id AS "userId", attempts,
  expires_at AS "expiresAt", created_at AS "createdAt" FROM email_codes`;

const hash = (code: string) => createHash('sha256').update(code, 'utf8').digest('hex');

/** 인증번호에 쓰는 글자: 영문 대문자와 1~9 (헷갈리는 0 은 뺀다) */
export const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
export const CODE_LENGTH = 6;
export const CODE_PATTERN = new RegExp(`^[${CODE_CHARS}]{${CODE_LENGTH}}$`);

const newCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
/** 소문자로 입력해도 같은 번호로 본다 (공백도 무시) */
export const normalizeCode = (code: unknown) => String(code ?? '').replace(/\s/g, '').toUpperCase();

/** 번호 입력 화면을 쓰는 용도: 비밀번호(또는 이메일)를 확인한 사람만 challenge 로 번호를 입력할 수 있다 */
const CHALLENGE_PURPOSES: CodePurpose[] = ['LOGIN', 'PASSWORD_RESET'];

const expiredMessage = (purpose: CodePurpose) =>
  purpose === 'PASSWORD_RESET' ? '인증 시간이 지났어요. 처음부터 다시 시도해 주세요' : '인증 시간이 지났어요. 다시 로그인해 주세요';

/**
 * 이메일 인증번호 발급과 확인.
 * - 영문 대문자·숫자(1~9) 6자리, 5분 유효, 해시만 저장
 * - 5번 틀리면 폐기 (다시 받아야 한다), 재발송은 60초 간격 · 한 시간에 10번까지
 * - 다 쓴 번호는 지우지 않고 만료시킨다 (한 시간 발송 횟수를 세는 데 쓴다). 하루 지난 기록은 보낼 때 정리한다
 */
@Injectable()
export class VerificationService {
  private readonly resendIntervalMs = Number(process.env.MAIL_RESEND_INTERVAL_SECONDS ?? 60) * 1000;

  constructor(
    private readonly db: Database,
    private readonly mailer: Mailer,
  ) {}

  /** 인증번호를 만들어 메일로 보낸다. 로그인·비밀번호 재설정용이면 번호 입력 화면에서 쓸 일회용 challenge 를 돌려준다 */
  async send(email: string, purpose: CodePurpose, userId: number | null): Promise<string | undefined> {
    const now = Date.now();
    const last = await this.db.one<CodeRow>(`${SELECT_CODE} WHERE email = $1 AND purpose = $2 ORDER BY id DESC LIMIT 1`, [email, purpose]);
    if (last) {
      const wait = Math.ceil((this.resendIntervalMs - (now - last.createdAt.getTime())) / 1000);
      if (wait > 0) throw ApiError.tooMany(`${wait}초 뒤에 다시 받을 수 있어요`);
    }
    const sent = await this.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM email_codes WHERE email = $1 AND purpose = $2 AND created_at > now() - interval '1 hour'",
      [email, purpose],
    );
    if (sent!.n >= HOURLY_LIMIT) throw ApiError.tooMany('인증번호를 너무 많이 요청했어요. 한 시간 뒤에 다시 시도해 주세요');

    const code = newCode();
    const challenge = CHALLENGE_PURPOSES.includes(purpose) ? randomBytes(32).toString('base64url') : undefined;
    await this.db.transaction(async () => {
      await this.db.execute("DELETE FROM email_codes WHERE created_at < now() - interval '1 day'");
      await this.db.execute('UPDATE email_codes SET expires_at = now() WHERE email = $1 AND purpose = $2 AND expires_at > now()', [email, purpose]);
      await this.db.execute(
        `INSERT INTO email_codes (email, purpose, code_hash, challenge, user_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + make_interval(mins => $6))`,
        [email, purpose, hash(code), challenge ?? null, userId, CODE_TTL_MINUTES],
      );
      await this.mailer.sendCode(email, purpose, code); // 실패하면 예외 → 저장도 되돌린다
    });
    return challenge;
  }

  /** 이메일로 받은 번호가 맞는지 확인하고, 맞으면 번호를 폐기한다 */
  async verify(email: string, purpose: CodePurpose, code: string) {
    const saved = await this.db.one<CodeRow>(`${SELECT_CODE} WHERE email = $1 AND purpose = $2 ORDER BY id DESC LIMIT 1`, [email, purpose]);
    if (!saved) throw ApiError.badRequest('인증번호를 먼저 받아 주세요');
    await this.check(saved, code);
  }

  /** challenge 로 번호를 찾아 확인하고, 그 번호를 받은 사용자 id 를 돌려준다 (다른 용도의 challenge 는 받지 않는다) */
  async verifyChallenge(purpose: CodePurpose, challenge: string, code: string): Promise<number> {
    const saved = await this.db.one<CodeRow>(`${SELECT_CODE} WHERE challenge = $1 AND purpose = $2`, [challenge, purpose]);
    if (!saved) throw ApiError.badRequest(expiredMessage(purpose));
    await this.check(saved, code);
    return saved.userId!;
  }

  /** 번호 입력 화면의 '다시 받기': 같은 사람에게 새 번호와 새 challenge 를 보낸다 */
  async resendChallenge(purpose: CodePurpose, challenge: string): Promise<string> {
    const saved = await this.db.one<CodeRow>(`${SELECT_CODE} WHERE challenge = $1 AND purpose = $2`, [challenge, purpose]);
    if (!saved || saved.createdAt.getTime() < Date.now() - CHALLENGE_TTL_MS) throw ApiError.badRequest(expiredMessage(purpose));
    return (await this.send(saved.email, purpose, saved.userId))!;
  }

  /**
   * 틀린 횟수는 (호출한 쪽이 실패로 끝나더라도) 남아야 하므로, 확인 결과를 먼저 저장하고 나서 오류를 던진다.
   * 호출하는 쪽도 이 확인을 자기 트랜잭션 밖에서 부른다.
   */
  private async check(saved: CodeRow, code: string) {
    if (saved.expiresAt.getTime() <= Date.now()) throw ApiError.badRequest('인증번호가 만료됐어요. 새 번호를 받아 주세요');
    const given = Buffer.from(hash(normalizeCode(code)));
    const match = timingSafeEqual(Buffer.from(saved.codeHash), given);
    if (match) {
      // 한 번 쓴 번호는 다시 못 쓴다
      await this.db.execute('UPDATE email_codes SET expires_at = now(), challenge = NULL WHERE id = $1', [saved.id]);
      return;
    }
    // 동시에 여러 번 틀려도 횟수가 빠지지 않게 DB 에서 원자적으로 센다
    const row = await this.db.one<{ attempts: number }>('UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts', [
      saved.id,
    ]);
    const attempts = row!.attempts;
    if (attempts >= MAX_ATTEMPTS) {
      await this.db.execute('UPDATE email_codes SET expires_at = now(), challenge = NULL WHERE id = $1', [saved.id]);
      throw ApiError.badRequest(`인증번호를 ${MAX_ATTEMPTS}번 틀렸어요. 새 번호를 받아 주세요`);
    }
    throw ApiError.badRequest(`인증번호가 맞지 않아요 (${attempts}/${MAX_ATTEMPTS})`);
  }
}
