import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiError } from '../common/api-error';
import { LoginUser, Public } from './auth.guard';
import type { AuthUser } from './jwt.service';
import { OAuthService, isProvider, type OAuthProvider } from './oauth.service';
import { AppCodeInput } from './auth.dto';
import { JwtService } from './jwt.service';

const COOKIE = 'loop_oauth';
const COOKIE_PATH = '/api/auth/oauth';

/**
 * 사이트 바깥 주소 (예: https://habitloop-eight.vercel.app). 소셜 로그인의 Redirect URI 와
 * 로그인을 마치고 돌아갈 웹 주소를 모두 이 값으로 만든다 → 각 개발자 콘솔에 등록한 주소와 항상 같다.
 * SITE_URL 이 없으면(로컬 개발 등) 이 요청이 들어온 주소를 쓴다.
 */
export function siteUrl(req: Request) {
  if (process.env.SITE_URL) return process.env.SITE_URL.trim().replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0];
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host);
  return `${proto}://${host}`;
}

const redirectUri = (req: Request, provider: OAuthProvider) => `${siteUrl(req)}/api/auth/oauth/${provider}/callback`;

/** 앱으로 돌아가는 주소 (app.json 의 scheme). 예: loop://oauth?code=… */
const appReturn = (params: Record<string, string>) => `${process.env.APP_SCHEME?.trim() || 'loop'}://oauth?${new URLSearchParams(params)}`;

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
  constructor(
    private readonly oauth: OAuthService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * 카카오톡 공유용 JavaScript 키. 원래 브라우저에 공개되는 키(등록한 도메인에서만 동작)라 그대로 내려준다.
   * 웹 빌드 변수(VITE_)가 아니라 서버 환경 변수로 받으므로 Vercel 에서 Secret 으로 저장해도 된다
   */
  @Public()
  @Get('share/kakao-key')
  kakaoKey() {
    return { key: process.env.KAKAO_JS_KEY?.trim() || null };
  }

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
    // 앱에서 시작한 로그인: 앱이 만든 확인값 (끝나면 앱으로 교환 코드를 돌려보낸다)
    @Query('app') app: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!isProvider(provider)) throw ApiError.notFound('없는 로그인 방법이에요');
    let started: { url: string; nonce: string };
    try {
      started = this.oauth.start(provider, redirectUri(req, provider), { next, ref, link, app });
    } catch (e) {
      // 브라우저가 이동해 온 요청이라 JSON 대신 웹으로 돌려보내 이유를 보여 준다
      const message = e instanceof ApiError ? e.message : '소셜 로그인을 시작하지 못했어요';
      if (app != null) return void res.redirect(302, appReturn({ error: message }));
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
    // 앱에서 시작했는지 (실패해도 앱으로 돌려보내야 해서 먼저 본다. 서명이 맞는 state 만)
    const appChallenge = query.state ? this.jwt.parseOAuthState(query.state)?.app : undefined;
    try {
      const done = await this.oauth.callback(provider, query, readCookie(req, COOKIE), redirectUri(req, provider), String(req.headers['user-agent'] ?? ''));
      // 앱: 토큰은 주소에 싣지 않고 한 번 쓰는 교환 코드만 보낸다
      if (appChallenge && 'result' in done && done.result) {
        const r = done.result;
        const payload = r.twoFactorRequired ? { twoFactorRequired: true as const, challenge: r.challenge ?? '', maskedEmail: r.maskedEmail } : { token: r.token };
        return void res.redirect(302, appReturn({ code: await this.oauth.createAppCode(appChallenge, payload) }));
      }
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
      if (appChallenge) return void res.redirect(302, appReturn({ error: message }));
      res.redirect(302, `${back}#${new URLSearchParams({ error: message })}`);
    }
  }

  /** 앱 소셜 로그인 마무리: 앱으로 보낸 교환 코드 + 시작할 때 만든 비밀값 → 로그인 결과 (한 번만, 5분) */
  @Public()
  @Post('auth/oauth/app/exchange')
  @HttpCode(HttpStatus.OK)
  exchange(@Body() input: AppCodeInput) {
    return this.oauth.exchangeAppCode(input.code, input.verifier);
  }
}
