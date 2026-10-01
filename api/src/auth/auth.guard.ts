import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiError } from '../common/api-error';
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
 * 서명이 맞아도 그 기기의 세션이 없으면(로그아웃 · 비밀번호 변경 · 탈퇴 · DB 초기화) 비로그인으로 본다 → 쓰기 요청은 401.
 * 로그아웃이 바로 반영되도록 세션은 캐시하지 않고 요청마다 확인한다 (기본 키 조회 한 번).
 * @Public() 이 없는 API 는 로그인이 필요하다.
 */
@Injectable()
export class AuthGuard implements CanActivate {
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
      if (user && (await this.sessionAlive(user))) req.user = user;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (!isPublic && !req.user) throw ApiError.unauthorized();
    return true;
  }

  private async sessionAlive(user: AuthUser) {
    const row = await this.db.one<{ stale: boolean }>(
      `SELECT last_used_at < now() - interval '5 minutes' AS stale FROM sessions
       WHERE id = $1 AND user_id = $2 AND expires_at > now()`,
      [user.sid, user.id],
    );
    // 마지막 사용 시각은 5분에 한 번만 고친다 (요청마다 쓰지 않게)
    if (row?.stale) {
      void this.db.execute('UPDATE sessions SET last_used_at = now() WHERE id = $1', [user.sid]).catch(() => undefined);
    }
    return !!row;
  }
}
