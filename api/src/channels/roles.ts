/**
 * 채널 안에서의 역할.
 * - OWNER 소유자: 모든 권한 + 운영진 지정
 * - ADMIN 관리자: 채널 관리(정보·프로필·카테고리) + 매니저 권한
 * - MANAGER 매니저: 운영진 전용 카테고리 글쓰기, 아래 역할의 글·댓글 삭제
 * - MEMBER 일반 멤버: 글쓰기
 */
export type ChannelRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';
export const ROLES: ChannelRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'];

const RANK: Record<ChannelRole, number> = { OWNER: 0, ADMIN: 1, MANAGER: 2, MEMBER: 3 };

/** 채널 정보·프로필·카테고리를 관리할 수 있는지 */
export const canManage = (role?: ChannelRole | null) => role === 'OWNER' || role === 'ADMIN';

/** 운영진(소유자·관리자·매니저)인지 */
export const isStaff = (role?: ChannelRole | null) => !!role && role !== 'MEMBER';

/** 자기보다 아래 역할의 글·댓글만 지울 수 있다 (매니저 → 멤버, 관리자 → 매니저·멤버, 소유자 → 모두) */
export const canModerate = (role: ChannelRole | null | undefined, author: ChannelRole | null | undefined) =>
  isStaff(role) && RANK[role!] < RANK[author ?? 'MEMBER'];

/** 닉네임 옆 배지로 보여 줄 역할. 일반 멤버·비회원은 배지가 없다 */
export const badge = (role?: ChannelRole | null) => (role && role !== 'MEMBER' ? role : undefined);
