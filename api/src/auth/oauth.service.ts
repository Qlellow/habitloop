import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { RewardsService } from '../users/rewards.service';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';

export const OAUTH_PROVIDERS = ['google', 'kakao', 'naver'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** 소셜 계정에서 받아 온 사용자 정보 */
export interface OAuthProfile {
  id: string;
  email?: string;
  /** 제공자가 이 이메일의 주인임을 확인했는지. 확인된 이메일만 기존 계정과 이어 붙인다 */
  emailVerified: boolean;
  nickname?: string;
}

interface ProviderConfig {
  clientId?: string;
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope?: string;
  profile: (accessToken: string) => Promise<OAuthProfile>;
}

async function getJson(url: string, init: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

/**
 * 제공자별 주소와 사용자 정보 읽기. 키(CLIENT_ID · SECRET)는 환경 변수로 받고, 없으면 그 제공자는 꺼진다.
 * - Google: OpenID Connect (sub, email, email_verified, name)
 * - Kakao: /v2/user/me (id, kakao_account.email, is_email_verified, profile.nickname). Client Secret 은 켠 경우에만
 * - Naver: /v1/nid/me (response.id, email, nickname). 네이버 이메일은 네이버가 확인한 연락처 이메일
 */
const PROVIDERS: Record<OAuthProvider, () => ProviderConfig> = {
  google: () => ({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    profile: async (token) => {
      const p = await getJson('https://openidconnect.googleapis.com/v1/userinfo', bearer(token));
      return { id: String(p.sub), email: p.email, emailVerified: p.email_verified === true, nickname: p.name };
    },
  }),
  kakao: () => ({
    clientId: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    profile: async (token) => {
      const p = await getJson('https://kapi.kakao.com/v2/user/me', bearer(token));
      const account = p.kakao_account ?? {};
      return {
        id: String(p.id),
        email: account.email,
        emailVerified: account.is_email_valid === true && account.is_email_verified === true,
        nickname: account.profile?.nickname ?? p.properties?.nickname,
      };
    },
  }),
  naver: () => ({
    clientId: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
    authorizeUrl: 'https://nid.naver.com/oauth2.0/authorize',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    profile: async (token) => {
      const p = (await getJson('https://openapi.naver.com/v1/nid/me', bearer(token))).response ?? {};
      return { id: String(p.id), email: p.email, emailVerified: !!p.email, nickname: p.nickname ?? p.name };
    },
  }),
};

export const isProvider = (value: string): value is OAuthProvider => (OAUTH_PROVIDERS as readonly string[]).includes(value);

/**
 * 소셜 로그인 (OAuth 2.0 authorization code). 흐름:
 * 1) /start: state(서명한 JWT)를 만들고, 같은 nonce 를 이 브라우저 쿠키에 심은 뒤 제공자 로그인 화면으로 보낸다
 * 2) /callback: state 서명 · 쿠키 nonce 를 확인하고, code 로 토큰을 받아 사용자 정보를 읽는다
 * 3) 이미 이어진 소셜 계정이면 그 사용자로, 아니면 확인된 같은 이메일의 계정에 이어 붙이고, 그것도 아니면 새로 가입시킨다
 */
@Injectable()
export class OAuthService {
  private readonly log = new Logger(OAuthService.name);

  constructor(
    private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly rewards: RewardsService,
  ) {}

  /** 키가 설정된(켜진) 제공자 */
  enabled(): OAuthProvider[] {
    return OAUTH_PROVIDERS.filter((p) => !!PROVIDERS[p]().clientId);
  }

  private config(provider: OAuthProvider) {
    const config = PROVIDERS[provider]();
    if (!config.clientId) throw ApiError.notFound('아직 준비 중인 로그인 방법이에요');
    return config;
  }

  /** 제공자 로그인 화면 주소와, 브라우저 쿠키에 심을 nonce */
  start(provider: OAuthProvider, redirectUri: string, extra: { next?: string; ref?: string }) {
    const config = this.config(provider);
    const nonce = randomBytes(16).toString('base64url');
    const state = this.jwt.issueOAuthState({ provider, nonce, next: safeNext(extra.next), ref: extra.ref?.slice(0, 20) });
    const url = new URL(config.authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.clientId!);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    if (config.scope) url.searchParams.set('scope', config.scope);
    if (provider === 'google') url.searchParams.set('prompt', 'select_account');
    return { url: url.toString(), nonce };
  }

  /**
   * 제공자에서 돌아왔을 때. 로그인 결과(토큰 또는 2단계 인증 challenge)와 돌아갈 곳을 준다.
   * 실패하면 ApiError (메시지는 화면에 그대로 보여 줄 수 있는 문장)
   */
  async callback(provider: OAuthProvider, query: { code?: string; state?: string; error?: string }, cookieNonce: string | undefined, redirectUri: string, userAgent: string) {
    const state = query.state ? this.jwt.parseOAuthState(query.state) : undefined;
    // 다른 브라우저에서 시작한 로그인(로그인 CSRF)이나 위조된 state 는 받지 않는다
    if (!state || state.provider !== provider || !cookieNonce || cookieNonce !== state.nonce) {
      throw ApiError.badRequest('로그인 시간이 지났거나 올바르지 않은 요청이에요. 다시 시도해 주세요');
    }
    if (query.error || !query.code) throw ApiError.badRequest('소셜 로그인을 취소했어요');
    const config = this.config(provider);

    let profile: OAuthProfile;
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: query.code,
        client_id: config.clientId!,
        redirect_uri: redirectUri,
        ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
        ...(provider === 'naver' ? { state: query.state! } : {}),
      });
      const token = await getJson(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body,
      });
      if (!token.access_token) throw new Error(`no access_token from ${provider}`);
      profile = await config.profile(token.access_token);
      if (!profile.id || profile.id === 'undefined') throw new Error(`no user id from ${provider}`);
    } catch (e) {
      this.log.warn(`소셜 로그인 실패 (${provider}): ${(e as Error).message}`);
      throw ApiError.badRequest('소셜 계정 정보를 받아 오지 못했어요. 잠시 뒤 다시 시도해 주세요');
    }

    const userId = await this.findOrCreate(provider, profile, state.ref);
    return { result: await this.auth.socialLogin(userId, userAgent), next: state.next };
  }

  private async findOrCreate(provider: OAuthProvider, profile: OAuthProfile, ref?: string): Promise<number> {
    const linked = await this.db.one<{ userId: number }>(
      'SELECT user_id AS "userId" FROM user_identities WHERE provider = $1 AND provider_user_id = $2',
      [provider, profile.id],
    );
    if (linked) return linked.userId;

    const email = profile.email?.trim().toLowerCase();
    // 제공자가 확인한 이메일과 같은 계정이 있으면 그 계정에 이어 붙인다
    if (email && profile.emailVerified) {
      const existing = await this.db.one<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
      if (existing) {
        await this.link(provider, profile.id, existing.id);
        return existing.id;
      }
    }

    // 새로 가입: 이메일이 없거나 이미 쓰이는(확인 안 된) 이메일이면 내부용 주소를 쓴다. 비밀번호는 아무도 모르는 값
    const usable = email && profile.emailVerified && !(await this.db.one('SELECT 1 FROM users WHERE email = $1', [email]));
    const userEmail = usable ? email : `${provider}_${profile.id}@social.loop`.slice(0, 100);
    const password = await bcrypt.hash(randomBytes(24).toString('base64url'), 10);
    const userId = await this.db.transaction(async () => {
      const nickname = await this.uniqueNickname(profile.nickname);
      const row = await this.db.one<{ id: number }>('INSERT INTO users (email, password, nickname) VALUES ($1, $2, $3) RETURNING id', [
        userEmail,
        password,
        nickname,
      ]);
      await this.link(provider, profile.id, row!.id);
      return row!.id;
    });
    await this.rewards.signedUp(userId, ref);
    return userId;
  }

  private link(provider: OAuthProvider, providerUserId: string, userId: number) {
    return this.db.execute(
      'INSERT INTO user_identities (provider, provider_user_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [provider, providerUserId, userId],
    );
  }

  /** 소셜 닉네임을 그대로 쓰되, 겹치면 숫자를 붙인다 (2~20자) */
  private async uniqueNickname(raw?: string) {
    let base = (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 16);
    if (base.length < 2) base = '루퍼';
    for (let i = 0; i < 20; i++) {
      const candidate = i === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
      if (!(await this.db.one('SELECT 1 FROM users WHERE nickname = $1', [candidate]))) return candidate;
    }
    return `루퍼${randomBytes(4).toString('hex')}`.slice(0, 20);
  }
}

/** 로그인 뒤 돌아갈 곳은 우리 사이트 안의 경로만 (//evil.com 같은 바깥 주소 금지) */
function safeNext(next?: string) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next.slice(0, 300) : '/';
}
