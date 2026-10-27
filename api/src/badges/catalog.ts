/**
 * 배지 도감: 모든 배지의 이름 · 설명 · 그림 · 등급 · 분류 · 조건.
 * 한 번 받으면 조건이 다시 내려가도 남는다. 목록 순서가 도감 · 프로필에 보이는 순서.
 * 숨은 배지(hidden)는 받기 전까지 이름 · 설명 · 그림이 '???' 로 보인다.
 * 화면에서 보내 오는 기록(카운터)으로 받는 배지는 조작할 수 있으므로 포인트를 주지 않는다 (배지는 원래 포인트가 없다)
 */
export type BadgeTier = 'common' | 'rare' | 'legendary';
export type BadgeCategory = 'activity' | 'reaction' | 'loop' | 'explore' | 'time' | 'hidden';
export type PetStageName = 'none' | 'egg' | 'baby' | 'junior' | 'adult';

/** 배지를 판정하는 데 쓰는 숫자들 (badges.service.ts 가 모은다) */
export interface BadgeStats {
  userId: number;
  posts: number;
  comments: number;
  likes: number;
  invites: number;
  channels: number;
  followers: number;
  streak: number;
  daysSinceJoin: number;
  discoveries: number;
  bottlesThrown: number;
  bottleReplies: number;
  bottlesAshore: number;
  blindPosts: number;
  reactionsGiven: number;
  allFiveReactions: boolean;
  maxFire: number;
  maxCommentsOnPost: number;
  welcomeComments: number;
  bestComment: boolean;
  exploredChannels: number;
  pioneer: boolean;
  homeSaved: boolean;
  dawnPosts: number;
  earlyBirdStreak: number;
  lucky: boolean;
  midnight: boolean;
  petStage: PetStageName;
  dnaComplete: boolean;
  betaUser: boolean;
  /** 카운터 (user_counters): voice_join · voice_minute · screenshare · focus_read · palette · cursor_secret · shooting_star · rain_comment · own_ashore · pat_max */
  counters: Record<string, number>;
}

export interface BadgeDef {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  category: BadgeCategory;
  hidden?: boolean;
  /** 조건 (true 면 받는다) */
  earned: (s: BadgeStats) => boolean;
  /** 진행도 [지금, 목표] (숫자로 셀 수 있는 배지만) */
  progress?: (s: BadgeStats) => [number, number];
}

const counter = (s: BadgeStats, key: string) => s.counters[key] ?? 0;
/** n 개를 모으는 배지 */
const count = (get: (s: BadgeStats) => number, n: number) => ({
  earned: (s: BadgeStats) => get(s) >= n,
  progress: (s: BadgeStats): [number, number] => [Math.min(get(s), n), n],
});
const PET_ORDER: PetStageName[] = ['none', 'egg', 'baby', 'junior', 'adult'];

export const BADGES: BadgeDef[] = [
  /* ── 글 · 댓글 ── */
  { code: 'first_post', name: '첫 글', description: '처음으로 글을 썼어요', icon: '✍️', tier: 'common', category: 'activity', ...count((s) => s.posts, 1) },
  { code: 'posts_10', name: '꾸준한 작가', description: '글을 10개 썼어요', icon: '📝', tier: 'common', category: 'activity', ...count((s) => s.posts, 10) },
  { code: 'posts_100', name: '루프의 기둥', description: '글을 100개 썼어요', icon: '🏛️', tier: 'legendary', category: 'activity', ...count((s) => s.posts, 100) },
  { code: 'first_comment', name: '첫 댓글', description: '처음으로 댓글을 달았어요', icon: '💬', tier: 'common', category: 'activity', ...count((s) => s.comments, 1) },
  { code: 'comments_100', name: '수다쟁이', description: '댓글을 100개 달았어요', icon: '🗨️', tier: 'rare', category: 'activity', ...count((s) => s.comments, 100) },
  { code: 'channel_open', name: '채널 개설', description: '채널을 만들었어요', icon: '📢', tier: 'common', category: 'activity', ...count((s) => s.channels, 1) },
  ...([
    [10, 'common'],
    [50, 'rare'],
    [100, 'rare'],
    [500, 'legendary'],
    [1000, 'legendary'],
  ] as const).map(([n, tier]) => ({
    code: `followers_${n}`,
    name: `팔로워 ${n.toLocaleString()}+`,
    description: `내 채널의 팔로워가 ${n.toLocaleString()}명을 넘었어요`,
    icon: '👥',
    tier,
    category: 'activity' as const,
    ...count((s) => s.followers, n),
  })),
  { code: 'invite_1', name: '첫 초대', description: '친구를 루프에 초대했어요', icon: '🤝', tier: 'common', category: 'activity', ...count((s) => s.invites, 1) },
  { code: 'invite_10', name: '마당발', description: '친구 10명을 초대했어요', icon: '🎉', tier: 'rare', category: 'activity', ...count((s) => s.invites, 10) },

  /* ── 공감 · 응원 ── */
  { code: 'likes_10', name: '첫 호응', description: '공감을 10개 받았어요', icon: '❤️', tier: 'common', category: 'reaction', ...count((s) => s.likes, 10) },
  { code: 'likes_100', name: '인기인', description: '공감을 100개 받았어요', icon: '💖', tier: 'rare', category: 'reaction', ...count((s) => s.likes, 100) },
  { code: 'likes_1000', name: '스타', description: '공감을 1,000개 받았어요', icon: '🌟', tier: 'legendary', category: 'reaction', ...count((s) => s.likes, 1000) },
  { code: 'cheer_100', name: '응원단장', description: '감정 반응을 100번 남겼어요', icon: '👏', tier: 'common', category: 'reaction', ...count((s) => s.reactionsGiven, 100) },
  { code: 'all_reactions', name: '감정 부자', description: '한 글에 감정 반응 다섯 가지를 모두 받았어요', icon: '🌈', tier: 'rare', category: 'reaction', earned: (s) => s.allFiveReactions },
  { code: 'fire_10', name: '불꽃 작가', description: "한 글에 '최고예요'를 10개 받았어요", icon: '🔥', tier: 'rare', category: 'reaction', ...count((s) => s.maxFire, 10) },
  { code: 'spark_50', name: '대화의 불씨', description: '한 글에 댓글이 50개 달렸어요', icon: '🕯️', tier: 'rare', category: 'reaction', ...count((s) => s.maxCommentsOnPost, 50) },
  { code: 'welcome', name: '첫 손님 맞이', description: '가입한 지 일주일이 안 된 사람의 글에 댓글을 달았어요', icon: '🛎️', tier: 'common', category: 'reaction', ...count((s) => s.welcomeComments, 1) },
  { code: 'best_comment', name: '베스트 댓글', description: '내 댓글이 그 글에서 가장 많은 공감을 받았어요 (3개 이상)', icon: '🏆', tier: 'common', category: 'reaction', earned: (s) => s.bestComment },

  /* ── 루프 기능 ── */
  { code: 'gem', name: '숨은 보석', description: "내 글이 '오늘의 발견'에 뽑혔어요", icon: '🔭', tier: 'rare', category: 'loop', ...count((s) => s.discoveries, 1) },
  { code: 'gem_3', name: '보석 수집가', description: "'오늘의 발견'에 세 번 뽑혔어요", icon: '💎', tier: 'legendary', category: 'loop', ...count((s) => s.discoveries, 3) },
  { code: 'bottle_first', name: '첫 항해', description: '표류병을 처음 띄웠어요', icon: '🍾', tier: 'common', category: 'loop', ...count((s) => s.bottlesThrown, 1) },
  { code: 'bottle_friend', name: '바닷가의 친구', description: '주운 병에 답장을 10번 했어요', icon: '🐚', tier: 'rare', category: 'loop', ...count((s) => s.bottleReplies, 10) },
  { code: 'bottle_ashore', name: '긴 항해', description: '내 병이 열 명을 거쳐 해변에 닿았어요', icon: '🏝️', tier: 'rare', category: 'loop', ...count((s) => s.bottlesAshore, 1) },
  { code: 'voice_first', name: '첫 목소리', description: '음성방에 처음 들어갔어요', icon: '🎙️', tier: 'common', category: 'loop', ...count((s) => counter(s, 'voice_join'), 1) },
  { code: 'voice_10h', name: '수다방 단골', description: '음성방에 모두 10시간 머물렀어요', icon: '📡', tier: 'rare', category: 'loop', ...count((s) => counter(s, 'voice_minute'), 600) },
  { code: 'screenshare', name: '발표자', description: '음성방에서 화면을 처음 공유했어요', icon: '🖥️', tier: 'common', category: 'loop', ...count((s) => counter(s, 'screenshare'), 1) },
  { code: 'blind_5', name: '스포일러 장인', description: '블라인드(‖ ‖)를 쓴 글을 5개 썼어요', icon: '▒', tier: 'common', category: 'loop', ...count((s) => s.blindPosts, 5) },
  { code: 'pet_hatch', name: '부화', description: '펫이 알에서 깨어났어요', icon: '🐣', tier: 'common', category: 'loop', earned: (s) => PET_ORDER.indexOf(s.petStage) >= PET_ORDER.indexOf('baby') },
  { code: 'pet_adult', name: '다 자란 친구', description: '펫이 어른이 되었어요', icon: '🐉', tier: 'legendary', category: 'loop', earned: (s) => s.petStage === 'adult' },
  { code: 'dna_full', name: 'DNA 완성', description: '활동 DNA 의 다섯 성향이 모두 30을 넘었어요', icon: '🧬', tier: 'rare', category: 'loop', earned: (s) => s.dnaComplete },

  /* ── 탐험 · 습관 ── */
  { code: 'explorer', name: '탐험가', description: '채널 열 곳에 글이나 댓글을 남겼어요', icon: '🧭', tier: 'common', category: 'explore', ...count((s) => s.exploredChannels, 10) },
  { code: 'pioneer', name: '개척자', description: '만든 지 하루가 안 된 채널에 첫 글을 썼어요', icon: '🗺️', tier: 'rare', category: 'explore', earned: (s) => s.pioneer },
  { code: 'home_maker', name: '꾸미기 장인', description: '나만의 홈을 꾸며 저장했어요', icon: '🎨', tier: 'common', category: 'explore', earned: (s) => s.homeSaved },
  { code: 'focus_30', name: '몰입 독서가', description: '몰입 모드로 글을 30개 읽었어요', icon: '📖', tier: 'common', category: 'explore', ...count((s) => counter(s, 'focus_read'), 30) },
  { code: 'streak_7', name: '일주일 출석', description: '7일 연속으로 출석했어요', icon: '📅', tier: 'common', category: 'explore', ...count((s) => s.streak, 7) },
  { code: 'streak_30', name: '한 달 출석', description: '30일 연속으로 출석했어요', icon: '🗓️', tier: 'rare', category: 'explore', ...count((s) => s.streak, 30) },
  { code: 'streak_100', name: '100일 출석', description: '100일 연속으로 출석했어요', icon: '💯', tier: 'legendary', category: 'explore', ...count((s) => s.streak, 100) },
  { code: 'anniversary', name: '루프 1주년', description: '루프와 함께한 지 1년이 되었어요', icon: '🎂', tier: 'rare', category: 'explore', ...count((s) => s.daysSinceJoin, 365) },

  /* ── 시간대 ── */
  { code: 'dawn_10', name: '새벽 감성', description: '새벽 2~5시에 글을 10개 썼어요', icon: '🌙', tier: 'common', category: 'time', ...count((s) => s.dawnPosts, 10) },
  { code: 'early_bird', name: '얼리버드', description: '아침 5~7시에 7일 연속으로 글이나 댓글을 남겼어요', icon: '🌅', tier: 'rare', category: 'time', ...count((s) => s.earlyBirdStreak, 7) },
  { code: 'rain_comfort', name: '비 오는 날의 위로', description: "커뮤니티 날씨가 '비'일 때 댓글을 10번 달았어요", icon: '☔', tier: 'rare', category: 'time', ...count((s) => counter(s, 'rain_comment'), 10) },

  /* ── 숨은 배지 ── */
  { code: 'lucky', name: '행운', description: '글 번호가 777 · 7777 · 77777 인 글을 썼어요', icon: '🎲', tier: 'rare', category: 'hidden', hidden: true, earned: (s) => s.lucky },
  { code: 'midnight', name: '자정의 기록', description: '자정(00:00)에 딱 맞춰 글을 올렸어요', icon: '🕛', tier: 'rare', category: 'hidden', hidden: true, earned: (s) => s.midnight },
  { code: 'palette_50', name: '키보드 마법사', description: '커맨드 팔레트를 50번 열었어요', icon: '⌨️', tier: 'common', category: 'hidden', hidden: true, earned: (s) => counter(s, 'palette') >= 50 },
  { code: 'cursor_secret', name: '숨은 애니메이션', description: '인터랙티브 커서의 숨은 애니메이션을 봤어요', icon: '✨', tier: 'rare', category: 'hidden', hidden: true, earned: (s) => counter(s, 'cursor_secret') >= 1 },
  { code: 'shooting_star', name: '별똥별', description: '새벽 하늘의 별똥별을 잡았어요', icon: '🌠', tier: 'rare', category: 'hidden', hidden: true, earned: (s) => counter(s, 'shooting_star') >= 1 },
  { code: 'pat_30', name: '쓰다듬기 중독', description: '하루에 펫을 30번 쓰다듬었어요', icon: '🐾', tier: 'common', category: 'hidden', hidden: true, earned: (s) => counter(s, 'pat_max') >= 30 },
  { code: 'self_talk', name: '자기 자신과의 대화', description: '여정을 마치고 돌아온 내 병을 다시 읽었어요', icon: '🪞', tier: 'rare', category: 'hidden', hidden: true, earned: (s) => counter(s, 'own_ashore') >= 1 },
  { code: 'first_100', name: '첫 번째 루퍼', description: '루프에 100번째 안으로 가입했어요', icon: '🥇', tier: 'legendary', category: 'hidden', hidden: true, earned: (s) => s.userId <= 100 },
  { code: 'beta', name: '베타 테스터', description: '정식 오픈 전에 가입했어요', icon: '🧪', tier: 'rare', category: 'hidden', hidden: true, earned: (s) => s.betaUser },
];

export const BADGE_BY_CODE = new Map(BADGES.map((b) => [b.code, b]));

/** 닉네임 옆에 다는 대표 배지 (목록 · 글 · 댓글 · 프로필) */
export interface FeaturedBadge {
  code: string;
  name: string;
  icon: string;
  tier: BadgeTier;
}

export function featuredBadge(code: string | null | undefined): FeaturedBadge | undefined {
  const b = code ? BADGE_BY_CODE.get(code) : undefined;
  return b && { code: b.code, name: b.name, icon: b.icon, tier: b.tier };
}

/** 화면에서 보내 오는 기록: 이름 → 같은 사람이 다시 셀 수 있는 최소 간격(초) */
export const CLIENT_EVENTS: Record<string, number> = {
  palette: 1,
  focus_read: 5,
  cursor_secret: 5,
  shooting_star: 5,
  voice_minute: 50,
  screenshare: 5,
};
