import { useSearchParams } from 'react-router-dom';
import { useAuth, useFeed, useSavedPosts } from '@loop/shared';
import { PostList } from '../../components/PostList';
import { ui } from '../../components/ui';
import s from './my.styles';

/** 내가 쓴 글 · 저장한 글 (탭은 주소의 ?tab=saved 로 기억한다) */
export default function MyPostsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const saved = params.get('tab') === 'saved';
  const feed = useFeed({ authorId: user?.id }, user != null && !saved);
  const bookmarks = useSavedPosts(user != null && saved);
  return (
    <>
      <div className={s.head}>
        <h1 className={s.title}>{saved ? '저장한 글' : '내가 쓴 글'}</h1>
        <p className={s.desc}>{saved ? '글 보기에서 저장을 누른 글을 최근에 저장한 순서로 모았어요.' : '내가 여러 채널에 쓴 글을 최신순으로 모았어요.'}</p>
      </div>
      <div className={ui.tabs} role="tablist">
        <button type="button" role="tab" className={ui.tab} aria-selected={!saved} onClick={() => setParams({}, { replace: true })}>
          내가 쓴 글
        </button>
        <button type="button" role="tab" className={ui.tab} aria-selected={saved} onClick={() => setParams({ tab: 'saved' }, { replace: true })}>
          저장한 글
        </button>
      </div>
      <section className={ui.card}>
        {saved ? (
          <PostList query={bookmarks} empty="아직 저장한 글이 없어요. 글 보기에서 '저장'을 누르면 여기 모여요." />
        ) : (
          <PostList query={feed} empty="아직 작성한 글이 없어요. 팔로우한 채널에서 첫 글을 써 보세요!" />
        )}
      </section>
    </>
  );
}
