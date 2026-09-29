package com.loop.community.user;

import com.loop.community.common.ApiException;
import com.loop.community.mail.CodePurpose;
import com.loop.community.mail.Mailer;
import com.loop.community.mail.VerificationService;
import com.loop.community.security.JwtProvider;
import com.loop.community.user.AuthDtos.AuthResponse;
import com.loop.community.user.AuthDtos.LoginResponse;
import com.loop.community.user.AuthDtos.LoginRequest;
import com.loop.community.user.AuthDtos.PasswordRequest;
import com.loop.community.user.AuthDtos.ProfileRequest;
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
    private final VerificationService verification;
    private final Mailer mailer;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtProvider jwtProvider,
                       VerificationService verification, Mailer mailer) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtProvider = jwtProvider;
        this.verification = verification;
        this.mailer = mailer;
    }

    /** 회원가입 1단계: 이메일로 인증번호 보내기 */
    @Transactional
    public void sendSignupCode(String rawEmail) {
        String email = normalize(rawEmail);
        if (userRepository.existsByEmail(email)) {
            throw ApiException.conflict("이미 가입된 이메일이에요");
        }
        verification.send(email, CodePurpose.SIGNUP, null);
    }

    /** 회원가입 2단계: 받은 번호가 맞으면 계정을 만든다 */
    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String email = normalize(request.email());
        String nickname = request.nickname().trim();
        if (userRepository.existsByEmail(email)) {
            throw ApiException.conflict("이미 가입된 이메일이에요");
        }
        if (userRepository.existsByNickname(nickname)) {
            throw ApiException.conflict("이미 사용 중인 닉네임이에요");
        }
        // 닉네임 중복 같은 다른 문제를 먼저 알려 주고, 번호는 마지막에 확인해서 쓴다
        verification.verify(email, CodePurpose.SIGNUP, request.code());
        User user = userRepository.save(new User(email, passwordEncoder.encode(request.password()), nickname));
        return toAuthResponse(user);
    }

    /** 비밀번호가 맞으면 토큰을 준다. 2단계 인증이 켜져 있으면 대신 이메일로 번호를 보내고 challenge 를 준다 */
    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(normalize(request.email()))
                .filter(u -> passwordEncoder.matches(request.password(), u.getPassword()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 맞지 않아요"));
        if (user.isTwoFactorEnabled()) {
            String challenge = verification.send(user.getEmail(), CodePurpose.LOGIN, user.getId());
            return new LoginResponse(null, null, true, challenge, mask(user.getEmail()));
        }
        AuthResponse auth = toAuthResponse(user);
        return new LoginResponse(auth.token(), auth.user(), false, null, null);
    }

    /** 2단계 인증 로그인: 이메일로 받은 번호 확인 */
    @Transactional(readOnly = true)
    public AuthResponse verifyLogin(String challenge, String code) {
        Long userId = verification.verifyChallenge(challenge, code);
        return toAuthResponse(find(userId));
    }

    @Transactional
    public String resendLoginCode(String challenge) {
        return verification.resendChallenge(challenge);
    }

    /** 2단계 인증 켜기 1단계: 내 이메일로 번호 보내기 */
    @Transactional
    public void sendTwoFactorCode(Long userId) {
        User user = find(userId);
        if (user.isTwoFactorEnabled()) {
            throw ApiException.badRequest("이미 2단계 인증을 쓰고 있어요");
        }
        verification.send(user.getEmail(), CodePurpose.ENABLE_2FA, userId);
    }

    /** 2단계 인증 켜기 2단계: 번호가 맞으면 켜고 알림 메일을 보낸다 */
    @Transactional
    public UserResponse enableTwoFactor(Long userId, String code) {
        User user = find(userId);
        verification.verify(user.getEmail(), CodePurpose.ENABLE_2FA, code);
        user.setTwoFactorEnabled(true);
        mailer.sendNotice(user.getEmail(), "2단계 인증이 켜졌어요",
                "이제 로그인할 때 비밀번호와 함께 이 이메일로 받은 인증번호를 입력해야 해요.\n"
                        + "직접 켠 것이 아니라면 바로 비밀번호를 바꿔 주세요.");
        return UserResponse.from(user);
    }

    /** 2단계 인증 끄기: 비밀번호를 한 번 더 확인한다 */
    @Transactional
    public UserResponse disableTwoFactor(Long userId, String password) {
        User user = find(userId);
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw ApiException.badRequest("비밀번호가 맞지 않아요");
        }
        if (user.isTwoFactorEnabled()) {
            user.setTwoFactorEnabled(false);
            mailer.sendNotice(user.getEmail(), "2단계 인증이 꺼졌어요",
                    "이제 비밀번호만으로 로그인할 수 있어요.\n직접 끈 것이 아니라면 바로 비밀번호를 바꾸고 2단계 인증을 다시 켜 주세요.");
        }
        return UserResponse.from(user);
    }

    @Transactional(readOnly = true)
    public UserResponse me(Long userId) {
        return userRepository.findById(userId)
                .map(UserResponse::from)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요"));
    }

    /** 닉네임은 토큰에도 들어 있으므로 새 토큰을 함께 돌려준다 */
    @Transactional
    public AuthResponse updateProfile(Long userId, ProfileRequest request) {
        User user = find(userId);
        String nickname = request.nickname().trim();
        if (!nickname.equals(user.getNickname()) && userRepository.existsByNickname(nickname)) {
            throw ApiException.conflict("이미 사용 중인 닉네임이에요");
        }
        user.changeNickname(nickname);
        return toAuthResponse(user);
    }

    @Transactional
    public void changePassword(Long userId, PasswordRequest request) {
        User user = find(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw ApiException.badRequest("지금 비밀번호가 맞지 않아요");
        }
        if (request.currentPassword().equals(request.newPassword())) {
            throw ApiException.badRequest("지금 비밀번호와 다른 비밀번호를 입력해 주세요");
        }
        user.changePassword(passwordEncoder.encode(request.newPassword()));
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    /** qlellow0702@gmail.com → ql*******02@gmail.com */
    static String mask(String email) {
        int at = email.indexOf('@');
        if (at <= 2) {
            return email.charAt(0) + "***" + email.substring(Math.max(at, 0));
        }
        String local = email.substring(0, at);
        if (local.length() <= 4) {
            return local.charAt(0) + "*".repeat(local.length() - 1) + email.substring(at);
        }
        return local.substring(0, 2) + "*".repeat(local.length() - 4) + local.substring(local.length() - 2)
                + email.substring(at);
    }

    private User find(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요"));
    }

    private AuthResponse toAuthResponse(User user) {
        return new AuthResponse(jwtProvider.issue(user.getId(), user.getNickname()), UserResponse.from(user));
    }
}
