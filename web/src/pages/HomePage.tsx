import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useChannels, useMyChannels, type HomeLayout } from '@loop/shared';
import { Page } from '../components/Layout';
import { HomeGrid } from '../components/home/HomeGrid';
import { compactOptions, optionsOf } from '../components/home/widgets';
import { GridIcon } from '../components/Icons';
import { WeatherSky } from '../components/Weather';
import { NoticeBanner } from '../components/NoticeBanner';
import { toast } from '../components/Toast';
import { TEMPLATES, fromTemplate, normalize, useSavedHome, type TemplateCtx } from '../lib/homeLayout';
import { preload } from '../lib/preload';
import { ui } from '../components/ui';
import { cn } from '../lib/cn';

// 편집기는 꾸밀 때만 불러온다
const HomeEditor = lazy(() => import('../components/home/HomeEditor').then((m) => ({ default: m.HomeEditor })));

export function MakeChannelCard() {
  const { isLoggedIn } = useAuth();
  const to = isLoggedIn ? '/channels/new' : '/login';
  return (
    <section className={ui.card} style={{ padding: 20 }}>
      <h2 className={ui.sectionTitle} style={{ fontSize: 16 }}>
        나만의 채널을 만들어 보세요
      </h2>
      <p style={{ margin: '6px 0 14px', fontSize: 14, color: 'var(--text-sub)' }}>
        좋아하는 주제로 사람들이 모이는 공간을 만들 수 있어요.
      </p>
      <Link to={to} state={isLoggedIn ? undefined : { from: '/channels/new' }} className={cn(ui.button, ui.secondary, ui.full)} onPointerEnter={preload.channelForm}>
        채널 만들기
      </Link>
    </section>
  );
}

/** 넓은 화면(860px 이상)에서만 꾸밀 수 있다 */
const wide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 860px)').matches;

/**
 * 홈: 나만의 홈 (위젯 배치). 저장한 배치가 없으면 기본 템플릿(왼쪽 채널 · 가운데 글 · 오른쪽 인기글).
 * '홈 꾸미기'로 위젯을 더하고 옮기고 크기 · 설정을 바꾼다 (components/home).
 */
export default function HomePage() {
  const { isLoggedIn } = useAuth();
  const { layout: saved, loading, saving, save } = useSavedHome();
  const mine = useMyChannels(isLoggedIn).data;
  const popular = useChannels().data;
  const [editing, setEditing] = useState(false);

  const ctx: TemplateCtx = useMemo(() => {
    const followed = mine?.filter((c) => !c.owner).map((c) => c.slug) ?? [];
    const rest = popular?.map((c) => c.slug).filter((s) => !followed.includes(s)) ?? [];
    return { loggedIn: isLoggedIn, channels: [...followed, ...rest] };
  }, [isLoggedIn, mine, popular]);

  // 기본 홈은 로그인 여부에 따라 달라지지만 id 가 바뀌지 않게 한 번만 만든다
  const fallback = useMemo(() => fromTemplate(TEMPLATES[0], { loggedIn: isLoggedIn, channels: [] }), [isLoggedIn]);
  const layout = saved ?? fallback;

  // 메모처럼 위젯 안에서 바로 바꾸는 설정은 바로 저장한다
  const onOption = useCallback(
    (id: string, key: string, value: string | number | boolean) => {
      const next: HomeLayout = {
        ...layout,
        widgets: layout.widgets.map((w) => (w.id === id ? { ...w, o: compactOptions(w, { ...optionsOf(w), [key]: value }) } : w)),
      };
      save(next).catch((e: Error) => toast(e.message));
    },
    [layout, save],
  );

  const startEdit = () => {
    if (!wide()) return toast('홈 꾸미기는 넓은 화면(태블릿 가로 · 컴퓨터)에서 할 수 있어요');
    preload.homeEditor();
    setEditing(true);
    window.scrollTo({ top: 0 });
  };

  if (editing) {
    return (
      <Page variant="wide">
        <Suspense fallback={<div className={ui.spinner} />}>
          <HomeEditor
            initial={layout}
            ctx={ctx}
            saving={saving}
            onCancel={() => setEditing(false)}
            onSave={(next, reset) => {
              save(reset ? null : normalize(next))
                .then(() => {
                  setEditing(false);
                  toast(reset ? '기본 홈으로 되돌렸어요' : '홈을 저장했어요');
                })
                .catch((e: Error) => toast(e.message));
            }}
          />
        </Suspense>
      </Page>
    );
  }

  return (
    <Page variant="wide">
      {/* 커뮤니티 감정 날씨: 홈 화면 뒤에 깔린다 (설정에서 끌 수 있다) */}
      <WeatherSky />
      {/* 새 공지 · 업데이트 소식 (아직 보지 않은 것) */}
      <NoticeBanner />
      <div className="home-top">
        <button type="button" className={cn(ui.button, ui.text, ui.small, 'gap-1.5 [&>svg]:w-4 [&>svg]:h-4')} onClick={startEdit} onPointerEnter={preload.homeEditor}>
          <GridIcon />
          홈 꾸미기
        </button>
      </div>
      {loading ? <div className={ui.spinner} /> : <HomeGrid layout={layout} onOption={onOption} />}
    </Page>
  );
}
