import { Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiError } from '../common/api-error';
import { LoginUser, Public } from './auth.guard';
import type { AuthUser } from './jwt.service';
import { OAuthService, isProvider, type OAuthProvider } from './oauth.service';

const COOKIE = 'loop_oauth';
const COOKIE_PATH = '/api/auth/oauth';

/**
 * 사이트 바깥 주소 (예: https://habitloop-eight.vercel.app). 소셜 로그인의 Redirect URI 와
 * 로그인을 마치고 돌아갈 웹 주소를 모두 이 값으로 만든다 → 각 개발자 콘솔에 등록한 주소와 항상 같다.
 * SITE_URL 이 없으면(로컬 개발 등) 이 요청이 들어온 주소를 쓴다.
 */
function siteUrl(req: Request) {
  if (process.env.SITE_URL) return process.env.SITE_URL.trim().replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0];
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host);
  return `${proto}://${host}`;
}

const redirectUri = (req: Request, provider: OAuthProvider) => `${siteUrl(req)}/api/auth/oauth/${provider}/callback`;

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

  /** 설정 화면: 켜진 소셜 로그인 · 내가 연결한 것 · 비밀번호가 있는지 */
  @Get('me/identities')
  identities(@LoginUser() user: AuthUser) {
    return this.oauth.identities(user.id);
  }

  /** 연결 시작 주소 (짧게 쓰는 연결 토큰이 들어 있다). 웹은 이 주소로 이동만 하면 된다 */
  @Post('me/identities/:provider/link')
  link(@LoginUser() user: AuthUser, @Param('provider') provider: string) {
    if (!isProvider(provider)) throw ApiError.notFound('없는 로그인 방법이에요');
    return this.oauth.linkStart(user.id, provider);
  }

  @Delete('me/identities/:provider')
  unlink(@LoginUser() user: AuthUser, @Param('provider') provider: string) {
    if (!isProvider(provider)) throw ApiError.notFound('없는 로그인 방법이에요');
    return this.oauth.unlink(user.id, provider);
  }

  @Public()
  @Get('auth/oauth/:provider/start')
  start(
    @Param('provider') provider: string,
    @Query('next') next: string | undefined,
    @Query('ref') ref: string | undefined,
    @Query('link') link: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!isProvider(provider)) throw ApiError.notFound('없는 로그인 방법이에요');
    let started: { url: string; nonce: string };
    try {
      started = this.oauth.start(provider, redirectUri(req, provider), { next, ref, link });
    } catch (e) {
      // 브라우저가 이동해 온 요청이라 JSON 대신 웹으로 돌려보내 이유를 보여 준다
      const message = e instanceof ApiError ? e.message : '소셜 로그인을 시작하지 못했어요';
      res.redirect(302, `${siteUrl(req)}/oauth/callback#${new URLSearchParams({ error: message, next: link ? '/me/settings' : '/' })}`);
      return;
    }
    const { url, nonce } = started;
    res.cookie(COOKIE, nonce, {
      httpOnly: true,
      secure: siteUrl(req).startsWith('https://'),
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
    const back = `${siteUrl(req)}/oauth/callback`;
    try {
      const done = await this.oauth.callback(provider, query, readCookie(req, COOKIE), redirectUri(req, provider), String(req.headers['user-agent'] ?? ''));
      const hash = new URLSearchParams({ next: done.next });
      const result = 'result' in done ? done.result : undefined;
      if (!result) {
        hash.set('linked', provider);
      } else if (result.twoFactorRequired) {
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
