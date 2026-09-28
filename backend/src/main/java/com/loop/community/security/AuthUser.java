package com.loop.community.security;

/** 토큰에서 복원한 로그인 사용자. 요청마다 DB를 조회하지 않도록 필요한 정보만 담는다. */
public record AuthUser(Long id, String nickname) {
}
