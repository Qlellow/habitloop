import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { authStore, configureApi, queryClient, useAuth, verifySession } from '@loop/shared';
import { API_URL } from '../src/config';
import { secureStorage } from '../src/storage';
import { useColors, useScheme, useThemeVars } from '../src/theme';
import { ToastHost, toast } from '../src/Toast';
import { AppEffects } from '../src/AppEffects';

// 앱이 뜰 때 한 번: 서버 주소 설정 + 보안 저장소에서 로그인 정보 읽기
configureApi({ baseUrl: API_URL });
void Promise.resolve(authStore.init(secureStorage)).then(verifySession);
// 로그인이 풀리면 (만료 · 다른 곳에서 로그아웃) 조용히 넘어가지 않고 알린다
authStore.onExpire(() => toast('로그인이 만료됐어요. 다시 로그인해 주세요'));

export default function RootLayout() {
  const { ready } = useAuth();
  const c = useColors();
  const themeVars = useThemeVars();
  const scheme = useScheme();

  // 로그인 정보를 읽기 전에 요청하면 liked/mine 이 틀리게 오므로 잠깐 기다린다
  if (!ready) return <View className="flex-1 bg-bg" style={themeVars} />;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* 팔레트를 CSS 변수로 내려 주는 루트: 아래 모든 화면의 className 색이 여기서 정해진다 */}
        <View className="flex-1" style={themeVars}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: c.surface },
              headerTintColor: c.textStrong,
              headerTitleStyle: { fontWeight: '700' },
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: c.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="post/[id]" options={{ title: '' }} />
            <Stack.Screen name="c/[slug]/index" options={{ title: '' }} />
            <Stack.Screen name="c/[slug]/manage" options={{ title: '채널 관리' }} />
            <Stack.Screen name="search" options={{ title: '검색' }} />
            <Stack.Screen name="notifications" options={{ title: '알림' }} />
            <Stack.Screen name="badges" options={{ title: '배지 도감' }} />
            <Stack.Screen name="notices/index" options={{ title: '공지사항' }} />
            <Stack.Screen name="notices/[id]" options={{ title: '공지사항' }} />
            <Stack.Screen name="pet" options={{ title: '내 펫' }} />
            <Stack.Screen name="sea" options={{ title: '메시지 표류병' }} />
            <Stack.Screen name="points" options={{ title: '포인트' }} />
            <Stack.Screen name="settings" options={{ title: '설정' }} />
            <Stack.Screen name="c/[slug]/village" options={{ title: '마을' }} />
            <Stack.Screen name="c/[slug]/reports" options={{ title: '신고함' }} />
            <Stack.Screen name="u/[id]" options={{ title: '' }} />
            <Stack.Screen name="write" options={{ presentation: 'modal', title: '글쓰기' }} />
            <Stack.Screen name="channel-form" options={{ presentation: 'modal', title: '채널 만들기' }} />
            <Stack.Screen name="login" options={{ presentation: 'modal', title: '로그인' }} />
            <Stack.Screen name="signup" options={{ presentation: 'modal', title: '회원가입' }} />
          </Stack>
          <AppEffects />
          <ToastHost />
        </View>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
