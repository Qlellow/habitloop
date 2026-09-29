import { useAuth, useFeed } from '@loop/shared';
import { PostList } from '../../components/PostList';
import ui from '../../components/ui.module.css';
import s from './my.module.css';

export default function MyPostsPage() {
  const { user } = useAuth();
  const feed = useFeed({ authorId: user?.id }, user != null);
  return (
    <>
      <div className={s.head}>
        <h1 className={s.title}>내가 쓴 글</h1>
        <p className={s.desc}>내가 여러 채널에 쓴 글을 최신순으로 모았어요.</p>
      </div>
      <section className={ui.card}>
        <PostList query={feed} empty="아직 작성한 글이 없어요. 가입한 채널에서 첫 글을 써 보세요!" />
      </section>
    </>
  );
}
