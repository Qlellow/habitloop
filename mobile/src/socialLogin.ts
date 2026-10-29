import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { api, apiUrl, completeOAuthLogin, type OAuthProvider } from '@loop/shared';

/**
 * 앱 소셜 로그인 (구글 · 카카오 · 네이버).
 * 휴대폰 브라우저 창으로 서버의 소셜 로그인을 열고, 끝나면 서버가 loop://oauth?code=… 로 앱에 돌려보낸다.
 * 다른 앱이 loop:// 주소를 가로챌 수 있어서 주소에는 토큰 대신 한 번 쓰는 교환 코드만 오고,
 * 시작할 때 만든 비밀값(verifier)이 있어야 토큰으로 바꿀 수 있다 (PKCE 와 같은 방식).
 *
 * 안드로이드는 브라우저 창의 결과와 앱 링크(app/oauth.tsx)가 둘 다 올 수 있어 먼저 온 쪽이 한 번만 마무리한다.
 */
export const APP_RETURN = 'loop://oauth';

export type SocialResult = { done: true } | { twoFactor: { challenge: string; maskedEmail?: string } } | { cancelled: true };

let pendingVerifier: string | null = null;

const base64url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** 브라우저 창을 열고 로그인이 끝날 때까지 기다린다 */
export async function startSocialLogin(provider: OAuthProvider): Promise<SocialResult> {
  const bytes = Crypto.getRandomBytes(32);
  const verifier = base64url(btoa(String.fromCharCode(...bytes)));
  const challenge = base64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  pendingVerifier = verifier;
  const result = await WebBrowser.openAuthSessionAsync(apiUrl(`/api/auth/oauth/${provider}/start?app=${challenge}`), APP_RETURN);
  if (result.type === 'success') return (await finishSocialLogin(result.url)) ?? { done: true };
  // 안드로이드: 창이 닫힌 뒤 앱 링크로 마무리됐을 수 있다 (그때는 pendingVerifier 가 비어 있다)
  if (pendingVerifier === verifier) pendingVerifier = null;
  return { cancelled: true };
}

/**
 * 돌아온 주소(loop://oauth?code=… 또는 ?error=…)로 로그인을 마친다. 이미 마무리했으면 null.
 * 실패하면 화면에 그대로 보여 줄 수 있는 문장으로 Error
 */
export async function finishSocialLogin(url: string): Promise<SocialResult | null> {
  const verifier = pendingVerifier;
  if (!verifier) return null;
  pendingVerifier = null;
  const query = new URLSearchParams(url.split('?')[1] ?? '');
  const error = query.get('error');
  if (error) throw new Error(error);
  const code = query.get('code');
  if (!code) throw new Error('소셜 로그인을 마치지 못했어요. 다시 시도해 주세요');
  const res = await api<{ token?: string; twoFactorRequired?: boolean; challenge?: string; maskedEmail?: string }>('/api/auth/oauth/app/exchange', {
    method: 'POST',
    body: { code, verifier },
  });
  if (res.twoFactorRequired && res.challenge) return { twoFactor: { challenge: res.challenge, maskedEmail: res.maskedEmail } };
  if (!res.token) throw new Error('소셜 로그인을 마치지 못했어요. 다시 시도해 주세요');
  await completeOAuthLogin(res.token);
  return { done: true };
}
