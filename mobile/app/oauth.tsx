import { useEffect } from 'react';
import { router, useGlobalSearchParams } from 'expo-router';
import { Loading } from '../src/ui';
import { finishSocialLogin } from '../src/socialLogin';
import { leave } from '../src/nav';
import { toast } from '../src/Toast';

/**
 * 소셜 로그인이 끝나 loop://oauth?code=… 로 앱이 열렸을 때 (안드로이드는 브라우저 창 결과와 함께 이 화면도 열린다).
 * 아직 로그인 화면이 마무리하지 않았으면 여기서 마치고, 어느 쪽이든 이 화면은 바로 닫는다
 */
export default function OAuthReturnScreen() {
  const params = useGlobalSearchParams<{ code?: string; error?: string }>();
  useEffect(() => {
    const query = new URLSearchParams();
    if (params.code) query.set('code', params.code);
    if (params.error) query.set('error', params.error);
    finishSocialLogin(`loop://oauth?${query}`).then(
      (r) => {
        if (r && 'twoFactor' in r) router.replace({ pathname: '/login', params: { challenge: r.twoFactor.challenge, masked: r.twoFactor.maskedEmail ?? '' } });
        else leave();
      },
      (e: Error) => {
        toast(e.message);
        leave();
      },
    );
  }, [params.code, params.error]);
  return <Loading />;
}
