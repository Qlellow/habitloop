import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useFeed } from '../api/queries';
import { authStore, useAuth } from '../auth/authStore';
import { Main, SubHeader } from '../components/Layout';
import { PostList } from '../components/PostList';
import ui from '../components/ui.module.css';
import s from './PostDetail.module.css';

export default function MyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const feed = useFeed({ authorId: user?.id }, user != null);

  if (!user) return null;

  const logout = () => {
    authStore.signOut();
    qc.removeQueries({ queryKey: ['post'] });
    qc.removeQueries({ queryKey: ['comments'] });
    navigate('/', { replace: true });
  };

  return (
    <>
      <SubHeader title="내 정보" />
      <Main>
        <section className={ui.card} style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className={s.avatar} style={{ width: 52, height: 52, fontSize: 20 }} aria-hidden>
            {user.nickname.slice(0, 1)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-strong)' }}>{user.nickname}</div>
            <div style={{ fontSize: 14, color: 'var(--text-weak)' }}>{user.email}</div>
          </div>
          <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={logout}>
            로그아웃
          </button>
        </section>
        <section className={ui.card} style={{ marginTop: 12 }}>
          <h2 className={ui.sectionTitle}>내가 쓴 글</h2>
          <PostList query={feed} empty="아직 작성한 글이 없어요" />
        </section>
      </Main>
    </>
  );
}
