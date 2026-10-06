import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiError } from '../common/api-error';
import { Public } from './auth.guard';
import { OAuthService, isProvider, type OAuthProvider } from './oauth.service';

const COOKIE = 'loop_oauth';
const COOKIE_PATH = '/api/auth/oauth';

/** 이 요청이 들어온 바깥 주소 (https://도메인). PUBLIC_API_ORIGIN 을 주면 그 값을 쓴다 */
function origin(req: Request) {
  if (process.env.PUBLIC_API_ORIGIN) return process.env.PUBLIC_API_ORIGIN.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0];
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host);
  return `${proto}://${host}`;
}

/** 로그인 뒤 돌아갈 웹 주소. API 와 웹이 다른 곳에 있으면 PUBLIC_ORIGIN (CORS 와 같은 값) */
function webOrigin(req: Request) {
  return (process.env.PUBLIC_ORIGIN?.split(',')[0] ?? origin(req)).replace(/\/$/, '');
}

const redirectUri = (req: Request, provider: OAuthProvider) => `${origin(req)}/api/auth/oauth/${provider}/callback`;

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/**
 * 소셜 로그인. 웹은 /api/auth/oauth/:provider/start 로 이동만 하면 되고,
 * 끝나면 웹의 /oauth/callback#token=… (또는 #challenge=… / #error=…) 로 돌아온다.
 * 토큰은 서버 로그·Referer 에 남지 않도록 주소의 # 뒤(fragment)로만 넘긴다.
 */
@Controller()
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  /** 켜진(키가 설정된) 소셜 로그인 */
  @Public()
  @Get('auth/oauth/providers')
  providers() {
    return this.oauth.enabled();
  }

  @Public()
  @Get('auth/oauth/:provider/start')
  start(@Param('provider') provider: string, @Query('next') next: string | undefined, @Query('ref') ref: string | undefined, @Req() req: Request, @Res() res: Response) {
    if (!isProvider(provider)) throw ApiError.notFound('없는 로그인 방법이에요');
    const { url, nonce } = this.oauth.start(provider, redirectUri(req, provider), { next, ref });
    res.cookie(COOKIE, nonce, {
      httpOnly: true,
      secure: origin(req).startsWith('https://'),
      // 제공자에서 돌아오는 건 다른 사이트에서 오는 GET 이동이라 Lax 면 쿠키가 따라온다
      sameSite: 'lax',
      path: COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(302, url);
  }

  @Public()
  @Get('auth/oauth/:provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query() query: { code?: string; state?: string; error?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!isProvider(provider)) throw ApiError.notFound('없는 로그인 방법이에요');
    res.clearCookie(COOKIE, { path: COOKIE_PATH });
    const back = `${webOrigin(req)}/oauth/callback`;
    try {
      const { result, next } = await this.oauth.callback(provider, query, readCookie(req, COOKIE), redirectUri(req, provider), String(req.headers['user-agent'] ?? ''));
      const hash = new URLSearchParams({ next });
      if (result.twoFactorRequired) {
        hash.set('challenge', result.challenge ?? '');
        if (result.maskedEmail) hash.set('email', result.maskedEmail);
      } else {
        hash.set('token', result.token);
      }
      res.redirect(302, `${back}#${hash}`);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '소셜 로그인 중 문제가 생겼어요. 다시 시도해 주세요';
      res.redirect(302, `${back}#${new URLSearchParams({ error: message })}`);
    }
  }
}
