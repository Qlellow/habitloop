import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JwtService } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { adminConfig, adminVersion, sameKey } from './admin.config';

/** 관리자 (회원 계정과 따로, 환경 변수의 이메일 하나) */
export interface AdminUser {
  email: string;
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
 * 2) 관리자 토큰(비밀번호 + 이메일 인증번호로 받은, 2시간짜리)이 있어야 한다. 일반 로그인 토큰으로는 안 된다
 * 3) 토큰을 받은 뒤 관리자 이메일 · 비밀번호 · 키가 바뀌었으면 그 토큰은 더 못 쓴다
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { admin?: AdminUser }>();
    const config = adminConfig();
    if (!config || !sameKey(req.header('x-admin-key'))) throw hiddenNotFound();
    if (this.reflector.getAllAndOverride<boolean>(NO_TOKEN, [ctx.getHandler(), ctx.getClass()])) return true;

    const header = req.header('authorization');
    const claims = header?.startsWith('Bearer ') ? this.jwt.parseAdmin(header.slice(7)) : undefined;
    if (!claims || claims.v !== adminVersion(config)) throw ApiError.unauthorized('관리자 로그인이 필요해요');
    req.admin = { email: config.email };
    return true;
  }
}
