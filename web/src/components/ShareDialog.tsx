import { useEffect, useMemo, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@loop/shared';
import { CloseIcon } from './Icons';
import { Modal } from './Modal';
import { toast } from './Toast';
import { ui } from './ui';
import { cn } from '../lib/cn';

/** 공유할 내용: 주소 · 제목 · 한두 줄 설명 */
export interface ShareContent {
  url: string;
  title: string;
  text: string;
}

const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';

interface KakaoSdk {
  isInitialized(): boolean;
  init(key: string): void;
  Share: { sendDefault(options: object): void };
}
declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

/** 카카오톡 공유는 카카오 JavaScript SDK 가 필요하다 (VITE_KAKAO_JS_KEY 가 있을 때만, 처음 누를 때 받아 온다) */
let kakaoLoading: Promise<KakaoSdk> | undefined;
function loadKakao(key: string): Promise<KakaoSdk> {
  kakaoLoading ??= new Promise<KakaoSdk>((resolve, reject) => {
    const done = () => {
      const k = window.Kakao;
      if (!k) return reject(new Error('카카오 SDK 를 불러오지 못했어요'));
      if (!k.isInitialized()) k.init(key);
      resolve(k);
    };
    if (window.Kakao) return done();
    const script = document.createElement('script');
    script.src = KAKAO_SDK;
    script.async = true;
    script.onload = done;
    script.onerror = () => {
      kakaoLoading = undefined;
      reject(new Error('카카오 SDK 를 불러오지 못했어요'));
    };
    document.head.appendChild(script);
  });
  return kakaoLoading;
}

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const copyText = (text: string, done: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast(done),
    () => toast('복사하지 못했어요. 직접 선택해서 복사해 주세요'),
  );

/* ───── 앱 아이콘 (각 서비스 색 · 모양을 단순하게) ───── */
const g = (children: ReactElement | ReactElement[], viewBox = '0 0 24 24') => (
  <svg width="26" height="26" viewBox={viewBox} aria-hidden>
    {children}
  </svg>
);
const ICONS = {
  kakao: g(
    <path
      fill="#000"
      fillOpacity=".9"
      d="M12 3C6.48 3 2 6.48 2 10.78c0 2.78 1.86 5.22 4.66 6.6-.2.74-.74 2.69-.85 3.1-.13.52.19.51.4.37.17-.11 2.62-1.78 3.68-2.5.69.1 1.39.15 2.11.15 5.52 0 10-3.48 10-7.72S17.52 3 12 3z"
    />,
  ),
  sms: g(<path fill="#fff" d="M12 3.5c-5 0-9 3.3-9 7.4 0 2.3 1.3 4.4 3.3 5.8l-.8 3.2 3.6-1.9c.9.2 1.9.3 2.9.3 5 0 9-3.3 9-7.4S17 3.5 12 3.5z" />),
  email: g(
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <path d="M4 7l8 6 8-6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
    </>,
  ),
  x: g(<path fill="#fff" d="M17.6 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5 21H1.9l7.3-8.3L1.5 3h6.4l4.4 5.9L17.6 3zm-1.1 16.2h1.7L7.6 4.7H5.8l10.7 14.5z" />),
  facebook: g(<path fill="#fff" d="M13.5 21v-7.6h2.6l.4-3h-3v-1.9c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1z" />),
  line: g(
    <>
      <path fill="#fff" d="M12 3.5c-5.2 0-9.5 3.4-9.5 7.6 0 3.8 3.4 6.9 7.9 7.5.3.1.7.2.8.5.1.2.1.6 0 .8l-.1.8c0 .2-.2.9.8.5s5.4-3.2 7.4-5.4c1.4-1.5 2.1-3.1 2.1-4.7 0-4.2-4.3-7.6-9.4-7.6z" />
      <text x="12" y="13" textAnchor="middle" fontSize="5.2" fontWeight="800" fill="#06C755" fontFamily="Arial, sans-serif">
        LINE
      </text>
    </>,
  ),
  telegram: g(<path fill="#fff" d="M20.7 4.3 2.9 11.2c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 1.7 5.4c.2.6.4.8.8.8s.6-.2.9-.5l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l3-14.2c.3-1.2-.5-1.8-1.4-1.4zM9.6 14.3l8.6-5.4c.4-.3.8-.1.5.2l-7 6.3-.3 3.1-1.8-4.2z" />),
  discord: g(<path fill="#fff" d="M19.3 5.4A17 17 0 0 0 15.1 4l-.5 1a15.7 15.7 0 0 0-5.2 0l-.5-1a17 17 0 0 0-4.2 1.4C2 9.4 1.3 13.3 1.6 17.1a17 17 0 0 0 5.2 2.6l1.1-1.8c-.6-.2-1.2-.5-1.7-.9l.4-.3a12.2 12.2 0 0 0 10.8 0l.4.3c-.5.4-1.1.7-1.7.9l1.1 1.8a17 17 0 0 0 5.2-2.6c.4-4.4-.7-8.3-3.1-11.7zM8.5 14.8c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2zm7 0c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2z" />),
  instagram: g(
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="#fff" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="1.9" />
      <circle cx="17.3" cy="6.7" r="1.2" fill="#fff" />
    </>,
  ),
  more: g(
    <>
      <circle cx="6" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="18" cy="12" r="1.8" fill="currentColor" />
    </>,
  ),
};

interface Target {
  id: string;
  label: string;
  icon: ReactElement;
  bg: string;
  run: (c: ShareContent) => void | Promise<void>;
}

const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer,width=600,height=640');
const enc = encodeURIComponent;
const message = (c: ShareContent) => `${c.text}\n${c.url}`;

/** 웹 공유 주소가 없는 앱(디스코드 · 인스타그램)은 휴대폰이면 공유 시트, 아니면 링크 복사 */
const viaSheetOrCopy = (app: string) => async (c: ShareContent) => {
  if (isMobile() && navigator.share) {
    await navigator.share({ title: c.title, text: c.text, url: c.url }).catch(() => undefined);
  } else {
    await copyText(message(c), `링크를 복사했어요. ${app}에 붙여 넣어 주세요`);
  }
};

function targets(kakaoKey: string | null | undefined): Target[] {
  const list: Target[] = [];
  if (kakaoKey) {
    list.push({
      id: 'kakao',
      label: '카카오톡',
      icon: ICONS.kakao,
      bg: 'bg-[#FEE500]',
      run: async (c) => {
        try {
          const kakao = await loadKakao(kakaoKey);
          kakao.Share.sendDefault({
            objectType: 'text',
            text: `${c.title}\n${c.text}`,
            link: { mobileWebUrl: c.url, webUrl: c.url },
            buttonTitle: '루프 시작하기',
          });
        } catch (e) {
          toast((e as Error).message);
        }
      },
    });
  }
  if (isMobile()) {
    list.push({
      id: 'sms',
      label: '메시지',
      icon: ICONS.sms,
      bg: 'bg-[#34C759]',
      run: (c) => void (location.href = `sms:${isIOS() ? '&' : '?'}body=${enc(message(c))}`),
    });
  }
  list.push(
    { id: 'discord', label: '디스코드', icon: ICONS.discord, bg: 'bg-[#5865F2]', run: viaSheetOrCopy('디스코드') },
    {
      id: 'instagram',
      label: '인스타그램',
      icon: ICONS.instagram,
      bg: 'bg-[linear-gradient(45deg,#F58529,#DD2A7B_50%,#8134AF_80%,#515BD4)]',
      run: viaSheetOrCopy('인스타그램 메시지'),
    },
    { id: 'x', label: 'X', icon: ICONS.x, bg: 'bg-black', run: (c) => void open(`https://x.com/intent/post?text=${enc(c.text)}&url=${enc(c.url)}`) },
    {
      id: 'facebook',
      label: '페이스북',
      icon: ICONS.facebook,
      bg: 'bg-[#1877F2]',
      run: (c) => void open(`https://www.facebook.com/sharer/sharer.php?u=${enc(c.url)}`),
    },
    {
      id: 'line',
      label: '라인',
      icon: ICONS.line,
      bg: 'bg-[#06C755]',
      run: (c) => void open(`https://social-plugins.line.me/lineit/share?url=${enc(c.url)}`),
    },
    {
      id: 'telegram',
      label: '텔레그램',
      icon: ICONS.telegram,
      bg: 'bg-[#26A5E4]',
      run: (c) => void open(`https://t.me/share/url?url=${enc(c.url)}&text=${enc(c.text)}`),
    },
    {
      id: 'email',
      label: '이메일',
      icon: ICONS.email,
      bg: 'bg-[#6B7684]',
      run: (c) => void (location.href = `mailto:?subject=${enc(c.title)}&body=${enc(message(c))}`),
    },
  );
  // 휴대폰 · 일부 PC 브라우저: 기기의 공유 시트 (설치된 모든 앱)
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    list.push({
      id: 'more',
      label: '더보기',
      icon: ICONS.more,
      bg: 'bg-field text-fg-sub',
      run: (c) => navigator.share({ title: c.title, text: c.text, url: c.url }).catch(() => undefined),
    });
  }
  return list;
}

/**
 * 공유 창 (유튜브 공유처럼): 앱 아이콘 한 줄 + 아래에 링크 복사.
 * 카카오톡만 카카오 SDK(서버 환경 변수 KAKAO_JS_KEY)가 필요하고, 나머지는 각 서비스의 공유 주소 · 기기 공유 시트를 쓴다.
 */
export function ShareDialog({ content, heading = '공유하기', onClose }: { content: ShareContent; heading?: string; onClose: () => void }) {
  // 카카오 키는 서버 환경 변수(KAKAO_JS_KEY)에서 받는다. 받기 전에는 카카오톡 없이 나머지만 보여 준다
  const kakaoKey = useQuery({
    queryKey: ['kakao-js-key'],
    queryFn: ({ signal }) => api<{ key: string | null }>('/api/share/kakao-key', { signal }),
    staleTime: Infinity,
  }).data?.key;
  const list = useMemo(() => targets(kakaoKey), [kakaoKey]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Modal onClose={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="w-full max-w-[520px] rounded-xl border border-border bg-surface shadow-pop">
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-2">
          <h2 id="share-title" className="m-0 text-lg font-bold text-fg-strong">
            {heading}
          </h2>
          <button type="button" className={cn(ui.button, ui.text, ui.small, 'w-8 px-0')} aria-label="닫기" onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        {/* 앱이 많으면 옆으로 넘겨 본다 */}
        <ul className="list-none m-0 px-4 pt-2 pb-4 flex gap-1 overflow-x-auto [scrollbar-width:thin]">
          {list.map((t) => (
            <li key={t.id} className="flex-none">
              <button
                type="button"
                onClick={() => void t.run(content)}
                className="group flex flex-col items-center gap-1.5 w-[72px] py-2 rounded-lg hover:bg-pressed focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className={cn('grid place-items-center w-12 h-12 rounded-full transition-transform group-hover:scale-105 group-active:scale-95', t.bg)}>
                  {t.icon}
                </span>
                <span className="text-[12px] text-fg-sub whitespace-nowrap">{t.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 mx-6 mb-6 p-1.5 pl-3.5 rounded-md bg-field">
          <input
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-fg"
            readOnly
            value={content.url}
            aria-label="공유할 주소"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="button" className={cn(ui.button, ui.primary, ui.small)} onClick={() => void copyText(content.url, '링크를 복사했어요')}>
            복사
          </button>
        </div>
      </div>
    </Modal>
  );
}
