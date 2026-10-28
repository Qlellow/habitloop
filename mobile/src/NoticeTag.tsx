import { Text } from 'react-native';
import { NOTICE_KIND_LABEL, type NoticeKind } from '@loop/shared';

const TONE: Record<NoticeKind, { bg: string; fg: string }> = {
  update: { bg: 'rgba(49,130,246,0.14)', fg: '#2272eb' },
  notice: { bg: 'rgba(139,149,161,0.18)', fg: '#4e5968' },
  event: { bg: 'rgba(255,138,61,0.16)', fg: '#d9661a' },
  maintenance: { bg: 'rgba(240,68,82,0.14)', fg: '#d22030' },
};

/** 공지 종류 표시 (업데이트 · 공지 · 이벤트 · 점검) */
export function NoticeTag({ kind }: { kind: NoticeKind }) {
  return (
    <Text className="self-start px-2 py-0.5 rounded-[6px] overflow-hidden text-xs font-bold" style={{ backgroundColor: TONE[kind].bg, color: TONE[kind].fg }}>
      {NOTICE_KIND_LABEL[kind]}
    </Text>
  );
}
