export interface User {
  /** 사용자 UUID */
  id: string;
  email: string;
  nickname: string;
  /** 2단계 인증: 켜면 로그인할 때 이메일로 받은 인증번호를 한 번 더 입력한다 */
  twoFactorEnabled?: boolean;
  /** 설정에서 생년월일로 나이를 확인했는지 */
  ageChecked?: boolean;
  /** 만 19세 이상 (19세 이상 채널·카테고리를 볼 수 있다) */
  adult?: boolean;
  /** 확인한 생년월일 (YYYY-MM-DD) */
  birthDate?: string;
  /** 프로필 사진 주소 (없으면 닉네임 첫 글자) */
  avatarUrl?: string;
  /** 배너: 'p:기본배너' · 'i:이미지id' */
  banner?: string;
  /** 가진 포인트 */
  points?: number;
  /** 커스텀 배너를 열었는지 */
  customBanner?: boolean;
}

/** 로그인한 기기 (마이페이지 > 설정 > 로그인한 기기) */
export interface LoginSession {
  id: string;
  /** "Chrome · Windows" 처럼 사람이 알아볼 이름 */
  device: string;
  createdAt: string;
  lastUsedAt: string;
  /** 지금 이 기기 */
  current: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * 로그인 결과. 2단계 인증이 꺼져 있으면 token·user 가,
 * 켜져 있으면 twoFactorRequired 와 번호 입력용 challenge, 가린 이메일이 온다.
 */
export interface LoginResponse {
  token?: string;
  user?: User;
  twoFactorRequired: boolean;
  challenge?: string;
  maskedEmail?: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor?: number;
}

/**
 * 채널 운영진 역할. 닉네임 옆 배지로 보여 준다 (일반 멤버는 역할 없음 = undefined)
 * - OWNER 소유자 · ADMIN 관리자(채널 관리) · MANAGER 매니저(글·댓글 정리)
 */
export type ChannelRole = 'OWNER' | 'ADMIN' | 'MANAGER';

export interface ChannelSummary {
  id: number;
  /** 고리: 채널 주소(/c/고리)에 쓰이는 짧은 이름 */
  slug: string;
  name: string;
  /** 마크다운 */
  description: string;
  postCount: number;
  memberCount: number;
  /** 0 보다 크면 프로필 이미지가 있다 (channelIconUrl 로 주소를 만든다) */
  iconVersion: number;
  /** 이미지가 없을 때 프로필 색 번호 (CHANNEL_COLORS). 없으면 고리로 정한 색 */
  color?: number | null;
  /** public: 누구나 / private: 초대로만 팔로우, 팔로워만 볼 수 있다 */
  visibility?: 'public' | 'private';
  /** 만 19세 이상만 */
  adult?: boolean;
}

/** 채널 목록용: 채널 + 최근 글 미리보기(최대 8개) */
export interface ChannelPreview extends ChannelSummary {
  /** 보는 사람이 가입했는지 (비로그인은 false) */
  joined: boolean;
  recentPosts: PostSummary[];
}

/** 내가 팔로우한 채널 (owner: 내가 만든 채널) */
export interface MyChannel extends ChannelSummary {
  owner: boolean;
  role?: ChannelRole;
}

/** 운영진 목록 · 멤버 검색 결과 (role 이 'MEMBER' 면 일반 멤버) */
export interface StaffMember {
  /** 사용자 UUID */
  userId: string;
  nickname: string;
  role: ChannelRole | 'MEMBER';
}

export interface MembershipResponse {
  joined: boolean;
  memberCount: number;
}

export interface ChannelCategory {
  id: number;
  name: string;
  /** 운영진(소유자·관리자·매니저)만 글을 쓸 수 있는 카테고리 (공지사항 등) */
  ownerOnly: boolean;
  /** 만 19세 이상만 볼 수 있는 카테고리 */
  adult?: boolean;
}

export interface ChannelDetail extends ChannelSummary {
  /** 볼 수 없는 채널: private(초대 필요) · adult(나이 확인 필요). 이때는 이름·프로필만 온다 */
  locked?: 'private' | 'adult';
  /** 운영진(관리)에게만: 비공개 채널 초대 코드 */
  inviteCode?: string;
  ownerNickname?: string;
  createdAt: string;
  /** 소유자인지 */
  mine: boolean;
  /** 보는 사람의 운영진 역할 (일반 멤버·비회원은 없음) */
  myRole?: ChannelRole;
  /** 채널 관리(정보·프로필·카테고리)를 할 수 있는지: 소유자·관리자 */
  canManage: boolean;
  /** 운영진 전용 카테고리에 글을 쓸 수 있는지: 소유자·관리자·매니저 */
  staff: boolean;
  /** 운영진에게만: 처리 전 신고 수 */
  reportCount?: number;
  /** 가입해야 글을 쓸 수 있다 (보기·공감·댓글은 가입 없이 가능) */
  joined: boolean;
  /** 북마크 (가입과 별개) */
  bookmarked: boolean;
  categories: ChannelCategory[];
}

export interface ChannelInput {
  slug?: string;
  name: string;
  description: string;
  /** 기본 프로필 색 번호 */
  color?: number;
  visibility?: 'public' | 'private';
  adult?: boolean;
}

/** 초대 화면에 보이는 채널 정보 */
export interface InviteInfo {
  slug: string;
  name: string;
  iconVersion: number;
  color: number | null;
  memberCount: number;
  adult: boolean;
  joined: boolean;
}

export interface PostSummary {
  id: number;
  channelSlug: string;
  channelName: string;
  categoryName?: string;
  title: string;
  excerpt: string;
  /** 작성자 UUID */
  authorId: string;
  authorNickname: string;
  authorAvatar?: string | null;
  authorRole?: ChannelRole;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
}

/** 번호 페이지 목록 (채널 글 목록) */
export interface PostPage {
  items: PostSummary[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** 작성자 프로필 (공개 정보만) */
/** 사용자 검색 결과 */
export interface UserSearchResult {
  /** 사용자 UUID */
  id: string;
  nickname: string;
  avatarUrl?: string | null;
}

export interface UserProfile {
  /** 사용자 UUID */
  id: string;
  nickname: string;
  createdAt: string;
  postCount: number;
  commentCount: number;
  avatarUrl?: string | null;
  banner?: string | null;
  /** 받은 배지 (도전과제) */
  badges?: Badge[];
  /** 내가 이 사람을 차단했는지 */
  blocked?: boolean;
  /** 프로필에 전시한 펫 */
  pet?: PetPublic;
}

/** 내가 차단한 사용자 (설정) */
export interface BlockedUser {
  id: string;
  nickname: string;
  avatarUrl?: string;
  blockedAt: string;
}

export interface Badge {
  code: string;
  name: string;
  description: string;
  earnedAt: string;
}

/** 출석 체크 결과: awarded 가 false 면 오늘 이미 출석했다 */
export interface AttendanceResult {
  awarded: boolean;
  earned: number;
  streak: number;
}

/** 내 초대 코드 (가입 주소의 ?ref=) 와 초대한 사람 수 */
export interface MyInvite {
  code: string;
  invitedCount: number;
}

export interface PointLog {
  id: number;
  delta: number;
  reason: string;
  createdAt: string;
}

/** 알림 종류: 내 글에 댓글 · 내 댓글에 답글 · 내 글에 공감 · 팔로우한 채널의 새 공지 */
export type NotificationType = 'comment' | 'reply' | 'like' | 'notice';

export interface NotificationItem {
  id: number;
  type: NotificationType;
  /** 알림을 만든 사람 (공감은 마지막으로 누른 사람). 없어진 계정이면 비어 있다 */
  actor?: { id: string; nickname: string; avatarUrl?: string };
  /** 공감: 읽기 전까지 모인 사람 수 */
  count: number;
  post: { id: number; title: string; channelSlug: string; channelName: string };
  /** 댓글 · 답글 앞부분 */
  comment?: { id: number; excerpt: string };
  read: boolean;
  createdAt: string;
}

export interface PostDetail {
  id: number;
  channel: { slug: string; name: string; iconVersion: number; color?: number | null };
  category?: { id: number; name: string };
  title: string;
  content: string;
  author: { id: string; nickname: string; avatarUrl?: string; role?: ChannelRole };
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  liked: boolean;
  /** 감정 반응 종류별 수 */
  reactions?: Partial<Record<ReactionKind, number>>;
  /** 내가 누른 감정 반응 */
  myReactions?: ReactionKind[];
  mine: boolean;
  /** 보는 사람이 작성자보다 높은 채널 운영진이라 이 글을 지울 수 있는지 */
  canModerate: boolean;
  /** 운영진이 숨긴 글 (쓴 사람 · 운영진에게만 보인다) */
  hidden?: boolean;
  /** 내가 차단한 사람의 글 */
  blockedAuthor?: boolean;
}

export interface PostInput {
  /** 새 글일 때만 필요 (채널은 옮길 수 없음) */
  channel?: string;
  categoryId?: number | null;
  title: string;
  content: string;
}

export interface Comment {
  id: number;
  /** 작성자 UUID */
  authorId: string;
  authorNickname: string;
  authorAvatar?: string;
  authorRole?: ChannelRole;
  content: string;
  likeCount: number;
  liked: boolean;
  createdAt: string;
  mine: boolean;
  /** 내 댓글이거나, 내가 작성자보다 높은 채널 운영진이라 지울 수 있는지 */
  deletable: boolean;
  /** 고친 시각 (고친 적이 없으면 없음) */
  updatedAt?: string;
  /** 답글이면 어느 댓글의 답글인지 */
  parentId?: number;
  /** 답글 (오래된 순, 목록에서만) */
  replies?: Comment[];
  /** 운영진이 숨긴 댓글. 쓴 사람 · 운영진이 아니면 content 가 비어 있다 */
  hidden?: boolean;
  /** 내가 차단한 사람의 댓글 (content 가 비어 있다) */
  blocked?: boolean;
}

/** 커뮤니티 펫 */
export type PetSpecies = 'slime' | 'cat' | 'chick';
/** 알 → 아기(Lv1) → 어린이(Lv5) → 어른(Lv10) */
export type PetStage = 'egg' | 'baby' | 'junior' | 'adult';
/** 최근 활동에 따라: 신남(하루 안) · 보통(사흘 안) · 졸림 */
export type PetMood = 'happy' | 'calm' | 'sleepy';
export const PET_SPECIES: { species: PetSpecies; label: string; desc: string }[] = [
  { species: 'slime', label: '슬라임', desc: '말랑말랑 통통 튀어요' },
  { species: 'cat', label: '고양이', desc: '느긋하게 어슬렁거려요' },
  { species: 'chick', label: '병아리', desc: '종종거리며 바빠요' },
];
export const PET_STAGES: Record<PetStage, { label: string; from: number }> = {
  egg: { label: '알', from: 0 },
  baby: { label: '아기', from: 1 },
  junior: { label: '어린이', from: 5 },
  adult: { label: '어른', from: 10 },
};

export interface PetPublic {
  species: PetSpecies;
  name: string;
  level: number;
  stage: PetStage;
  mood: PetMood;
  /** 레벨 15 리본, 20 왕관 */
  accessory?: 'ribbon' | 'crown';
}

export interface Pet extends PetPublic {
  xp: number;
  /** 지금 레벨이 시작된 경험치 · 다음 레벨 경험치 */
  levelXp: number;
  nextXp: number;
  shown: boolean;
  adoptedAt: string;
  pettedToday: boolean;
  stats: { posts: number; comments: number; likes: number; reactions: number };
}

/** 감정 반응 (좋아요와 따로, 종류마다 한 번씩) */
export type ReactionKind = 'clap' | 'laugh' | 'wow' | 'sad' | 'fire';
export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'clap', emoji: '👏', label: '응원해요' },
  { kind: 'laugh', emoji: '😂', label: '웃겨요' },
  { kind: 'wow', emoji: '😮', label: '놀라워요' },
  { kind: 'sad', emoji: '😢', label: '슬퍼요' },
  { kind: 'fire', emoji: '🔥', label: '최고예요' },
];

export interface ReactionResponse {
  reactions: Partial<Record<ReactionKind, number>>;
  myReactions: ReactionKind[];
}

/** 신고 사유 */
export type ReportReason = 'spam' | 'abuse' | 'adult' | 'illegal' | 'privacy' | 'other';
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: '스팸 · 홍보' },
  { value: 'abuse', label: '욕설 · 비하 · 괴롭힘' },
  { value: 'adult', label: '음란 · 선정적인 내용' },
  { value: 'illegal', label: '불법 정보' },
  { value: 'privacy', label: '개인정보 노출' },
  { value: 'other', label: '기타' },
];

/** 신고함 한 줄: 같은 글 · 댓글의 신고를 모은 것 */
export interface ReportGroup {
  postId: number;
  /** 댓글 신고면 그 댓글 */
  commentId?: number;
  postTitle: string;
  /** 댓글 내용 또는 글 앞부분 */
  excerpt: string;
  author: { id: string; nickname: string };
  count: number;
  reasons: ReportReason[];
  /** 신고한 사람들이 적은 자세한 내용 (최근 5개) */
  details: string[];
  status: 'open' | 'hidden' | 'dismissed';
  hidden: boolean;
  lastReportedAt: string;
  /** 숨기기 · 지우기를 할 수 있는지 (나보다 아래 역할의 글 · 댓글만) */
  canAct: boolean;
}

export type ReportAction = 'hide' | 'unhide' | 'delete' | 'dismiss';

export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}
