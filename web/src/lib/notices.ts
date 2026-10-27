import { useSyncExternalStore } from 'react';
import { useLatestSiteNotice, type NoticeKind } from '@loop/shared';

/** 공지 종류마다 이름 · 색 (목록 · 자세히 · 관리자 화면에서 같이 쓴다) */
export const NOTICE_KIND: Record<NoticeKind, { label: string; className: string }> = {
  update: { label: '업데이트', className: 'bg-primary-weak text-primary' },
  notice: { label: '공지', className: 'bg-field text-fg-strong' },
  event: { label: '이벤트', className: 'bg-[color-mix(in_srgb,#ff8a3d_16%,transparent)] text-[#e0701f]' },
  maintenance: { label: '점검', className: 'bg-danger-weak text-danger-text' },
};
export const NOTICE_KINDS = Object.keys(NOTICE_KIND) as NoticeKind[];

export const noticeDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

/* 마지막으로 본 공지 번호 (이 브라우저에만). 새 공지가 올라오면 점과 홈 안내 띠로 알린다 */
const KEY = 'loop.noticeSeen';
const listeners = new Set<() => void>();
const read = () => {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
};
let seen = read();

export function markNoticeSeen(id: number | undefined) {
  if (!id || id <= seen) return;
  seen = id;
  try {
    localStorage.setItem(KEY, String(id));
  } catch {
    // 저장하지 못해도 이번 화면에서는 기억한다
  }
  listeners.forEach((l) => l());
}

/** 아직 보지 않은 최근 공지 (30일 안에 올라온 것만) */
export function useNewNotice() {
  const latest = useLatestSiteNotice().data;
  const seenId = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => seen,
  );
  if (!latest?.id || latest.id <= seenId || !latest.createdAt) return undefined;
  if (Date.now() - Date.parse(latest.createdAt) > 30 * 86_400_000) return undefined;
  return latest as { id: number; title: string; kind: NoticeKind; createdAt: string };
}
