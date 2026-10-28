import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, View, type KeyboardEvent, type ViewStyle } from 'react-native';
import { cn } from './cn';

// iOS 는 키보드가 올라오기 전에(Will), 안드로이드는 올라온 뒤에(Did)만 알려 준다
const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/** 키보드가 떠 있는지 (입력창 아래 안전 영역 여백을 뺄 때 쓴다) */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(SHOW, () => setVisible(true));
    const hide = Keyboard.addListener(HIDE, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * 키보드에 가리지 않는 화면 영역.
 * 안드로이드는 화면을 끝까지 쓰는(edge-to-edge) 방식이라 키보드가 떠도 화면이 줄어들지 않는다.
 * 그래서 이 영역의 아래 끝이 키보드에 가려지는 만큼 아래 여백을 직접 준다 (iOS 도 같은 방식).
 * 헤더 높이 같은 보정값 없이, 화면에서의 실제 위치를 재서 계산한다.
 */
export function KeyboardArea({ children, className, style }: { children: ReactNode; className?: string; style?: ViewStyle }) {
  const ref = useRef<View>(null);
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      const keyboardTop = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _w, h) => setInset(Math.max(0, y + h - keyboardTop)));
    };
    const show = Keyboard.addListener(SHOW, onShow);
    const hide = Keyboard.addListener(HIDE, () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View ref={ref} className={cn('flex-1', className)} style={[style, { paddingBottom: inset }]}>
      {children}
    </View>
  );
}
