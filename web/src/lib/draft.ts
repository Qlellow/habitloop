import { useEffect, useRef } from 'react';
import { authStore } from '@loop/shared';

/**
 * 글쓰기 임시저장: 쓰는 동안 이 브라우저에 자동으로 저장해 두고, 다시 들어오면 이어서 쓴다.
 * 뒤로가기 · 새로고침 · 로그인 만료로 화면을 떠나도 쓰던 글이 남는다.
 * 같은 브라우저를 다른 사람이 쓸 수 있으니 계정마다 따로 둔다.
 */
export interface PostDraft {
  title: string;
  content: string;
  categoryId: number | null;
  savedAt: number;
}

const PREFIX = 'loop.draft.';
/** 오래된 임시저장은 버린다 (30일) */
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const keyFor = (target: string) => `${PREFIX}${authStore.getUser()?.id ?? 'guest'}.${target}`;

function read(key: string): PostDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as PostDraft;
    if (typeof d.title !== 'string' || typeof d.content !== 'string' || Date.now() - d.savedAt > MAX_AGE) {
      localStorage.removeItem(key);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

function write(key: string, draft: PostDraft | null) {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
  } catch {
    // 저장소가 가득 찼거나 막혀 있으면 임시저장 없이 쓴다
  }
}

/** 남아 있는 임시저장 (처음 값과 같으면 없는 것으로 본다). target: 새 글은 'new.{채널}', 수정은 'edit.{글 번호}' */
export function readDraft(target: string, initial: Omit<PostDraft, 'savedAt'>): PostDraft | null {
  const d = read(keyFor(target));
  return d && !same(d, initial) ? d : null;
}

/** value 가 바뀌면 잠시 뒤 임시저장한다. 처음 값(initial)과 같아지면 지운다 */
export function usePostDraft(target: string, value: Omit<PostDraft, 'savedAt'>, initial: Omit<PostDraft, 'savedAt'>) {
  const key = keyFor(target);
  const done = useRef(false);
  const dirty = !same(value, initial);
  useEffect(() => {
    if (done.current) return;
    const t = window.setTimeout(() => write(key, dirty ? { ...value, savedAt: Date.now() } : null), 400);
    return () => window.clearTimeout(t);
    // value 의 각 칸이 바뀔 때만 다시 저장한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dirty, value.title, value.content, value.categoryId]);

  return {
    dirty,
    /** 다 올렸을 때: 지우고 더는 저장하지 않는다 */
    clear() {
      done.current = true;
      write(key, null);
    },
  };
}

function same(a: Omit<PostDraft, 'savedAt'>, b: Omit<PostDraft, 'savedAt'>) {
  return a.title === b.title && a.content === b.content && a.categoryId === b.categoryId;
}
