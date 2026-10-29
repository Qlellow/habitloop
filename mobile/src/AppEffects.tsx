import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { checkAttendance, markBadgesSeen, useAuth, useUnseenBadges } from '@loop/shared';
import { toast } from './Toast';
import { notificationUrl, registerPush, unregisterPush } from './push';

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/**
 * 앱 전체에서 한 번씩 하는 일 (화면은 없다)
 *  - 하루 한 번 출석 체크 (서버도 하루 한 번만 준다)
 *  - 새로 받은 배지를 알리고 본 것으로 표시
 *  - 푸시 알림: 로그인하면 이 기기 등록, 로그아웃하면 해제, 알림을 누르면 그 글로
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

  // 로그인 · 로그아웃(만료 포함)에 맞춰 이 기기의 푸시 토큰을 등록 · 해제한다
  const pushedFor = useRef<string | null>(null);
  useEffect(() => {
    const id = user?.id ?? null;
    if (id === pushedFor.current) return;
    if (id) void registerPush();
    else if (pushedFor.current) void unregisterPush();
    pushedFor.current = id;
  }, [user?.id]);

  // 알림을 누르면 그 글로 (앱이 꺼져 있다가 알림으로 열린 경우도)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (url?: string) => url && router.push(url as never);
    void Notifications.getLastNotificationResponseAsync().then((r) => open(notificationUrl(r)));
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(notificationUrl(r)));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!unseen?.length) return;
    unseen.forEach((b) => toast(`${b.icon} 새 배지 '${b.name}'을 받았어요!`, { onPress: () => router.push('/badges') }));
    void markBadgesSeen().catch(() => undefined);
  }, [unseen]);

  return null;
}
