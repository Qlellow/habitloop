import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeOAuthLogin, safeNext } from '@loop/shared';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';

/**
 * 소셜 로그인에서 돌아오는 곳. 서버가 주소의 # 뒤에 결과를 붙여 보낸다.
 * - #token=… → 로그인을 마치고 next 로
 * - #challenge=… → 2단계 인증이 켜진 계정: 로그인 화면의 인증번호 단계로
 * - #error=… → 로그인 화면으로 돌아가 이유를 알려 준다
 * 토큰이 방문 기록에 남지 않도록 바로 다른 주소로 바꾼다(replace).
 */
export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const next = safeNext(hash.get('next'), '/');
    const token = hash.get('token');
    const challenge = hash.get('challenge');
    history.replaceState(null, '', window.location.pathname);

    if (token) {
      completeOAuthLogin(token).then(
        () => navigate(next, { replace: true }),
        (e: Error) => {
          toast(e.message);
          navigate('/login', { replace: true, state: { from: next } });
        },
      );
    } else if (challenge) {
      navigate('/login', { replace: true, state: { from: next, twoFactor: { challenge, maskedEmail: hash.get('email') ?? undefined } } });
    } else {
      toast(hash.get('error') ?? '소셜 로그인을 마치지 못했어요. 다시 시도해 주세요');
      navigate('/login', { replace: true, state: { from: next } });
    }
  }, [navigate]);

  return (
    <main className="grid place-items-center min-h-[60dvh]" aria-busy="true">
      <div className="flex flex-col items-center gap-3 text-sm text-fg-sub">
        <div className={ui.spinner} />
        로그인하는 중…
      </div>
    </main>
  );
}
