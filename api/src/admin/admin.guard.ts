import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JwtService } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { adminEmails, sameKey } from './admin.config';

export interface AdminUser {
  id: number;
  email: string;
  nickname: string;
}

const NO_TOKEN = 'admin-no-token';
/** 관리자 키만 확인하고 관리자 토큰은 필요 없는 API (주소 확인 · 로그인) */
export const AdminLogin = () => SetMetadata(NO_TOKEN, true);

export const CurrentAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AdminUser => ctx.switchToHttp().getRequest<Request & { admin: AdminUser }>().admin,
);

/** 키가 틀리면 '없는 주소'와 똑같이 404 로 답한다 (관리자 기능이 있다는 것조차 알리지 않는다) */
export const hiddenNotFound = () => ApiError.notFound('페이지를 찾을 수 없어요');

/**
 * 관리자 API 가드.
 * 1) X-Admin-Key 헤더가 ADMIN_KEY 와 같아야 한다 (아니면 404)
 * 2) 관리자 토큰(로그인 + 이메일 인증번호로 받은, 2시간짜리)이 있어야 한다. 일반 로그인 토큰으로는 안 된다
 * 3) 요청마다 그 계정이 아직 ADMIN_EMAILS 에 있고, 탈퇴 · 정지되지 않았고, 비밀번호가 그대로인지 다시 확인한다
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly db: Database,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { admin?: AdminUser }>();
    if (!sameKey(req.header('x-admin-key'))) throw hiddenNotFound();
    if (this.reflector.getAllAndOverride<boolean>(NO_TOKEN, [ctx.getHandler(), ctx.getClass()])) return true;

    const header = req.header('authorization');
    const claims = header?.startsWith('Bearer ') ? this.jwt.parseAdmin(header.slice(7)) : undefined;
    if (!claims) throw ApiError.unauthorized('관리자 로그인이 필요해요');
    const user = await this.db.one<{ id: number; email: string; nickname: string; password: string }>(
      'SELECT id, email, nickname, password FROM users WHERE id = $1 AND withdrawn_at IS NULL AND suspended_at IS NULL',
      [claims.id],
    );
    if (!user || !adminEmails().has(user.email.toLowerCase()) || !this.jwt.samePassword(claims.pv, user.password)) {
      throw ApiError.unauthorized('관리자 로그인이 필요해요');
    }
    req.admin = { id: user.id, email: user.email, nickname: user.nickname };
    return true;
  }
}
