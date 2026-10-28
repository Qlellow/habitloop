import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { checkAttendance, markBadgesSeen, useAuth, useUnseenBadges } from '@loop/shared';
import { toast } from './Toast';

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/**
 * 앱 전체에서 한 번씩 하는 일 (화면은 없다)
 *  - 하루 한 번 출석 체크 (서버도 하루 한 번만 준다)
 *  - 새로 받은 배지를 알리고 본 것으로 표시
 */
export function AppEffects() {
  const { user } = useAuth();
  const attended = useRef<string>(undefined);
  const unseen = useUnseenBadges(!!user).data;

  useEffect(() => {
    if (!user) return;
    const key = `${user.id}:${kstToday()}`;
    if (attended.current === key) return;
    attended.current = key;
    checkAttendance()
      .then((r) => r.awarded && toast(r.earned > 10 ? `${r.streak}일 연속 출석! +${r.earned}P` : `출석 체크 +${r.earned}P · ${r.streak}일 연속`))
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!unseen?.length) return;
    unseen.forEach((b) => toast(`${b.icon} 새 배지 '${b.name}'을 받았어요!`, { onPress: () => router.push('/badges') }));
    void markBadgesSeen().catch(() => undefined);
  }, [unseen]);

  return null;
}
