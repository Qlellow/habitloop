import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: number;
  nickname: string;
  /** 로그인한 기기(세션) id. 로그아웃하면 sessions 에서 지워져 이 토큰을 더는 못 쓴다 */
  sid: string;
}

/** 비밀번호 재설정 토큰: 이메일 인증을 마친 뒤 새 비밀번호를 정할 때까지만 쓴다 */
const RESET_TTL = '10m';
const RESET_PURPOSE = 'password-reset';
const OAUTH_PURPOSE = 'oauth-state';

/** 비밀번호가 바뀌면 달라지는 값. 재설정 토큰에 넣어서 한 번 쓰면 다시 못 쓰게 한다 */
const passwordVersion = (passwordHash: string) => createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);

const DEV_SECRET = 'local-dev-secret-please-change-this-to-a-long-random-string';

@Injectable()
export class JwtService {
  private readonly secret: string;
  private readonly ttl = process.env.JWT_TTL ?? '7d';

  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET 환경 변수를 설정해 주세요 (32바이트 이상)');
    }
    this.secret = secret ?? DEV_SECRET;
  }

  /** 로그인 토큰과 만료 시각(세션도 같이 끝난다) */
  issue(userId: number, nickname: string, sid: string): { token: string; expiresAt: Date } {
    const token = jwt.sign({ nickname, sid }, this.secret, {
      subject: String(userId),
      expiresIn: this.ttl as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
    });
    const { exp } = jwt.decode(token) as jwt.JwtPayload;
    return { token, expiresAt: new Date(exp! * 1000) };
  }

  parse(token: string): AuthUser | undefined {
    try {
      const claims = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      // 재설정 토큰 같은 다른 용도의 토큰으로는 로그인할 수 없다
      if (claims.purpose) return undefined;
      const id = Number(claims.sub);
      // 세션 id 가 없는 예전 토큰은 받지 않는다 (다시 로그인)
      if (!Number.isInteger(id) || typeof claims.sid !== 'string') return undefined;
      return { id, nickname: String(claims.nickname ?? ''), sid: claims.sid };
    } catch {
      return undefined;
    }
  }

  issueReset(userId: number, passwordHash: string): string {
    return jwt.sign({ purpose: RESET_PURPOSE, pv: passwordVersion(passwordHash) }, this.secret, {
      subject: String(userId),
      expiresIn: RESET_TTL,
      algorithm: 'HS256',
    });
  }

  /** 재설정 토큰이 유효하면 사용자 id. 이미 비밀번호를 바꿨으면(pv 가 다르면) 호출한 쪽에서 거절한다 */
  parseReset(token: string): { id: number; pv: string } | undefined {
    try {
      const claims = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      const id = Number(claims.sub);
      if (claims.purpose !== RESET_PURPOSE || !Number.isInteger(id)) return undefined;
      return { id, pv: String(claims.pv) };
    } catch {
      return undefined;
    }
  }

  /** 소셜 로그인 state: 어느 제공자로, 어떤 브라우저(nonce)에서 시작했는지 · 돌아갈 곳 · 초대 코드. 10분 */
  issueOAuthState(state: { provider: string; nonce: string; next: string; ref?: string }): string {
    return jwt.sign({ purpose: OAUTH_PURPOSE, ...state }, this.secret, { expiresIn: '10m', algorithm: 'HS256' });
  }

  parseOAuthState(token: string): { provider: string; nonce: string; next: string; ref?: string } | undefined {
    try {
      const c = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      if (c.purpose !== OAUTH_PURPOSE || typeof c.provider !== 'string' || typeof c.nonce !== 'string') return undefined;
      return { provider: c.provider, nonce: c.nonce, next: typeof c.next === 'string' ? c.next : '/', ref: typeof c.ref === 'string' ? c.ref : undefined };
    } catch {
      return undefined;
    }
  }

  matchesPassword(pv: string, passwordHash: string) {
    return pv === passwordVersion(passwordHash);
  }
}
