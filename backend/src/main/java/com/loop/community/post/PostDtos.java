package com.loop.community.post;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class PostDtos {

    private PostDtos() {
    }

    public record CreatePostRequest(
            @NotBlank(message = "채널을 골라 주세요") String channel,
            Long categoryId,
            @NotBlank(message = "제목을 입력해 주세요") @Size(max = 100, message = "제목은 100자 이내로 입력해 주세요") String title,
            @NotBlank(message = "내용을 입력해 주세요") @Size(max = 20000, message = "내용이 너무 길어요") String content) {
    }

    /** 글을 옮기면 채널 글 수가 꼬이므로 채널은 바꿀 수 없다. 채널 안의 카테고리는 바꿀 수 있다. */
    public record UpdatePostRequest(
            Long categoryId,
            @NotBlank(message = "제목을 입력해 주세요") @Size(max = 100, message = "제목은 100자 이내로 입력해 주세요") String title,
            @NotBlank(message = "내용을 입력해 주세요") @Size(max = 20000, message = "내용이 너무 길어요") String content) {
    }

    public record PostSummary(
            Long id,
            String channelSlug,
            String channelName,
            String categoryName,
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

    public record ChannelRef(String slug, String name) {
    }

    public record CategoryRef(Long id, String name) {
    }

    public record PostDetail(
            Long id,
            ChannelRef channel,
            CategoryRef category,
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
}
