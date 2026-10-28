import type {
  BadgeCategory,
  BadgeTier,
  CommunityWeather,
  DiscoveryReason,
  NoticeKind,
  PetMood,
} from "./types";

/* 웹 · 앱이 같은 말로 보여 주는 이름표 */

export const TIER_LABEL: Record<BadgeTier, string> = {
  common: "일반",
  rare: "희귀",
  legendary: "전설",
};

export const BADGE_CATEGORIES: [BadgeCategory | "all", string][] = [
  ["all", "전체"],
  ["activity", "활동"],
  ["reaction", "반응"],
  ["loop", "루프 기능"],
  ["explore", "탐험"],
  ["time", "시간"],
  ["hidden", "숨은 배지"],
];

export const NOTICE_KIND_LABEL: Record<NoticeKind, string> = {
  update: "업데이트",
  notice: "공지",
  event: "이벤트",
  maintenance: "점검",
};

export const WEATHER: Record<
  CommunityWeather,
  { label: string; message: string }
> = {
  calm: {
    label: "잔잔함",
    message: "조용한 하루예요. 먼저 말을 걸어 보는 건 어때요?",
  },
  sunny: { label: "맑음", message: "즐거운 이야기가 많은 날이에요." },
  hot: { label: "쨍쨍", message: "커뮤니티가 뜨겁게 달아올랐어요!" },
  partly: { label: "구름 조금", message: "평온하게 이야기가 오가는 날이에요." },
  windy: { label: "바람", message: "놀라운 소식이 바람처럼 돌고 있어요." },
  cloudy: {
    label: "흐림",
    message: "고민이 조금 많은 날이에요. 따뜻한 댓글 하나 어때요?",
  },
  rain: {
    label: "비",
    message: "위로가 필요한 날이에요. 서로에게 우산이 되어 주세요.",
  },
};

/** 오늘의 발견을 고른 이유 */
export const DISCOVERY_REASON: Record<
  DiscoveryReason,
  { icon: string; label: string }
> = {
  talk: { icon: "💬", label: "대화가 오가는 글" },
  warm: { icon: "💛", label: "조용히 공감받는 글" },
  long: { icon: "📜", label: "정성 가득한 긴 글" },
  hidden: { icon: "🔍", label: "아직 덜 알려진 글" },
};

export const PET_MOOD_LABEL: Record<PetMood, string> = {
  happy: "신나요",
  calm: "느긋해요",
  sleepy: "졸려요",
};

/** 펫 경험치 얻는 법 (api/src/pets/pets.service.ts 와 같게) */
export const PET_XP_RULES = [
  ["글 쓰기", "+30", "하루 5개까지"],
  ["댓글 쓰기", "+10", "하루 20개까지"],
  ["내 글이 받은 좋아요", "+3", ""],
  ["내 글이 받은 감정 반응", "+2", ""],
  ["쓰다듬기", "+5", "하루 한 번"],
] as const;

/** 펫의 다음 단계 (레벨 몇에 무엇이 되는지) */
export function nextPetStage(level: number) {
  if (level < 1) return { label: "아기", at: 1 };
  if (level < 5) return { label: "어린이", at: 5 };
  if (level < 10) return { label: "어른", at: 10 };
  if (level < 15) return { label: "리본", at: 15 };
  if (level < 20) return { label: "왕관", at: 20 };
  return undefined;
}

export const noticeDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};
