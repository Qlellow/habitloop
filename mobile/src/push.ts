import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api } from '@loop/shared';

/**
 * 푸시 알림: 로그인하면 이 기기의 Expo 푸시 토큰을 서버에 등록하고, 로그아웃하면 지운다.
 * 서버가 댓글 · 답글 · 공감 · 공지 · 오늘의 발견 알림을 만들 때 이 토큰으로 보낸다 (api/src/notifications/push.service.ts).
 * 실제 기기에서만 동작한다 (에뮬레이터 · 브라우저 미리보기는 건너뜀). 안드로이드는 EAS 에 FCM 키가 있어야 토큰이 나온다.
 */
const TOKEN_KEY = 'loop.pushToken';

// 앱을 보고 있을 때 온 알림도 위에 띄운다
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** 로그인한 뒤 한 번: 권한을 묻고 토큰을 등록한다. 거절하거나 못 받으면 조용히 넘어간다 (알림 목록은 그대로 있다) */
export async function registerPush() {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: '알림', importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await api('/api/me/push-tokens', { method: 'POST', body: { token, platform: Platform.OS } });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (e) {
    console.warn('푸시 알림을 켜지 못했어요', e);
  }
}

/** 로그아웃: 이 기기로는 더 보내지 않게 서버에서 지운다 (로그인이 이미 풀렸어도 된다) */
export async function unregisterPush() {
  if (Platform.OS === 'web') return;
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await api('/api/me/push-tokens', { method: 'DELETE', body: { token } });
  } catch {
    // 못 지워도 다음 로그인 때 다른 계정으로 옮겨 붙는다
  }
}

/** 알림을 눌렀을 때 열 화면 (서버가 data.url 에 /post/12 처럼 넣는다) */
export function notificationUrl(response: Notifications.NotificationResponse | null | undefined): string | undefined {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : undefined;
}
