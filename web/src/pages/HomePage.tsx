import { Link } from 'react-router-dom';
import { useAuth, useFeed } from '@loop/shared';
import { Page } from '../components/Layout';
import { PostList } from '../components/PostList';
import { ChannelSidebar, PopularCard } from '../components/Sidebar';
import { preload } from '../lib/preload';
import { ui } from '../components/ui';
import { cn } from '../lib/cn';

export function MakeChannelCard() {
  const { isLoggedIn } = useAuth();
  const to = isLoggedIn ? '/channels/new' : '/login?next=/channels/new';
  return (
    <section className={ui.card} style={{ padding: 20 }}>
      <h2 className={ui.sectionTitle} style={{ fontSize: 16 }}>
        나만의 채널을 만들어 보세요
      </h2>
      <p style={{ margin: '6px 0 14px', fontSize: 14, color: 'var(--text-sub)' }}>
        좋아하는 주제로 사람들이 모이는 공간을 만들 수 있어요.
      </p>
      <Link to={to} className={cn(ui.button, ui.secondary, ui.full)} onPointerEnter={preload.channelForm}>
        채널 만들기
      </Link>
    </section>
  );
}

export default function HomePage() {
  const feed = useFeed({});
  return (
    <Page
      left={<ChannelSidebar />}
      right={
        <>
          <PopularCard />
          <MakeChannelCard />
        </>
      }
    >
      <section className={ui.card}>
        <div className={ui.cardHead}>
          <h1 className={ui.sectionTitle}>전체 글</h1>
        </div>
        <PostList query={feed} empty="아직 글이 없어요. 첫 글을 남겨 보세요!" />
      </section>
    </Page>
  );
}
