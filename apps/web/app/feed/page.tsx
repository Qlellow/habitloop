import { cookies } from 'next/headers';
import { apiFetch } from '@/lib/api';
import LikeButton from './LikeButton';

type FeedItem = {
  id: number;
  date: string;
  note: string | null;
  habit: { title: string; emoji: string | null };
  user: { nickname: string };
  likes: { id: number }[];
};

export default async function FeedPage() {
  const token = cookies().get('token')?.value;
  if (!token) {
    return (
      <div>
        <h1>피드</h1>
        <p>먼저 <a href="/login" style={{ color: '#7ce0c6' }}>로그인</a>해주세요.</p>
      </div>
    );
  }

  const items: FeedItem[] = await apiFetch('/feed', token);

  return (
    <div>
      <h1>피드</h1>
      {items.length === 0 && (
        <p style={{ color: '#9aa0ac' }}>아직 피드가 비어있어요. 습관을 체크인하거나 친구를 팔로우해보세요.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item) => (
          <li key={item.id} style={{ border: '1px solid #262933', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 600 }}>{item.user.nickname}</div>
            <div>
              {item.habit.emoji ?? '🔁'} {item.habit.title} · {item.date}
            </div>
            {item.note && <p style={{ color: '#9aa0ac' }}>{item.note}</p>}
            <LikeButton checkInId={item.id} likeCount={item.likes?.length ?? 0} />
          </li>
        ))}
      </ul>
    </div>
  );
}
