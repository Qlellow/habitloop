import { useDeferredValue, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFeed } from '../api/queries';
import { Main, SubHeader } from '../components/Layout';
import { PostList } from '../components/PostList';
import ui from '../components/ui.module.css';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  const [keyword, setKeyword] = useState(input.trim());

  // 타이핑할 때마다 요청하지 않도록 300ms 디바운스
  useEffect(() => {
    const t = setTimeout(() => {
      const q = input.trim();
      setKeyword(q);
      setParams(q ? { q } : {}, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [input, setParams]);

  const deferred = useDeferredValue(keyword);
  const feed = useFeed({ q: deferred }, deferred.length > 0);

  return (
    <>
      <SubHeader title="검색" />
      <Main>
        <div style={{ padding: '4px 8px 12px' }}>
          <label htmlFor="search" className="sr-only">
            검색어
          </label>
          <input
            id="search"
            type="search"
            className={ui.input}
            placeholder="제목으로 검색해 보세요"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            enterKeyHint="search"
          />
        </div>
        {deferred && (
          <section className={ui.card}>
            <PostList query={feed} empty={`'${deferred}'에 대한 검색 결과가 없어요`} />
          </section>
        )}
      </Main>
    </>
  );
}
