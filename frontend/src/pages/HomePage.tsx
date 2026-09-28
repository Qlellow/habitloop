import { Link, useSearchParams } from 'react-router-dom';
import { useFeed, usePopular } from '../api/queries';
import { useAuth } from '../auth/authStore';
import { Main, MainHeader, layoutStyles } from '../components/Layout';
import { PencilIcon } from '../components/Icons';
import { PostList } from '../components/PostList';
import { CATEGORIES, isCategory } from '../lib/categories';
import { preload } from '../lib/preload';
import list from '../components/PostList.module.css';
import ui from '../components/ui.module.css';

function PopularSection() {
  const { data } = usePopular();
  if (!data || data.length === 0) return null;
  return (
    <section className={ui.card} style={{ marginBottom: 12 }}>
      <h2 className={ui.sectionTitle}>지금 인기 있는 글</h2>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {data.map((post, i) => (
          <li key={post.id}>
            <Link
              to={`/posts/${post.id}`}
              state={{ summary: post }}
              className={list.rankItem}
              onPointerEnter={preload.post}
            >
              <span className={list.rank}>{i + 1}</span>
              <span className={list.rankTitle}>{post.title}</span>
              <span className={list.rankLikes}>♥ {post.likeCount}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function HomePage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('category');
  const category = isCategory(raw) ? raw : undefined;
  const feed = useFeed({ category });
  const { isLoggedIn } = useAuth();

  const select = (value?: string) => {
    setParams(value ? { category: value } : {}, { replace: true });
  };

  return (
    <>
      <MainHeader />
      <Main>
        <PopularSection />
        <section className={ui.card}>
          <h2 className={ui.sectionTitle}>커뮤니티</h2>
          <div className={ui.chips} role="toolbar" aria-label="카테고리">
            <button className={ui.chip} aria-pressed={!category} onClick={() => select()}>
              전체
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                className={ui.chip}
                aria-pressed={category === c.value}
                onClick={() => select(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <PostList query={feed} empty="아직 글이 없어요. 첫 글을 남겨 보세요!" />
        </section>
      </Main>
      <Link
        to={isLoggedIn ? '/write' : '/login?next=/write'}
        className={layoutStyles.fab}
        onPointerEnter={isLoggedIn ? preload.write : preload.login}
      >
        <PencilIcon width={20} height={20} /> 글쓰기
      </Link>
    </>
  );
}
