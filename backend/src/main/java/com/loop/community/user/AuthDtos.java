package com.loop.community.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record SignupRequest(
            @NotBlank(message = "이메일을 입력해 주세요") @Email(message = "이메일 형식이 아니에요") @Size(max = 100) String email,
            @NotBlank(message = "비밀번호를 입력해 주세요") @Size(min = 8, max = 64, message = "비밀번호는 8자 이상이어야 해요") String password,
            @NotBlank(message = "닉네임을 입력해 주세요") @Size(min = 2, max = 20, message = "닉네임은 2~20자로 입력해 주세요") String nickname) {
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

    public record UserResponse(Long id, String email, String nickname) {
        public static UserResponse from(User user) {
            return new UserResponse(user.getId(), user.getEmail(), user.getNickname());
        }
    }

    public record AuthResponse(String token, UserResponse user) {
    }
}
