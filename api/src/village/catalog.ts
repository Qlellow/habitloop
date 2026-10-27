/**
 * 채널 마을: 채널 사람들의 활동이 '벽돌'로 쌓여 마을이 자란다.
 * 벽돌: 글 10 · 댓글 3 · 공감/감정 반응 1 · 팔로워 5 (소유자 제외, 숨긴 글 · 댓글 제외)
 * 누적 벽돌(지금까지의 최고치)이 목표를 넘으면 건물 · 장식이 해금되고, 한 번 생긴 건물은 사라지지 않는다
 */
export const BRICKS = { post: 10, comment: 3, reaction: 1, follower: 5 } as const;

export interface VillageItem {
  code: string;
  name: string;
  description: string;
  /** 해금에 필요한 누적 벽돌 */
  bricks: number;
  kind: 'building' | 'deco';
}

export const VILLAGE: VillageItem[] = [
  { code: 'campfire', name: '모닥불', description: '마을의 시작. 누군가 처음 불을 지폈어요', bricks: 0, kind: 'deco' },
  { code: 'tent', name: '텐트', description: '첫 손님들이 머물 곳이 생겼어요', bricks: 30, kind: 'building' },
  { code: 'well', name: '우물', description: '이야기가 샘솟는 우물', bricks: 80, kind: 'building' },
  { code: 'flowers', name: '꽃밭', description: '길가에 꽃이 피기 시작했어요', bricks: 150, kind: 'deco' },
  { code: 'cottage', name: '오두막', description: '오래 머물고 싶은 첫 집', bricks: 250, kind: 'building' },
  { code: 'board', name: '마을 게시판', description: '소식이 붙는 게시판이 섰어요', bricks: 400, kind: 'deco' },
  { code: 'lamps', name: '가로등', description: '밤에도 길이 밝아요', bricks: 600, kind: 'deco' },
  { code: 'cafe', name: '카페', description: '수다가 끊이지 않는 카페', bricks: 900, kind: 'building' },
  { code: 'bench', name: '벤치와 나무', description: '쉬어 갈 그늘이 생겼어요', bricks: 1200, kind: 'deco' },
  { code: 'library', name: '도서관', description: '쌓인 글이 책이 되었어요', bricks: 1600, kind: 'building' },
  { code: 'fountain', name: '분수 광장', description: '모두가 모이는 광장', bricks: 2200, kind: 'deco' },
  { code: 'windmill', name: '풍차', description: '바람과 함께 마을이 돌아가요', bricks: 3000, kind: 'building' },
  { code: 'clocktower', name: '시계탑', description: '마을의 시간을 알리는 탑', bricks: 4000, kind: 'building' },
  { code: 'lighthouse', name: '등대', description: '멀리서도 이 마을을 찾을 수 있어요', bricks: 5500, kind: 'building' },
  { code: 'castle', name: '성', description: '전설이 된 마을의 상징', bricks: 7500, kind: 'building' },
];

/** 주간 공동 목표: 마을이 클수록 조금씩 높아진다. 지난주 목표를 넘기면 이번 주 내내 마을에 축제가 열린다 */
export const weeklyGoal = (level: number) => 40 + level * 20;
