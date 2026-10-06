import { useParams } from 'react-router-dom';
import { ApiError, compact, useFeed, useUserProfile } from '@loop/shared';
import { Page } from '../components/Layout';
import { PostList } from '../components/PostList';
import { ui } from '../components/ui';
import { ProfileBanner } from '../components/ProfileBanner';
import { UserAvatar } from '../components/UserAvatar';
import { cn } from '../lib/cn';
import NotFoundPage from './NotFoundPage';

const joinedAt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 가입`;
};

/** 작성자 프로필: 닉네임 · 가입일 · 글/댓글 수 + 쓴 글 목록 */
export default function UserPage() {
  const id = Number(useParams().id);
  const profile = useUserProfile(id);
  const feed = useFeed({ authorId: id }, Number.isInteger(id));

  if (!Number.isInteger(id) || (profile.error instanceof ApiError && profile.error.status === 404)) {
    return <NotFoundPage message="없는 사용자예요" />;
  }
  const user = profile.data;
  return (
    <Page variant="single">
      <section className={cn(ui.card, 'overflow-hidden')}>
        {/* 배너 위에 프로필 사진이 살짝 겹친다 */}
        <ProfileBanner banner={user?.banner} />
        {user ? (
          <div className="flex items-end gap-4 px-6 pb-6">
            <UserAvatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={88} className="-mt-11 ring-4 ring-[var(--surface)]" />
            <div className="min-w-0 pt-3">
              <h1 className="m-0 text-[22px] font-bold text-fg-strong truncate">{user.nickname}</h1>
              <p className="mt-1 mb-0 text-sm text-fg-weak">
                {joinedAt(user.createdAt)} · 글 {compact(user.postCount)} · 댓글 {compact(user.commentCount)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-6" aria-hidden>
            <span className={ui.skeleton} style={{ width: 64, height: 64, borderRadius: 999 }} />
            <span className={ui.skeleton} style={{ width: 160, height: 24 }} />
          </div>
        )}
      </section>
      <section className={ui.card}>
        <div className={ui.cardHead}>
          <h2 className={ui.sectionTitle}>쓴 글</h2>
        </div>
        <PostList query={feed} empty="아직 쓴 글이 없어요" />
      </section>
    </Page>
  );
}
