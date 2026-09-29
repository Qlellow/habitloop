package com.loop.community.user;

import jakarta.validation.constraints.Email;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record SignupRequest(
            @NotBlank(message = "이메일을 입력해 주세요") @Email(message = "이메일 형식이 아니에요") @Size(max = 100) String email,
            @NotBlank(message = "비밀번호를 입력해 주세요") @Size(min = 8, max = 64, message = "비밀번호는 8자 이상이어야 해요") String password,
            @NotBlank(message = "닉네임을 입력해 주세요") @Size(min = 2, max = 20, message = "닉네임은 2~20자로 입력해 주세요") String nickname,
            @NotBlank(message = "이메일로 받은 인증번호를 입력해 주세요") @Pattern(regexp = "^\\s*\\d{6}\\s*$", message = "인증번호 6자리를 입력해 주세요") String code) {
    }

    /** 회원가입 인증번호 받기 */
    public record EmailCodeRequest(
            @NotBlank(message = "이메일을 입력해 주세요") @Email(message = "이메일 형식이 아니에요") @Size(max = 100) String email) {
    }

    /** 2단계 인증 로그인: 비밀번호 확인 뒤 받은 challenge + 이메일로 받은 번호 */
    public record LoginVerifyRequest(
            @NotBlank(message = "다시 로그인해 주세요") String challenge,
            @NotBlank(message = "인증번호를 입력해 주세요") String code) {
    }

    public record ChallengeRequest(@NotBlank(message = "다시 로그인해 주세요") String challenge) {
    }

    public record CodeRequest(@NotBlank(message = "인증번호를 입력해 주세요") String code) {
    }

    public record PasswordConfirmRequest(@NotBlank(message = "비밀번호를 입력해 주세요") String password) {
    }

    /**
     * 로그인 결과. 2단계 인증이 꺼져 있으면 token·user 가 오고,
     * 켜져 있으면 twoFactorRequired=true 와 challenge(번호 입력용 일회용 토큰), 가린 이메일이 온다.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LoginResponse(String token, UserResponse user, boolean twoFactorRequired, String challenge,
                                String maskedEmail) {
    }

    public record LoginRequest(
            @NotBlank(message = "이메일을 입력해 주세요") String email,
            @NotBlank(message = "비밀번호를 입력해 주세요") String password) {
    }

    public record ProfileRequest(
            @NotBlank(message = "닉네임을 입력해 주세요") @Size(min = 2, max = 20, message = "닉네임은 2~20자로 입력해 주세요") String nickname) {
    }

    public record PasswordRequest(
            @NotBlank(message = "지금 비밀번호를 입력해 주세요") String currentPassword,
            @NotBlank(message = "새 비밀번호를 입력해 주세요") @Size(min = 8, max = 64, message = "새 비밀번호는 8자 이상이어야 해요") String newPassword) {
    }

    public record UserResponse(Long id, String email, String nickname, boolean twoFactorEnabled) {
        public static UserResponse from(User user) {
            return new UserResponse(user.getId(), user.getEmail(), user.getNickname(), user.isTwoFactorEnabled());
        }
    }

    public record AuthResponse(String token, UserResponse user) {
    }
}
