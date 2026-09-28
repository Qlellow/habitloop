package com.loop.community.user;

import com.loop.community.common.ApiException;
import com.loop.community.security.JwtProvider;
import com.loop.community.user.AuthDtos.AuthResponse;
import com.loop.community.user.AuthDtos.LoginRequest;
import com.loop.community.user.AuthDtos.SignupRequest;
import com.loop.community.user.AuthDtos.UserResponse;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtProvider jwtProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtProvider = jwtProvider;
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String nickname = request.nickname().trim();
        if (userRepository.existsByEmail(email)) {
            throw ApiException.conflict("이미 가입된 이메일이에요");
        }
        if (userRepository.existsByNickname(nickname)) {
            throw ApiException.conflict("이미 사용 중인 닉네임이에요");
        }
        User user = userRepository.save(new User(email, passwordEncoder.encode(request.password()), nickname));
        return toAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email().trim().toLowerCase(Locale.ROOT))
                .filter(u -> passwordEncoder.matches(request.password(), u.getPassword()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 맞지 않아요"));
        return toAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse me(Long userId) {
        return userRepository.findById(userId)
                .map(UserResponse::from)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요"));
    }

    private AuthResponse toAuthResponse(User user) {
        return new AuthResponse(jwtProvider.issue(user.getId(), user.getNickname()), UserResponse.from(user));
    }
}
