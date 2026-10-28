import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, ScrollView, Text, TextInput, View } from 'react-native';
import { timeAgo, useAuth, useBottleAction, useMyBottles, useSea, useThrowBottle, type BottleHopAction, type HeldBottle, type MyBottle } from '@loop/shared';
import { Button, Card, Empty, Loading } from '../src/ui';
import { cn } from '../src/cn';
import { useColors } from '../src/theme';
import { toast } from '../src/Toast';

const MAX = 300;
const STATUS: Record<MyBottle['status'], string> = { drifting: '떠다니는 중', held: '누군가 읽는 중', ashore: '해변에 닿았어요' };
const HOP_COLOR: Record<BottleHopAction, string> = { reply: '#3182f6', release: '#8b95a1', timeout: '#c9cfd8' };

/** 바다 그림: 해 + 출렁이는 물결, 주운 병이 있으면 병이 둥실 */
function SeaScene({ bottle }: { bottle: boolean }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [bob]);
  const y = (n: number) => bob.interpolate({ inputRange: [0, 1], outputRange: [0, n] });
  return (
    <View className="absolute inset-0 overflow-hidden" aria-hidden>
      <View className="absolute right-6 top-5 w-11 h-11 rounded-full" style={{ backgroundColor: '#ffe28a' }} />
      {bottle ? (
        <Animated.Text style={{ position: 'absolute', right: 22, top: 70, fontSize: 30, transform: [{ translateY: y(-6) }, { rotate: '-14deg' }] }}>🍾</Animated.Text>
      ) : null}
      <Animated.View className="absolute -left-4 -right-4 bottom-0 h-12 rounded-t-[40px]" style={{ backgroundColor: 'rgba(255,255,255,0.22)', transform: [{ translateY: y(4) }] }} />
      <Animated.View className="absolute -left-4 -right-4 -bottom-3 h-10 rounded-t-[36px]" style={{ backgroundColor: 'rgba(255,255,255,0.3)', transform: [{ translateY: y(-3) }] }} />
    </View>
  );
}

/** 편지지 같은 입력창 */
function Paper({ value, onChangeText, placeholder, rows, label }: { value: string; onChangeText: (t: string) => void; placeholder: string; rows: number; label: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      maxLength={MAX}
      multiline
      placeholder={placeholder}
      placeholderTextColor="#b59a72"
      accessibilityLabel={label}
      className="mt-2 px-3.5 py-3 rounded-md text-[15px] leading-[22px]"
      style={{ minHeight: rows * 22 + 24, backgroundColor: '#fffaf0', color: '#4a3820', borderWidth: 1, borderColor: '#ecdcbc', textAlignVertical: 'top' }}
    />
  );
}

function Compose({ left, onDone }: { left: number; onDone: () => void }) {
  const [text, setText] = useState('');
  const throwIt = useThrowBottle();
  return (
    <View className="p-4 rounded-lg" style={{ backgroundColor: '#fdf3df' }}>
      <Text className="text-[13px] font-semibold" style={{ color: '#7a5b2e' }}>
        병에 담을 말 (누가 보냈는지는 알려지지 않아요)
      </Text>
      <Paper value={text} onChangeText={setText} rows={5} label="병에 담을 말" placeholder="요즘 마음에 남은 일, 낯선 누군가에게 하고 싶은 말…" />
      <Text className="mt-2 text-xs" style={{ color: '#9a7b4e' }}>
        {text.length}/{MAX} · 오늘 {left}개 더 띄울 수 있어요
      </Text>
      <View className="flex-row gap-2 mt-3">
        <Button title="닫기" variant="ghost" size="sm" className="flex-1" onPress={onDone} />
        <Button
          title="바다에 띄우기"
          size="sm"
          className="flex-[2]"
          disabled={text.trim().length < 5}
          loading={throwIt.isPending}
          onPress={() =>
            throwIt.mutate(text, {
              onSuccess: () => {
                toast('병을 바다에 띄웠어요. 누군가에게 닿기를!');
                onDone();
              },
              onError: (e) => toast(e.message),
            })
          }
        />
      </View>
    </View>
  );
}

/** 지금 손에 든 병: 답장하고 다시 띄우기 · 그냥 다시 띄우기 · 신고 */
function HeldLetter({ bottle }: { bottle: HeldBottle }) {
  const [reply, setReply] = useState('');
  const act = useBottleAction();
  const run = (action: 'reply' | 'release' | 'report', done: string) =>
    act.mutate({ id: bottle.id, action, content: reply }, { onSuccess: () => toast(done), onError: (e) => toast(e.message) });
  const hoursLeft = Math.max(1, Math.round((new Date(bottle.releaseAt).getTime() - Date.now()) / 3600_000));
  return (
    <View className="p-4 rounded-lg" style={{ backgroundColor: '#fdf3df' }} accessibilityLabel="주운 병의 쪽지">
      <View className="flex-row justify-between">
        <Text className="text-xs" style={{ color: '#9a7b4e' }}>
          🍾 이 병을 주운 {bottle.hops}번째 사람이에요
        </Text>
        <Text className="text-xs" style={{ color: '#9a7b4e' }}>
          {hoursLeft}시간 뒤 바다로
        </Text>
      </View>
      <Text className="mt-3 text-base leading-6" style={{ color: '#4a3820' }}>
        {bottle.content}
      </Text>
      <Paper value={reply} onChangeText={setReply} rows={3} label="답장" placeholder="답장을 남기면 띄운 사람에게만 닿아요 (누가 썼는지는 몰라요)" />
      <View className="flex-row gap-2 mt-3">
        <Button
          title="신고"
          variant="text"
          size="sm"
          onPress={() =>
            Alert.alert('이 병을 신고할까요?', '병은 바다로 돌아가고, 이 병을 띄운 사람의 병은 앞으로 받지 않아요. 신고가 모이면 병을 건져 내요.', [
              { text: '취소', style: 'cancel' },
              { text: '신고', style: 'destructive', onPress: () => run('report', '신고했어요. 이 사람의 병은 더 오지 않아요') },
            ])
          }
        />
        <Button title="그냥 다시 띄우기" variant="ghost" size="sm" className="flex-1" disabled={act.isPending} onPress={() => run('release', '병을 다시 바다에 띄웠어요')} />
      </View>
      <Button
        title="답장하고 다시 띄우기"
        size="sm"
        className="mt-2"
        full
        disabled={reply.trim().length < 2 || act.isPending}
        onPress={() => run('reply', '답장을 담아 다시 띄웠어요')}
      />
    </View>
  );
}

/** 병이 거쳐 간 길: 사람마다 점 하나 (한 일에 따라 색) */
function Journey({ bottle }: { bottle: MyBottle }) {
  const c = useColors();
  return (
    <View className="flex-row flex-wrap items-center gap-1 mt-2.5" accessible accessibilityLabel={`${bottle.hops}명을 거쳤어요`}>
      <View className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: c.primary }} />
      {bottle.journey.map((h, i) => (
        <View key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: h.action ? HOP_COLOR[h.action] : c.primary, opacity: h.action ? 1 : 0.5 }} />
      ))}
      <Text className="text-sm">{bottle.status === 'ashore' ? '🏝️' : '🍾'}</Text>
    </View>
  );
}

function MyBottles() {
  const { data } = useMyBottles();
  if (!data) return <Loading />;
  if (!data.length) return <Text className="px-5 pb-5 text-sm text-fg-weak">아직 띄운 병이 없어요. 첫 병을 띄워 보세요.</Text>;
  return (
    <View className="px-4 pb-4 gap-3">
      {data.map((b) => (
        <View key={b.id} className="p-4 rounded-md border border-border">
          <View className="flex-row items-center gap-2">
            <Text className={cn('px-2 py-0.5 rounded-[6px] overflow-hidden text-xs font-bold', b.status === 'ashore' ? 'bg-field text-fg-sub' : 'bg-primary-weak text-primary')}>
              {STATUS[b.status]}
            </Text>
            <Text className="shrink text-xs text-fg-weak" numberOfLines={1}>
              {b.hops}명을 거쳤어요 · {timeAgo(b.createdAt)} 띄움
            </Text>
          </View>
          <Text className="mt-2 text-sm leading-5 text-fg" numberOfLines={3}>
            {b.content}
          </Text>
          <Journey bottle={b} />
          {b.replies.map((r) => (
            <View key={r.id} className={cn('mt-2 p-3 rounded-md bg-field', !r.read && 'border border-primary')}>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs text-fg-weak">🐚 어느 바닷가의 누군가 · {timeAgo(r.createdAt)}</Text>
                {!r.read ? <Text className="ml-auto text-xs font-bold text-primary">새 답장</Text> : null}
              </View>
              <Text className="mt-1 text-sm text-fg-strong">{r.content}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** 메시지 표류병: 낯선 누군가에게 닿는 익명의 쪽지 */
export default function SeaScreen() {
  const { isLoggedIn } = useAuth();
  const { data: sea } = useSea(isLoggedIn);
  const [composing, setComposing] = useState(false);
  if (!isLoggedIn) return <Empty>로그인하면 병을 띄우고 주울 수 있어요</Empty>;
  return (
    <ScrollView contentContainerClassName="p-4 gap-3 pb-10" keyboardShouldPersistTaps="handled">
      <Card>
        <View className="h-[170px] justify-end pl-5 pr-16 pb-12" style={{ backgroundColor: '#3d8ee8' }}>
          <SeaScene bottle={!!sea?.held} />
          <Text className="text-2xl font-extrabold text-white">메시지 표류병</Text>
          <Text className="mt-1 text-sm text-white/90">병에 담은 말은 바다를 떠다니다 낯선 누군가에게 닿아요.</Text>
          {sea ? (
            <Text className="mt-1.5 text-[13px] text-white/80">
              떠다니는 병 {sea.drifting}개 · 오늘 주울 수 있는 병 {sea.catchesLeft}개
            </Text>
          ) : null}
        </View>
        <View className="p-4 gap-4">
          {sea?.held ? (
            <HeldLetter key={sea.held.id} bottle={sea.held} />
          ) : sea ? (
            <Text className="text-center text-sm text-fg-sub">
              {sea.catchesLeft === 0 ? '오늘은 병을 다 주웠어요. 내일 다시 바다를 보러 와요 🌊' : '지금은 떠내려온 병이 없어요. 조금 뒤에 다시 와 보세요 🌊'}
            </Text>
          ) : (
            <Loading />
          )}
          {composing ? (
            <Compose left={sea?.throwsLeft ?? 0} onDone={() => setComposing(false)} />
          ) : (
            <Button
              size="lg"
              full
              title={sea && sea.throwsLeft === 0 ? '오늘은 병을 다 띄웠어요' : '🍾 병 띄우기'}
              disabled={!sea || sea.throwsLeft === 0}
              onPress={() => setComposing(true)}
            />
          )}
        </View>
      </Card>
      <Card>
        <View className="flex-row items-center gap-2 px-5 pt-5 pb-3">
          <Text className="text-lg font-bold text-fg-strong">내가 띄운 병</Text>
          {sea?.unreadReplies ? <Text className="text-xs font-bold text-primary">새 답장 {sea.unreadReplies}</Text> : null}
        </View>
        <MyBottles />
      </Card>
    </ScrollView>
  );
}
