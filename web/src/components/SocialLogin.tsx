import type { ReactElement } from 'react';
import { oauthStartUrl, useOAuthProviders, type OAuthProvider } from '@loop/shared';
import { useReturnTo } from '../lib/authNav';
import { toast } from './Toast';
import { cn } from '../lib/cn';

/** 각 회사 가이드의 로고 · 바탕색 그대로. 감싸는 동그라미 모양만 루프 스타일 */
const GoogleLogo = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const KakaoLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#000000"
      fillOpacity="0.9"
      d="M12 3C6.48 3 2 6.48 2 10.78c0 2.78 1.86 5.22 4.66 6.6-.2.74-.74 2.69-.85 3.1-.13.52.19.51.4.37.17-.11 2.62-1.78 3.68-2.5.69.1 1.39.15 2.11.15 5.52 0 10-3.48 10-7.72S17.52 3 12 3z"
    />
  </svg>
);

const NaverLogo = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden>
    <path fill="#FFFFFF" d="M13.56 10.7 6.17 0H0v20h6.44V9.3L13.83 20H20V0h-6.44z" />
  </svg>
);

const PROVIDERS: { id: OAuthProvider; label: string; logo: () => ReactElement; className: string }[] = [
  // Google: 흰 바탕 + 연한 테두리 (어두운 화면에서도 흰 바탕을 유지)
  { id: 'google', label: 'Google', logo: GoogleLogo, className: 'bg-white border border-[#dadce0]' },
  // Kakao: 카카오 노랑 + 검은 말풍선
  { id: 'kakao', label: '카카오', logo: KakaoLogo, className: 'bg-[#FEE500]' },
  // Naver: 네이버 초록 + 흰 N
  { id: 'naver', label: '네이버', logo: NaverLogo, className: 'bg-[#03C75A]' },
];

/** 초대 링크로 들어와 회원가입 화면에 남겨 둔 초대 코드 (SignupPage 와 같은 키) */
function inviteRef() {
  try {
    return sessionStorage.getItem('loop:ref') ?? undefined;
  } catch {
    return undefined;
  }
}

/** 로그인 · 회원가입 화면 아래: "소셜 계정으로 계속하기" + Google · Kakao · Naver 동그라미 버튼 */
export function SocialLogin() {
  const next = useReturnTo();
  const enabled = useOAuthProviders().data;

  const start = (provider: OAuthProvider, label: string) => {
    if (enabled && !enabled.includes(provider)) {
      toast(`${label} 로그인은 아직 준비 중이에요`);
      return;
    }
    window.location.assign(oauthStartUrl(provider, next, inviteRef()));
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-[13px] text-fg-weak before:flex-1 before:h-px before:bg-line after:flex-1 after:h-px after:bg-line">
        소셜 계정으로 계속하기
      </div>
      <div className="flex justify-center gap-4 mt-4">
        {PROVIDERS.map(({ id, label, logo: Logo, className }) => (
          <button
            key={id}
            type="button"
            aria-label={`${label}로 계속하기`}
            title={`${label}로 계속하기`}
            onClick={() => start(id, label)}
            className={cn(
              'grid place-items-center w-12 h-12 rounded-full shadow-sm transition-[transform,box-shadow] duration-150',
              'hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0 active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              className,
            )}
          >
            <Logo />
          </button>
        ))}
      </div>
    </div>
  );
}
