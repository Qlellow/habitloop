import { useNavigate, useParams } from 'react-router-dom';
import { compact, useAcceptInvite, useAuth, useInvite } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { Page } from '../components/Layout';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';
import { cn } from '../lib/cn';

/** 초대 링크 · QR 로 들어온 화면: 비공개 채널을 확인하고 팔로우한다 */
export default function InvitePage() {
  const { code = '' } = useParams();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const invite = useInvite(code);
  const accept = useAcceptInvite();
  const c = invite.data;

  const join = () => {
    if (!isLoggedIn) return navigate('/login', { state: { from: `/invite/${code}` } });
    accept.mutate(code, {
      onSuccess: ({ slug }) => {
        toast(`${c?.name ?? '채널'}을 팔로우했어요`);
        navigate(`/c/${slug}`, { replace: true });
      },
      onError: (e) => toast(e.message),
    });
  };

  return (
    <Page variant="narrow">
      <section className={cn(ui.card, 'flex flex-col items-center px-6 py-10 text-center')}>
        {invite.isPending ? (
          <div className={ui.spinner} />
        ) : !c ? (
          <>
            <span className="text-3xl" aria-hidden>
              🔗
            </span>
            <h1 className="mt-3 mb-1.5 text-xl font-bold text-fg-strong">초대가 만료됐어요</h1>
            <p className="m-0 text-fg-sub">초대 코드가 맞지 않거나 채널 운영진이 새 코드로 바꿨어요. 새 초대 링크를 받아 주세요.</p>
          </>
        ) : (
          <>
            <ChannelIcon channel={c} size={72} />
            <p className="mt-4 mb-1 text-sm text-fg-weak">채널에 초대받았어요</p>
            <h1 className="m-0 text-2xl font-bold text-fg-strong">
              {c.name}
              {c.adult && <span className="ml-2 align-[4px] inline-grid place-items-center w-6 h-6 rounded-full bg-danger text-white text-[11px] font-extrabold">19</span>}
            </h1>
            <p className="mt-1 mb-6 text-sm text-fg-sub">팔로워 {compact(c.memberCount)}명</p>
            {c.joined ? (
              <button type="button" className={cn(ui.button, ui.primary, ui.large)} onClick={() => navigate(`/c/${c.slug}`)}>
                채널로 가기
              </button>
            ) : (
              <button type="button" className={cn(ui.button, ui.primary, ui.large)} onClick={join} disabled={accept.isPending}>
                {isLoggedIn ? '팔로우하고 들어가기' : '로그인하고 팔로우하기'}
              </button>
            )}
          </>
        )}
      </section>
    </Page>
  );
}
