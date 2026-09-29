import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { authStore, configureApi, queryClient, useAuth, verifySession } from '@loop/shared';
import { API_URL } from '../src/config';
import { secureStorage } from '../src/storage';
import { useColors, useThemeVars } from '../src/theme';

// 앱이 뜰 때 한 번: 서버 주소 설정 + 보안 저장소에서 로그인 정보 읽기
configureApi({ baseUrl: API_URL });
void Promise.resolve(authStore.init(secureStorage)).then(verifySession);

export default function RootLayout() {
  const { ready } = useAuth();
  const c = useColors();
  const themeVars = useThemeVars();

  // 로그인 정보를 읽기 전에 요청하면 liked/mine 이 틀리게 오므로 잠깐 기다린다
  if (!ready) return <View className="flex-1 bg-bg" style={themeVars} />;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* 팔레트를 CSS 변수로 내려 주는 루트: 아래 모든 화면의 className 색이 여기서 정해진다 */}
        <View className="flex-1" style={themeVars}>
          <StatusBar style="auto" />
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
            <Stack.Screen name="write" options={{ presentation: 'modal', title: '글쓰기' }} />
            <Stack.Screen name="channel-form" options={{ presentation: 'modal', title: '채널 만들기' }} />
            <Stack.Screen name="login" options={{ presentation: 'modal', title: '로그인' }} />
            <Stack.Screen name="signup" options={{ presentation: 'modal', title: '회원가입' }} />
          </Stack>
        </View>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
