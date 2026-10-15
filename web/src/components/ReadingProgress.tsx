import { useEffect, useRef, useState } from 'react';
import { expandPostBody } from './CollapsibleBody';
import { CheckIcon } from './Icons';
import { SCROLL_OFFSET, smoothScrollTo } from '../lib/scroll';
import { cn } from '../lib/cn';

/**
 * 읽기 진행도: 스크롤해야 하는 글을 읽는 동안 헤더 아래 막대와 오른쪽 아래 원이 함께 차오르고,
 * 읽던 위치를 이 브라우저에 기억한다. 다시 들어오면 '이어 읽기'를 눌러 그 자리로 부드럽게 돌아간다
 * (접힌 본문이면 먼저 펼친다). 처음 한 번은 원 옆에 무엇인지 알려 주는 말풍선을 띄운다.
 */

const KEY = 'loop.read';
/** 안내 말풍선을 본 적 있는지 */
const INTRO_KEY = 'loop.read.intro';
const INTRO_MS = 7000;
/** 기억해 둘 글 수 (오래된 것부터 지운다) */
const KEEP = 100;
/** 본문이 화면 높이의 이 배수보다 길면(스크롤해야 다 읽으면) 보여 준다 */
const LONG = 0.8;
const R = 18;
const CIRCLE = 2 * Math.PI * R;

type Saved = Record<string, { r: number; t: number }>;

function loadAll(): Saved {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved) ?? {};
  } catch {
    return {};
  }
}

function save(postId: number, r: number) {
  try {
    const all = loadAll();
    all[postId] = { r: Math.round(r * 1000) / 1000, t: Date.now() };
    const ids = Object.keys(all);
    if (ids.length > KEEP)
      ids
        .sort((a, b) => all[a].t - all[b].t)
        .slice(0, ids.length - KEEP)
        .forEach((k) => delete all[k]);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // 저장소를 못 쓰면 기억하지 않는다
  }
}

/** 본문(#post-body) 위치와 길이. full: 접혀 있어도 전체 높이, shown: 지금 보이는 높이 */
function measure() {
  const wrap = document.getElementById('post-body');
  const inner = wrap?.firstElementChild as HTMLElement | null;
  if (!wrap || !inner) return undefined;
  return {
    top: wrap.getBoundingClientRect().top + window.scrollY,
    full: inner.offsetHeight,
    shown: wrap.clientHeight,
  };
}

export function ReadingProgress({ postId }: { postId: number }) {
  const [long, setLong] = useState(false);
  const [read, setRead] = useState(0);
  const [resume, setResume] = useState<number>();
  const [intro, setIntro] = useState(false);
  const resumeRef = useRef<number | undefined>(undefined);
  resumeRef.current = resume;

  // 처음 보는 사람에게 한 번만: 이 원이 무엇인지 알려 준다
  useEffect(() => {
    if (!long) return;
    try {
      if (localStorage.getItem(INTRO_KEY)) return;
      localStorage.setItem(INTRO_KEY, '1');
    } catch {
      return;
    }
    // 원이 떠오른 다음에 말풍선을
    const show = window.setTimeout(() => setIntro(true), 600);
    const hide = window.setTimeout(() => setIntro(false), 600 + INTRO_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [long]);

  // 다시 들어왔으면: 읽다 만 글(5% ~ 95%)이고 아직 그 앞이면 이어 읽기를 띄운다
  useEffect(() => {
    const saved = loadAll()[postId]?.r;
    setResume(saved != null && saved > 0.05 && saved < 0.95 ? saved : undefined);
  }, [postId]);

  useEffect(() => {
    let raf = 0;
    let lastSave = 0;
    let saveTimer = 0;
    const update = () => {
      raf = 0;
      const m = measure();
      if (!m || !m.full) return;
      const isLong = m.full > window.innerHeight * LONG;
      setLong(isLong);
      if (!isLong) return;
      // 처음(맨 위)은 0, 본문 끝이 화면 아래에 닿으면 100 (접혀 있으면 보이는 곳까지만 차오른다)
      const end = m.top + m.full - window.innerHeight;
      const scrolled = Math.min(window.scrollY, m.top + m.shown - window.innerHeight);
      const ratio = end > 0 ? Math.max(0, Math.min(1, scrolled / end)) : 1;
      setRead(ratio > 0.985 ? 1 : ratio);
      // 기억할 위치: 화면 맨 위(헤더 바로 아래)가 본문의 어디쯤인지. 다 읽었으면 1
      const at = ratio > 0.985 ? 1 : Math.max(0, (window.scrollY + SCROLL_OFFSET - m.top) / m.full);
      // 이어 읽을 자리를 지나쳤으면 이어 읽기는 내린다
      if (resumeRef.current != null && at >= resumeRef.current - 0.02) setResume(undefined);
      // 들어오자마자(맨 위) 저장하면 기억해 둔 자리를 덮어쓰니, 이어 읽기를 띄운 동안에는 저장하지 않는다
      if (resumeRef.current != null || at <= 0) return;
      const doSave = () => {
        lastSave = Date.now();
        save(postId, at);
      };
      clearTimeout(saveTimer);
      if (Date.now() - lastSave > 800) doSave();
      else saveTimer = window.setTimeout(doSave, 800);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // 이미지가 늦게 불러와지거나 본문을 펼치면 길이가 바뀐다
    const wrap = document.getElementById('post-body');
    const ro = new ResizeObserver(schedule);
    if (wrap) {
      ro.observe(wrap);
      if (wrap.firstElementChild) ro.observe(wrap.firstElementChild);
    }
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(saveTimer);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
    };
  }, [postId]);

  const goResume = async () => {
    const r = resume;
    if (r == null) return;
    await expandPostBody();
    const m = measure();
    setResume(undefined);
    if (m) smoothScrollTo(m.top + r * m.full - SCROLL_OFFSET, 900);
  };

  if (!long) return null;
  const pct = Math.round(read * 100);
  const done = read >= 1;
  return (
    <>
      {/* 헤더 바로 아래 얇은 막대: 어디서든 한눈에 보인다 */}
      <div className={cn('read-bar', done && 'is-done')} aria-hidden>
        <i style={{ transform: `scaleX(${read})` }} />
      </div>
      <div className={cn('read-progress', done && 'is-done')} data-fx-off="">
        {intro && resume == null && (
          <div className="read-intro" role="status" onClick={() => setIntro(false)}>
            <b>읽기 진행도</b>
            읽은 만큼 차올라요. 중간에 나가도 다음에 읽던 곳부터 이어 읽을 수 있어요.
          </div>
        )}
        {resume != null && (
          <div className="read-resume">
            <button type="button" className="read-resume-go" onClick={goResume}>
              이어 읽기 <b>{Math.round(resume * 100)}%</b>
            </button>
            <button type="button" className="read-resume-x" aria-label="이어 읽기 닫기" onClick={() => setResume(undefined)}>
              ×
            </button>
          </div>
        )}
        <div
          className="read-ring"
          role="progressbar"
          aria-label="읽은 정도"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          title={done ? '다 읽었어요' : `${pct}% 읽었어요`}
        >
          <svg viewBox="0 0 44 44" aria-hidden>
            <circle className="read-ring-track" cx="22" cy="22" r={R} />
            <circle className="read-ring-fill" cx="22" cy="22" r={R} strokeDasharray={CIRCLE} strokeDashoffset={CIRCLE * (1 - read)} />
          </svg>
          <span className="read-ring-label">
            {done ? (
              <CheckIcon />
            ) : (
              <span>
                {pct}
                <small>%</small>
              </span>
            )}
          </span>
        </div>
      </div>
    </>
  );
}
