import { useNavigate } from 'react-router-dom';
import { useAuth, useFeed, useSignOut } from '@loop/shared';
import { Footer, Page } from '../components/Layout';
import { PostList } from '../components/PostList';
import ui from '../components/ui.module.css';
import s from './pages.module.css';

export default function MyPage() {
  const { user } = useAuth();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const feed = useFeed({ authorId: user?.id }, user != null);

  if (!user) return null;

  return (
    <Page
      variant="twoRight"
      right={
        <>
          <section className={`${ui.card} ${s.profile}`}>
            <div className={s.profileAvatar} aria-hidden>
              {user.nickname.slice(0, 1)}
            </div>
            <div className={s.profileName}>{user.nickname}</div>
            <div className={s.profileEmail}>{user.email}</div>
            <button
              type="button"
              className={`${ui.button} ${ui.ghost} ${ui.full}`}
              onClick={() => {
                signOut();
                navigate('/', { replace: true });
              }}
            >
              로그아웃
            </button>
          </section>
          <Footer />
        </>
      }
    >
      <section className={ui.card}>
        <div className={ui.cardHead}>
          <h1 className={ui.sectionTitle}>내가 쓴 글</h1>
        </div>
        <PostList query={feed} empty="아직 작성한 글이 없어요" />
      </section>
    </Page>
  );
}
