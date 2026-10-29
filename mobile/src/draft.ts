import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { authStore } from '@loop/shared';

/**
 * 글쓰기 임시저장 (웹 web/src/lib/draft.ts 와 같은 규칙): 쓰는 동안 기기에 자동으로 저장해 두고, 다시 열면 이어서 쓴다.
 * 뒤로가기 · 실수로 닫기 · 로그인 만료로 화면을 떠나도 쓰던 글이 남는다. 같은 기기를 다른 사람이 쓸 수 있으니 계정마다 따로 둔다.
 * 기기에서는 앱 문서 폴더의 작은 JSON 파일, 브라우저 미리보기에서는 localStorage
 */
export interface PostDraft {
  channel?: string;
  title: string;
  content: string;
  categoryId: number | null;
  savedAt: number;
}
type Value = Omit<PostDraft, 'savedAt'>;

/** 오래된 임시저장은 버린다 (30일) */
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const keyFor = (target: string) => `${authStore.getUser()?.id ?? 'guest'}.${target}`.replace(/[^\w.-]/g, '_');

const store =
  Platform.OS === 'web'
    ? {
        get: (k: string) => globalThis.localStorage?.getItem(`loop.draft.${k}`) ?? null,
        set: (k: string, v: string | null) =>
          v == null ? globalThis.localStorage?.removeItem(`loop.draft.${k}`) : globalThis.localStorage?.setItem(`loop.draft.${k}`, v),
      }
    : {
        get: (k: string) => {
          const f = new File(Paths.document, 'drafts', `${k}.json`);
          return f.exists ? f.textSync() : null;
        },
        set: (k: string, v: string | null) => {
          const dir = new Directory(Paths.document, 'drafts');
          const f = new File(dir, `${k}.json`);
          if (v == null) {
            if (f.exists) f.delete();
            return;
          }
          if (!dir.exists) dir.create({ intermediates: true });
          if (!f.exists) f.create();
          f.write(v);
        },
      };

function read(key: string): PostDraft | null {
  try {
    const raw = store.get(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as PostDraft;
    if (typeof d.title !== 'string' || typeof d.content !== 'string' || Date.now() - d.savedAt > MAX_AGE) {
      store.set(key, null);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

function write(key: string, draft: PostDraft | null) {
  try {
    store.set(key, draft ? JSON.stringify(draft) : null);
  } catch {
    // 저장에 실패해도 글쓰기는 그대로 된다
  }
}

const same = (a: Value, b: Value) => a.title === b.title && a.content === b.content && a.categoryId === b.categoryId && (a.channel ?? '') === (b.channel ?? '');

/** 남아 있는 임시저장 (처음 값과 같으면 없는 것으로 본다). target: 새 글은 'new', 수정은 'edit.{글 번호}' */
export function readDraft(target: string, initial: Value): PostDraft | null {
  const d = read(keyFor(target));
  return d && !same(d, initial) ? d : null;
}

/** 제목 · 본문을 하나라도 쓰면(처음 값과 다르면) 잠시 뒤 임시저장한다. 처음 값으로 돌아가면 지운다 */
export function usePostDraft(target: string, value: Value, initial: Value) {
  const key = keyFor(target);
  const done = useRef(false);
  // 채널 · 카테고리만 고른 것은 쓴 내용이 아니다
  const dirty = value.title !== initial.title || value.content !== initial.content;
  // 한 번도 쓰지 않았으면 저장소를 건드리지 않는다 (열자마자 남아 있던 임시저장을 지우지 않게)
  const touched = useRef(false);
  if (dirty) touched.current = true;
  useEffect(() => {
    if (done.current || !touched.current) return;
    const t = setTimeout(() => write(key, dirty ? { ...value, savedAt: Date.now() } : null), 500);
    return () => clearTimeout(t);
    // value 의 각 칸이 바뀔 때만 다시 저장한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dirty, value.title, value.content, value.categoryId, value.channel]);

  return {
    dirty,
    /** 다 올렸거나 버리기로 했을 때: 지우고 더는 저장하지 않는다 */
    clear() {
      done.current = true;
      write(key, null);
    },
  };
}
