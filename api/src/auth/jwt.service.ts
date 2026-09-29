import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: number;
  nickname: string;
}

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

  issue(userId: number, nickname: string): string {
    return jwt.sign({ nickname }, this.secret, {
      subject: String(userId),
      expiresIn: this.ttl as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
    });
  }

  parse(token: string): AuthUser | undefined {
    try {
      const claims = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      const id = Number(claims.sub);
      return Number.isInteger(id) ? { id, nickname: String(claims.nickname ?? '') } : undefined;
    } catch {
      return undefined;
    }
  }
}
