import { memo, type ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, TextInput, View, type PressableProps, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiUrl, channelColor, type BadgeTier, type ChannelRole, type FeaturedBadge } from '@loop/shared';
import { cn } from './cn';
import { useColors, useThemeVars } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'text' | 'danger';

const variants: Record<Variant, { box: string; label: string }> = {
  primary: { box: 'bg-primary', label: 'text-white' },
  secondary: { box: 'bg-primary-weak', label: 'text-primary' },
  ghost: { box: 'bg-field', label: 'text-fg' },
  text: { box: 'bg-transparent', label: 'text-fg-sub' },
  danger: { box: 'bg-danger-weak', label: 'text-danger' },
};

const sizes = {
  sm: { box: 'h-[34px] px-3 rounded-sm', label: 'text-sm' },
  md: { box: 'h-11 px-[18px] rounded-sm', label: 'text-[15px]' },
  lg: { box: 'h-[54px] px-[18px] rounded-md', label: 'text-[17px]' },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  full,
  disabled,
  loading,
  className,
  ...rest
}: PressableProps & {
  title: string;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const c = useColors();
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={cn(
        'flex-row items-center justify-center active:scale-[0.97]',
        v.box,
        sizes[size].box,
        full && 'self-stretch',
        disabled && 'opacity-40',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : c.primary} />
      ) : (
        <Text className={cn('font-semibold', v.label, sizes[size].label)}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn('h-[34px] px-3.5 rounded-full justify-center', selected ? 'bg-fg-strong' : 'bg-field')}
    >
      <Text className={cn('text-sm font-semibold', selected ? 'text-surface' : 'text-fg-sub')}>{label}</Text>
    </Pressable>
  );
}

export function Input({ className, ...props }: TextInputProps & { className?: string }) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.weak}
      {...props}
      className={cn('bg-field rounded-md px-4 py-3.5 text-base text-fg-strong', className)}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={cn('bg-surface rounded-lg overflow-hidden', className)}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-5 pt-5 pb-2">
      <Text className="text-lg font-bold text-fg-strong">{children}</Text>
      {right}
    </View>
  );
}

// 크기·채널 색처럼 값에 따라 바뀌는 부분만 style 로 넘긴다
export const ChannelIcon = memo(function ChannelIcon({ slug, name, size = 36, color }: { slug: string; name: string; size?: number; color?: number | null }) {
  return (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: channelColor(slug, color) }}
    >
      <Text className="text-white font-extrabold" style={{ fontSize: size * 0.44 }}>
        {name.slice(0, 1)}
      </Text>
    </View>
  );
});

/** 프로필 사진 (없으면 닉네임 첫 글자) */
export function Avatar({ name, size = 38, uri }: { name: string; size?: number; uri?: string | null }) {
  if (uri) {
    return <Image source={{ uri: uri.startsWith('/api/') ? apiUrl(uri) : uri }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel={`${name} 프로필 사진`} />;
  }
  return (
    <View className="items-center justify-center bg-primary-weak rounded-full" style={{ width: size, height: size }}>
      <Text className="text-primary font-bold" style={{ fontSize: size * 0.4 }}>
        {name.slice(0, 1)}
      </Text>
    </View>
  );
}

export const TIER_RING: Record<BadgeTier, string> = { common: '#a9b6c7', rare: '#7b72ff', legendary: '#ffad33' };

/** 배지 메달 (닉네임 옆 대표 배지 · 도감): 등급 색 테두리 안의 아이콘. locked 면 흐리게, secret 이면 점선 */
export function BadgeMark({ badge, size = 18, locked, secret }: { badge?: Pick<FeaturedBadge, 'name' | 'icon' | 'tier'>; size?: number; locked?: boolean; secret?: boolean }) {
  const c = useColors();
  if (!badge) return null;
  return (
    <View
      accessibilityLabel={locked ? undefined : `배지 ${badge.name}`}
      className={cn('items-center justify-center rounded-full', locked ? 'bg-field' : 'bg-surface')}
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(1.5, size * 0.07),
        borderColor: locked ? c.border : TIER_RING[badge.tier],
        borderStyle: secret ? 'dashed' : 'solid',
      }}
    >
      <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.68, opacity: locked ? 0.35 : 1 }}>{badge.icon}</Text>
    </View>
  );
}

/** 운영진 표시 (소유자 · 관리자 · 매니저) */
export function RoleTag({ role }: { role?: ChannelRole }) {
  if (!role) return null;
  const meta = { OWNER: ['소유자', '#f5a700'], ADMIN: ['관리자', '#03b26c'], MANAGER: ['매니저', '#3182f6'] }[role];
  return (
    <Text className="px-1.5 py-px rounded-[6px] overflow-hidden text-[11px] font-bold" style={{ color: meta[1], backgroundColor: `${meta[1]}22` }}>
      {meta[0]}
    </Text>
  );
}

export interface SheetOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/** 아래에서 올라오는 고르기 창 (안드로이드 Alert 는 버튼이 3개까지라 이걸로) */
export function Sheet({ visible, title, options, onClose }: { visible: boolean; title?: string; options: SheetOption[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  // Modal 은 루트 밖에 그려지므로 색 변수를 여기서 다시 건다
  const themeVars = useThemeVars();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" style={themeVars} onPress={onClose} accessibilityLabel="닫기">
        <Pressable className="mx-3 rounded-[18px] bg-surface overflow-hidden" style={{ marginBottom: 12 + insets.bottom }} onPress={() => undefined}>
          {title ? <Text className="px-5 pt-4 pb-2 text-[13px] font-semibold text-fg-weak">{title}</Text> : null}
          {options.map((o, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              className="px-5 py-4 border-t border-line active:bg-pressed"
              onPress={() => {
                onClose();
                o.onPress();
              }}
            >
              <Text className={cn('text-[16px] font-semibold', o.destructive ? 'text-danger' : 'text-fg-strong')}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" className="px-5 py-4 border-t border-line items-center active:bg-pressed" onPress={onClose}>
            <Text className="text-[16px] font-semibold text-fg-sub">취소</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View className="py-12 px-5 items-center gap-4">
      <Text className="text-fg-weak text-[15px] text-center">{children}</Text>
      {action}
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return <ActivityIndicator className="my-7" color={c.primary} />;
}

export function Skeleton({ width, height, className }: { width: number | `${number}%`; height: number; className?: string }) {
  return <View className={cn('rounded-[6px] bg-skeleton', className)} style={{ width, height }} />;
}

export function Heart({ filled, size = 16, color }: { filled?: boolean; size?: number; color: string }) {
  return <Ionicons name={filled ? 'heart' : 'heart-outline'} size={size} color={color} />;
}

/** 헤더 오른쪽 아이콘 버튼 (dot: 안 읽은 것이 있다는 빨간 점) */
export function HeaderIcon({ name, onPress, label, dot }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; dot?: boolean }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={10} className="px-1.5">
      <Ionicons name={name} size={24} color={c.textStrong} />
      {dot ? <View className="absolute top-0 right-1 w-2 h-2 rounded-full bg-danger" /> : null}
    </Pressable>
  );
}
