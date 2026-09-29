import { memo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { channelColor } from '@loop/shared';
import { makeStyles, radius, useColors } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'text' | 'danger';

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  full,
  disabled,
  loading,
  style,
  ...rest
}: PressableProps & {
  title: string;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = { primary: c.primary, secondary: c.primaryWeak, ghost: c.field, text: 'transparent', danger: c.dangerWeak }[variant];
  const fg = { primary: c.onPrimary, secondary: c.primary, ghost: c.text, text: c.sub, danger: c.danger }[variant];
  const height = { sm: 34, md: 44, lg: 54 }[size];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: size === 'sm' ? 12 : 18,
          borderRadius: size === 'lg' ? radius.md : radius.sm,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        full && { alignSelf: 'stretch' },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: size === 'lg' ? 17 : size === 'sm' ? 14 : 15, fontWeight: '600' }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 999,
        justifyContent: 'center',
        backgroundColor: selected ? c.textStrong : c.field,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? c.surface : c.sub }}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.weak}
      {...props}
      style={[
        {
          backgroundColor: c.field,
          borderRadius: radius.md,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 16,
          color: c.textStrong,
        },
        props.style,
      ]}
    />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const s = useSectionStyles();
  return (
    <View style={s.row}>
      <Text style={s.title}>{children}</Text>
      {right}
    </View>
  );
}

const useSectionStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: c.textStrong },
}));

export const ChannelIcon = memo(function ChannelIcon({ slug, name, size = 36 }: { slug: string; name: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: channelColor(slug),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.44 }}>{name.slice(0, 1)}</Text>
    </View>
  );
});

export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const c = useColors();
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primaryWeak, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.4 }}>{name.slice(0, 1)}</Text>
    </View>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ paddingVertical: 48, paddingHorizontal: 20, alignItems: 'center', gap: 16 }}>
      <Text style={{ color: c.weak, fontSize: 15, textAlign: 'center' }}>{children}</Text>
      {action}
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return <ActivityIndicator style={{ marginVertical: 28 }} color={c.primary} />;
}

export function Skeleton({ width, height, style }: { width: number | `${number}%`; height: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ width, height, borderRadius: 6, backgroundColor: c.skeleton }, style]} />;
}

export function Heart({ filled, size = 16, color }: { filled?: boolean; size?: number; color: string }) {
  return <Ionicons name={filled ? 'heart' : 'heart-outline'} size={size} color={color} />;
}

/** 헤더 오른쪽 아이콘 버튼 */
export function HeaderIcon({ name, onPress, label }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={10} style={{ paddingHorizontal: 6 }}>
      <Ionicons name={name} size={24} color={c.textStrong} />
    </Pressable>
  );
}
