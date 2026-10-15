import { useCallback, useEffect, useState } from 'react';
import { useAuth, useHomeLayout, useSaveHomeLayout, type HomeLayout, type HomeWidget, type HomeWidgetType } from '@loop/shared';
import { WIDGET } from '../components/home/widgets';
import { clampBox, MAX_WIDGETS, newId, settle } from './homeGrid';

/**
 * 나만의 홈 배치 불러오기 · 저장하기.
 * 로그인하면 서버(GET/PUT /api/me/home)에 저장해 다른 기기에서도 같고, 이 브라우저에도 사본을 둬 첫 화면을 바로 그린다.
 * 로그인하지 않았으면 이 브라우저에만 저장한다.
 */

type Spec = [type: HomeWidgetType, x: number, y: number, w: number, h: number, o?: HomeWidget['o']];

export interface TemplateCtx {
  loggedIn: boolean;
  /** 채널 위젯에 넣을 채널 (팔로우한 채널 → 인기 채널 순) */
  channels: string[];
}

export interface Template {
  key: string;
  label: string;
  desc: string;
  compact: boolean;
  specs: (ctx: TemplateCtx) => Spec[];
}

export const TEMPLATES: Template[] = [
  {
    key: 'basic',
    label: '기본',
    desc: '왼쪽 채널 · 가운데 글 · 오른쪽 인기글',
    compact: true,
    specs: ({ loggedIn }) => [
      ...(loggedIn ? ([['followed', 0, 0, 3, 4]] as Spec[]) : []),
      ['hotChannels', 0, loggedIn ? 4 : 0, 3, 6],
      ['feed', 3, 0, 6, 12],
      ['popular', 9, 0, 3, 6],
      ['makeChannel', 9, 6, 3, 3],
    ],
  },
  {
    key: 'focus',
    label: '피드 집중',
    desc: '넓은 글 목록 + 오른쪽에 소식',
    compact: true,
    specs: () => [
      ['greeting', 0, 0, 8, 2],
      ['feed', 0, 2, 8, 12],
      ['popular', 8, 0, 4, 6],
      ['notifications', 8, 6, 4, 5],
      ['shortcuts', 8, 11, 4, 2],
    ],
  },
  {
    key: 'dashboard',
    label: '대시보드',
    desc: '내 활동 · 알림 · 순위를 위에 모으고 글은 아래로',
    compact: true,
    specs: () => [
      ['greeting', 0, 0, 12, 2, { align: 'side' }],
      ['activity', 0, 2, 4, 3],
      ['pet', 4, 2, 4, 3],
      ['shortcuts', 8, 2, 4, 3],
      ['notifications', 0, 5, 4, 6],
      ['popular', 4, 5, 4, 6],
      ['hotChannels', 8, 5, 4, 6, { view: 'list' }],
      ['feed', 0, 11, 12, 10],
    ],
  },
  {
    key: 'boards',
    label: '게시판 모아보기',
    desc: '관심 채널 세 곳의 새 글을 나란히',
    compact: true,
    specs: ({ channels }) => [
      ['channel', 0, 0, 4, 7, { channel: channels[0] ?? '' }],
      ['channel', 4, 0, 4, 7, { channel: channels[1] ?? '' }],
      ['channel', 8, 0, 4, 7, { channel: channels[2] ?? '' }],
      ['popular', 0, 7, 6, 5],
      ['hotChannels', 6, 7, 6, 5, { view: 'grid', count: 10 }],
      ['feed', 0, 12, 12, 10],
    ],
  },
  {
    key: 'right',
    label: '오른쪽 몰아두기',
    desc: '글은 넓게, 나머지는 오른쪽 한 줄로',
    compact: true,
    specs: ({ loggedIn }) => [
      ['feed', 0, 0, 8, 12],
      ...(loggedIn ? ([['followed', 8, 0, 4, 4, { view: 'grid' }]] as Spec[]) : []),
      ['popular', 8, 4, 4, 6],
      ['hotChannels', 8, 10, 4, 5],
      ['makeChannel', 8, 15, 4, 3, { sticky: true }],
    ],
  },
  {
    key: 'notes',
    label: '메모장',
    desc: '메모 · 바로가기를 곁에 둔 두 단',
    compact: false,
    specs: () => [
      ['feed', 0, 0, 7, 12],
      ['memo', 7, 0, 5, 3, { color: 'yellow' }],
      ['shortcuts', 7, 3, 5, 2],
      ['popular', 7, 5, 5, 5],
      ['memo', 7, 10, 5, 3, { color: 'blue' }],
    ],
  },
  {
    key: 'minimal',
    label: '미니멀',
    desc: '가운데 글 목록 하나만',
    compact: true,
    specs: () => [['feed', 2, 0, 8, 12, { style: 'plain' }]],
  },
];

/** 템플릿으로 배치 만들기. 로그인해야 보이는 위젯은 로그인하지 않았으면 뺀다 */
export function fromTemplate(t: Template, ctx: TemplateCtx): HomeLayout {
  const widgets = t
    .specs(ctx)
    .filter(([type]) => ctx.loggedIn || !WIDGET[type].login)
    .map(([type, x, y, w, h, o]): HomeWidget => ({ id: newId(), type, x, y, w, h, ...(o ? { o } : {}) }));
  return { v: 1, compact: t.compact, widgets: settle(widgets, t.compact) };
}

/** 저장해 둔 배치를 믿지 않고 한 번 정리한다 (모르는 위젯 · 칸을 넘는 크기 · 겹침) */
export function normalize(layout: HomeLayout): HomeLayout {
  const widgets = layout.widgets
    .filter((w) => WIDGET[w.type])
    .slice(0, MAX_WIDGETS)
    .map((w) => clampBox(w, WIDGET[w.type].min));
  return { v: 1, compact: layout.compact !== false, widgets: settle(widgets, layout.compact !== false) };
}

const localKey = (userId?: string) => `loop.home.${userId ?? 'guest'}`;

function readLocal(userId?: string): HomeLayout | null {
  try {
    const raw = localStorage.getItem(localKey(userId));
    return raw ? normalize(JSON.parse(raw) as HomeLayout) : null;
  } catch {
    return null;
  }
}

function writeLocal(userId: string | undefined, layout: HomeLayout | null) {
  try {
    if (layout) localStorage.setItem(localKey(userId), JSON.stringify(layout));
    else localStorage.removeItem(localKey(userId));
  } catch {
    // 저장소를 못 쓰면 이번 방문에만
  }
}

/** 지금 홈 배치 (저장한 게 없으면 null) 와 저장하기 */
export function useSavedHome() {
  const { user, isLoggedIn, ready } = useAuth();
  const userId = isLoggedIn ? user?.id : undefined;
  const server = useHomeLayout(isLoggedIn && ready);
  const mutation = useSaveHomeLayout();
  const [local, setLocal] = useState(() => readLocal(userId));
  useEffect(() => setLocal(readLocal(userId)), [userId]);

  // 서버에서 받은 배치를 이 브라우저 사본에도
  useEffect(() => {
    if (!isLoggedIn || server.data === undefined) return;
    const next = server.data ? normalize(server.data) : null;
    writeLocal(userId, next);
    setLocal(next);
  }, [isLoggedIn, userId, server.data]);

  const save = useCallback(
    async (layout: HomeLayout | null) => {
      writeLocal(userId, layout);
      setLocal(layout);
      if (isLoggedIn) await mutation.mutateAsync(layout);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, isLoggedIn],
  );

  return {
    layout: local,
    /** 로그인했는데 서버 배치도, 이 브라우저 사본도 아직 없으면 잠깐 기다린다 (기본 홈이 번쩍 보였다 바뀌지 않게) */
    loading: isLoggedIn && !local && server.isPending,
    saving: mutation.isPending,
    save,
  };
}
