package com.loop.community.user;

import com.loop.community.security.AuthUser;
import com.loop.community.user.AuthDtos.AuthResponse;
import com.loop.community.user.AuthDtos.ChallengeRequest;
import com.loop.community.user.AuthDtos.CodeRequest;
import com.loop.community.user.AuthDtos.EmailCodeRequest;
import com.loop.community.user.AuthDtos.LoginResponse;
import com.loop.community.user.AuthDtos.LoginVerifyRequest;
import com.loop.community.user.AuthDtos.PasswordConfirmRequest;
import java.util.Map;
import com.loop.community.user.AuthDtos.LoginRequest;
import com.loop.community.user.AuthDtos.PasswordRequest;
import com.loop.community.user.AuthDtos.ProfileRequest;
import com.loop.community.user.AuthDtos.SignupRequest;
import com.loop.community.user.AuthDtos.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** 회원가입 인증번호 받기 (같은 이메일은 60초에 한 번) */
    @PostMapping("/api/auth/signup/code")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void signupCode(@Valid @RequestBody EmailCodeRequest request) {
        authService.sendSignupCode(request.email());
    }

    @PostMapping("/api/auth/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse signup(@Valid @RequestBody SignupRequest request) {
        return authService.signup(request);
    }

    /** 2단계 인증이 켜져 있으면 token 대신 twoFactorRequired + challenge 가 온다 */
    @PostMapping("/api/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/api/auth/login/verify")
    public AuthResponse verifyLogin(@Valid @RequestBody LoginVerifyRequest request) {
        return authService.verifyLogin(request.challenge(), request.code());
    }

    /** 로그인 인증번호 다시 받기: 새 challenge 를 돌려준다 */
    @PostMapping("/api/auth/login/resend")
    public Map<String, String> resendLoginCode(@Valid @RequestBody ChallengeRequest request) {
        return Map.of("challenge", authService.resendLoginCode(request.challenge()));
    }

    /** 2단계 인증 켜기: 내 이메일로 번호 보내기 → 번호 확인 */
    @PostMapping("/api/me/2fa/code")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void twoFactorCode(@AuthenticationPrincipal AuthUser user) {
        authService.sendTwoFactorCode(user.id());
    }

    @PostMapping("/api/me/2fa/enable")
    public UserResponse enableTwoFactor(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody CodeRequest request) {
        return authService.enableTwoFactor(user.id(), request.code());
    }

    @PostMapping("/api/me/2fa/disable")
    public UserResponse disableTwoFactor(@AuthenticationPrincipal AuthUser user,
                                         @Valid @RequestBody PasswordConfirmRequest request) {
        return authService.disableTwoFactor(user.id(), request.password());
    }

    @GetMapping("/api/me")
    public UserResponse me(@AuthenticationPrincipal AuthUser user) {
        return authService.me(user.id());
    }

    @PutMapping("/api/me/profile")
    public AuthResponse updateProfile(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody ProfileRequest request) {
        return authService.updateProfile(user.id(), request);
    }

    @PutMapping("/api/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody PasswordRequest request) {
        authService.changePassword(user.id(), request);
    }
}
