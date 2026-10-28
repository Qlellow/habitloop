import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from './theme';

/**
 * 화면 아래에 잠깐 뜨는 알림 (Alert 처럼 막지 않는다).
 * toast('저장했어요') · toast('새 배지!', { onPress }) 로 어디서든 부른다
 */
interface Item {
  id: number;
  message: string;
  onPress?: () => void;
}
let seq = 0;
let queue: Item[] = [];
const listeners = new Set<() => void>();

export function toast(message: string, opts?: { onPress?: () => void }) {
  queue = [...queue, { id: ++seq, message, onPress: opts?.onPress }];
  listeners.forEach((l) => l());
}

/** 루트에 한 번 두는 자리 */
export function ToastHost() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<Item>();
  const show = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const next = () => setItem((cur) => cur ?? queue[0]);
    listeners.add(next);
    next();
    return () => void listeners.delete(next);
  }, []);

  useEffect(() => {
    if (!item) return;
    Animated.timing(show, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(show, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        queue = queue.filter((q) => q.id !== item.id);
        setItem(queue[0]);
      });
    }, 2400);
    return () => clearTimeout(t);
  }, [item, show]);

  if (!item) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 96,
        alignItems: 'center',
        opacity: show,
        transform: [{ translateY: show.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      <Pressable
        accessibilityRole="alert"
        onPress={item.onPress}
        disabled={!item.onPress}
        style={{ backgroundColor: c.toast, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, maxWidth: 420 }}
      >
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' }}>{item.message}</Text>
      </Pressable>
    </Animated.View>
  );
}
