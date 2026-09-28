package com.loop.community.post;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class PostDtos {

    private PostDtos() {
    }

    public record PostRequest(
            @NotNull(message = "카테고리를 골라 주세요") Category category,
            @NotBlank(message = "제목을 입력해 주세요") @Size(max = 100, message = "제목은 100자 이내로 입력해 주세요") String title,
            @NotBlank(message = "내용을 입력해 주세요") @Size(max = 20000, message = "내용이 너무 길어요") String content) {
    }

    public record PostSummary(
            Long id,
            Category category,
            String title,
            String excerpt,
            String authorNickname,
            int likeCount,
            int commentCount,
            long viewCount,
            Instant createdAt) {
    }

    public record Author(Long id, String nickname) {
    }

    public record PostDetail(
            Long id,
            Category category,
            String title,
            String content,
            Author author,
            int likeCount,
            int commentCount,
            long viewCount,
            Instant createdAt,
            Instant updatedAt,
            boolean liked,
            boolean mine) {
    }

    public record LikeResponse(boolean liked, int likeCount) {
    }

    public record CategoryResponse(Category value, String label) {
    }
}
