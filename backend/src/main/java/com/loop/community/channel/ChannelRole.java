package com.loop.community.channel;

/**
 * 채널 안에서의 역할.
 * <ul>
 *   <li>OWNER 소유자: 모든 권한 + 운영진 지정</li>
 *   <li>ADMIN 관리자: 채널 관리(정보·프로필·카테고리) + 매니저 권한</li>
 *   <li>MANAGER 매니저: 운영진 전용 카테고리 글쓰기, 다른 사람 글·댓글 삭제</li>
 *   <li>MEMBER 일반 멤버: 글쓰기</li>
 * </ul>
 */
public enum ChannelRole {
    OWNER, ADMIN, MANAGER, MEMBER;

    /** 채널 정보·프로필·카테고리를 관리할 수 있는지 */
    public boolean canManage() {
        return this == OWNER || this == ADMIN;
    }

    /** 운영진(소유자·관리자·매니저)인지: 운영진 전용 카테고리 글쓰기, 글·댓글 정리 */
    public boolean isStaff() {
        return this != MEMBER;
    }

    /**
     * 운영진이 다른 사람의 글·댓글을 지울 수 있는지: 자기보다 아래 역할의 글만 지울 수 있다
     * (매니저는 일반 멤버 글만, 관리자는 매니저·멤버 글까지, 소유자는 모두)
     */
    public boolean canModerate(ChannelRole author) {
        return isStaff() && ordinal() < (author == null ? MEMBER : author).ordinal();
    }

    /** 닉네임 옆 배지로 보여 줄 역할. 일반 멤버는 배지가 없다 */
    public static ChannelRole badge(ChannelRole role) {
        return role == null || role == MEMBER ? null : role;
    }
}
