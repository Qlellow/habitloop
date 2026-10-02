import { memo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, type PressableProps, type TextInputProps } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { channelColor } from '@loop/shared';
import { cn } from './cn';
import { useColors } from './theme';

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

export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  return (
    <View className="items-center justify-center bg-primary-weak rounded-full" style={{ width: size, height: size }}>
      <Text className="text-primary font-bold" style={{ fontSize: size * 0.4 }}>
        {name.slice(0, 1)}
      </Text>
    </View>
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

/** 헤더 오른쪽 아이콘 버튼 */
export function HeaderIcon({ name, onPress, label }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={10} className="px-1.5">
      <Ionicons name={name} size={24} color={c.textStrong} />
    </Pressable>
  );
}
