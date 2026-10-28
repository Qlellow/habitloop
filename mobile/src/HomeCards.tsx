import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { DISCOVERY_REASON, REACTIONS, WEATHER, compact, useCommunityWeather, useDiscovery, type CommunityWeather } from '@loop/shared';

const WEATHER_ICON: Record<CommunityWeather, string> = { calm: '🌙', sunny: '☀️', hot: '🌞', partly: '⛅', windy: '🌬️', cloudy: '☁️', rain: '🌧️' };

/** 커뮤니티 감정 날씨: 최근 24시간의 공감 · 감정 반응으로 본 분위기 */
export function WeatherCard() {
  const { data } = useCommunityWeather();
  if (!data) return null;
  const w = WEATHER[data.weather];
  const total = REACTIONS.reduce((n, r) => n + data.stats[r.kind], 0);
  return (
    <View className="bg-surface px-5 py-4 mb-3" accessible accessibilityLabel={`커뮤니티 날씨 ${w.label}, 체감 ${data.temperature}도. ${w.message}`}>
      <View className="flex-row items-center gap-3.5">
        <Text className="text-[40px]">{WEATHER_ICON[data.weather]}</Text>
        <View className="flex-1">
          <Text className="text-[13px] font-semibold text-fg-weak">오늘의 커뮤니티 날씨</Text>
          <Text className="text-lg font-bold text-fg-strong">
            {w.label} <Text className="text-[15px] font-semibold text-fg-sub">체감 {data.temperature}°</Text>
          </Text>
          <Text className="mt-0.5 text-[13px] leading-[18px] text-fg-sub">{w.message}</Text>
        </View>
      </View>
      {total > 0 ? (
        <View className="flex-row gap-1.5 mt-3">
          {REACTIONS.map((r) => (
            <View key={r.kind} className="flex-1 flex-row items-center justify-center gap-1 py-1.5 rounded-sm bg-field">
              <Text className="text-sm">{r.emoji}</Text>
              <Text className="text-xs font-semibold text-fg-sub">{compact(data.stats[r.kind])}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** 오늘의 발견: 반응은 적어도 흥미로운 글 하나 */
export function DiscoveryCard() {
  const { data } = useDiscovery();
  const post = data?.post;
  if (!post) return null;
  const reason = data.reason ? DISCOVERY_REASON[data.reason] : undefined;
  return (
    <Pressable onPress={() => router.push(`/post/${post.id}`)} accessibilityRole="button" className="bg-surface px-5 py-4 mb-3 active:opacity-80">
      <View className="flex-row items-center gap-1.5">
        <Text className="text-primary text-base">✦</Text>
        <Text className="text-[17px] font-bold text-fg-strong">오늘의 발견</Text>
        {reason ? (
          <Text className="ml-auto px-2 py-0.5 rounded-full overflow-hidden bg-primary-weak text-xs font-semibold text-primary">
            {reason.icon} {reason.label}
          </Text>
        ) : null}
      </View>
      <View className="mt-3 p-4 rounded-md bg-field">
        <Text className="text-[13px] font-semibold text-primary">
          {post.channelName} <Text className="font-normal text-fg-weak">· {post.authorNickname}</Text>
        </Text>
        <Text className="mt-1 text-base font-bold leading-[22px] text-fg-strong" numberOfLines={2}>
          {post.title}
        </Text>
        {post.excerpt ? (
          <Text className="mt-1 text-sm leading-5 text-fg-sub" numberOfLines={2}>
            {post.excerpt}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
