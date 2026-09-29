import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiError } from '../common/api-error';
import { TtlCache } from '../common/ttl-cache';
import { Database } from '../db/database';
import { AuthUser, JwtService } from './jwt.service';

const PUBLIC = 'public';

/** 로그인하지 않아도 되는 API (로그인했으면 사용자 정보는 그대로 받는다) */
export const Public = () => SetMetadata(PUBLIC, true);

/** 요청한 사용자 (비로그인이면 undefined) */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | undefined => ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>().user,
);

/** 로그인이 필요한 API 에서 쓰는 사용자 (가드가 이미 확인했으므로 항상 있다) */
export const LoginUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user,
);

/**
 * 모든 요청: Bearer 토큰이 있으면 풀어서 req.user 에 넣는다.
 * 서명이 맞아도 사용자가 없으면(예: DB 초기화 뒤 남은 토큰) 비로그인으로 본다 → 쓰기 요청은 401.
 * @Public() 이 없는 API 는 로그인이 필요하다.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  // 있는 사용자만 60초 기억한다 (없는 id 는 매번 확인해서 탈퇴·초기화를 바로 반영)
  private readonly exists = new TtlCache<true>(60_000);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly db: Database,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const user = this.jwt.parse(header.slice(7));
      if (user && (await this.userExists(user.id))) req.user = user;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (!isPublic && !req.user) throw ApiError.unauthorized();
    return true;
  }

  private async userExists(id: number) {
    const key = String(id);
    if (this.exists.get(key)) return true;
    const found = await this.db.one('SELECT 1 FROM users WHERE id = $1', [id]);
    if (found) this.exists.set(key, true);
    return !!found;
  }
}
