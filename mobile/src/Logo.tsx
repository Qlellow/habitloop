import Svg, { G, Path, Rect } from 'react-native-svg';
import { Text, View } from 'react-native';
import { useColors } from './theme';

/**
 * 루프 로고: 무한대(∞). 웹 LogoMark(web/src/components/Layout.tsx)와 같은 그림.
 * 두 고리가 겹치는 가운데에서 뒤로 지나가는 선을 살짝 끊어 입체로 보이게 한다.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  const c = useColors();
  const bg = c.primary;
  const fg = '#fff';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Rect width="24" height="24" rx="6" fill={bg} />
      <G fill="none" strokeLinecap="round">
        <Path
          d="M12 12C13 10 14 8.5 15.5 8.5a3.5 3.5 0 0 1 0 7C14 15.5 13 14 12 12S10 8.5 8.5 8.5a3.5 3.5 0 0 0 0 7C10 15.5 11 14 12 12Z"
          stroke={fg}
          strokeWidth="2"
        />
        <Path d="M10.6 14.2C11.1 13.6 11.5 12.9 12 12S12.9 10.4 13.4 9.8" stroke={bg} strokeWidth="5" strokeLinecap="butt" />
        <Path d="M8.5 15.5C10 15.5 11 14 12 12S14 8.5 15.5 8.5" stroke={fg} strokeWidth="2" />
      </G>
    </Svg>
  );
}

/** 홈 헤더 제목: 로고 + 루프 (웹 헤더와 같게) */
export function HeaderLogo() {
  return (
    <View className="flex-row items-center gap-2" accessible accessibilityRole="header" accessibilityLabel="루프">
      <LogoMark size={28} />
      <Text className="text-xl font-extrabold text-fg-strong" style={{ letterSpacing: -0.6 }}>
        루프
      </Text>
    </View>
  );
}
