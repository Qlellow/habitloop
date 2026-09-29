package com.loop.community.security;

import com.loop.community.user.UserRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;

/**
 * 토큰 속 사용자가 DB 에 실제로 있는지 확인한다.
 * (DB 를 초기화했거나 계정이 사라졌는데 예전 토큰이 남아 있는 경우를 거른다)
 * 있는 사용자만 1분간 캐시해서, 요청마다 DB 를 조회하지 않는다.
 */
@Component
public class UserExistenceChecker {

    private final UserRepository userRepository;

    public UserExistenceChecker(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Cacheable(value = "userExists", unless = "!#result")
    public boolean exists(Long userId) {
        return userRepository.existsById(userId);
    }
}
