import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { compact, useChannels, type ChannelSummary } from '@loop/shared';
import { ChannelIcon } from './ChannelIcon';
import { SearchIcon } from './Icons';
import { preload } from '../lib/preload';
import { ui } from './ui';
import { cn } from '../lib/cn';
import s from './ChannelSearch.styles';

/** 이름에서 검색어와 겹치는 부분을 굵게 */
function Highlight({ text, keyword }: { text: string; keyword: string }) {
  const at = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (!keyword || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className={s.mark}>{text.slice(at, at + keyword.length)}</mark>
      {text.slice(at + keyword.length)}
    </>
  );
}

/**
 * 헤더의 채널 검색. 입력하는 동안 채널 이름에 검색어가 들어간 채널을 드롭다운으로 보여 준다.
 * 타이핑마다 요청하지 않도록 150ms 디바운스, 같은 검색어는 캐시에서 바로 보여 준다.
 * 키보드: ↑/↓ 이동, Enter 이동(선택이 없으면 전체 결과 페이지), Esc 닫기.
 */
export function ChannelSearch() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const t = setTimeout(() => setKeyword(input.trim()), 150);
    return () => clearTimeout(t);
  }, [input]);

  // 다른 페이지로 가면 닫고 비운다
  useEffect(() => {
    setOpen(false);
    setInput('');
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const { data, isFetching } = useChannels(keyword);
  // 비어 있는 검색어일 때 오는 "인기 채널"은 쓰지 않는다
  const results: ChannelSummary[] = keyword ? (data ?? []) : [];
  const showMenu = open && input.trim().length > 0;
  const stale = keyword !== input.trim(); // 디바운스 중이거나 요청 중
  const allResultsIndex = results.length; // 마지막 항목: 결과 모두 보기

  useEffect(() => setActive(-1), [keyword]);

  // 키보드로 움직이면 선택된 항목이 보이도록 스크롤
  useEffect(() => {
    if (active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (to: string) => {
    setOpen(false);
    setInput('');
    inputRef.current?.blur();
    navigate(to);
  };
  const goAll = () => go(`/channels?q=${encodeURIComponent(input.trim())}`);

  const onKeyDown = (e: KeyboardEvent) => {
    const last = allResultsIndex;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setOpen(true);
        setActive((i) => (i >= last ? 0 : i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => (i <= 0 ? last : i - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (!input.trim()) return;
        // 결과가 아직 이전 검색어 것이면(디바운스 중) 고르지 않고 전체 결과로 간다
        if (!stale && active >= 0 && active < results.length) go(`/c/${results[active].slug}`);
        else goAll();
        break;
      case 'Escape':
        if (showMenu) setOpen(false);
        else setInput('');
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div className={s.root} ref={rootRef}>
      <SearchIcon className={s.icon} />
      <input
        ref={inputRef}
        className={cn(ui.input, s.input)}
        type="search"
        role="combobox"
        aria-label="채널 검색"
        aria-expanded={showMenu}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showMenu && active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="채널 검색"
        value={input}
        autoComplete="off"
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
          // 새로 입력하면 이전 검색어 결과에서 고른 항목은 버린다 (Enter 가 옛 결과로 가지 않게)
          setActive(-1);
        }}
        onFocus={() => {
          setOpen(true);
          preload.channel();
        }}
        onKeyDown={onKeyDown}
      />
      {showMenu && (
        <div className={s.menu}>
          <ul className={s.list} id={listId} role="listbox" aria-label="채널 검색 결과" ref={listRef}>
            {results.map((c, i) => (
              <li
                key={c.slug}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={active === i}
                className={cn(s.item, active === i && s.active)}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()} // 입력창 포커스 유지
                onClick={() => go(`/c/${c.slug}`)}
              >
                <ChannelIcon slug={c.slug} name={c.name} size={32} />
                <span className={s.body}>
                  <span className={s.name}>
                    <Highlight text={c.name} keyword={keyword} />
                  </span>
                  <span className={s.meta}>
                    c/{c.slug} · 멤버 {compact(c.memberCount)} · 글 {compact(c.postCount)}
                  </span>
                </span>
              </li>
            ))}
            {results.length === 0 && (
              <li className={s.empty} role="presentation">
                {stale || isFetching ? '찾는 중…' : `'${input.trim()}'이(가) 들어간 채널이 없어요`}
              </li>
            )}
            <li
              id={`${listId}-${allResultsIndex}`}
              data-index={allResultsIndex}
              role="option"
              aria-selected={active === allResultsIndex}
              className={cn(s.all, active === allResultsIndex && s.allActive)}
              onMouseEnter={() => setActive(allResultsIndex)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={goAll}
            >
              '{input.trim()}' 채널 검색 결과 모두 보기 →
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
