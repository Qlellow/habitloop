import { cookies } from 'next/headers';
import { apiFetch } from '@/lib/api';
import { createHabit } from './actions';
import CheckInButton from './CheckInButton';

type Habit = { id: number; title: string; emoji: string | null };

export default async function HabitsPage() {
  const token = cookies().get('token')?.value;
  if (!token) {
    return (
      <div>
        <h1>내 습관</h1>
        <p>먼저 <a href="/login" style={{ color: '#7ce0c6' }}>로그인</a>해주세요.</p>
      </div>
    );
  }

  const habits: Habit[] = await apiFetch('/habits', token);
  const streaks = await Promise.all(
    habits.map((h) => apiFetch(`/habits/${h.id}/checkins/streak`, token)),
  );

  return (
    <div>
      <h1>내 습관</h1>
      <form action={createHabit} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input name="emoji" placeholder="🏃" style={{ width: 48 }} />
        <input name="title" placeholder="새 습관 (예: 물 2L 마시기)" style={{ flex: 1 }} />
        <button type="submit">추가</button>
      </form>

      {habits.length === 0 && <p style={{ color: '#9aa0ac' }}>아직 습관이 없어요. 하나 추가해보세요.</p>}

      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {habits.map((h, i) => (
          <li
            key={h.id}
            style={{
              border: '1px solid #262933',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 18 }}>
                {h.emoji ?? '🔁'} {h.title}
              </div>
              <div style={{ color: '#9aa0ac', fontSize: 13 }}>🔥 {streaks[i]?.streak ?? 0}일 연속</div>
            </div>
            <CheckInButton habitId={h.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
