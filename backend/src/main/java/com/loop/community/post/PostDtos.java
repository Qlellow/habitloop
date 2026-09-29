package com.loop.community.post;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.loop.community.channel.ChannelRole;
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
            ChannelRole authorRole,
            int likeCount,
            int commentCount,
            long viewCount,
            Instant createdAt) {

        /** authorRole: 작성자의 채널 운영진 역할 (닉네임 옆 배지). 일반 멤버는 null */
        public PostSummary {
            authorRole = ChannelRole.badge(authorRole);
        }
    }

    /** role: 이 글이 있는 채널에서의 운영진 역할 (일반 멤버는 null) */
    public record Author(Long id, String nickname, ChannelRole role) {
    }

    public record ChannelRef(String slug, String name, int iconVersion) {
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
            boolean mine,
            boolean canModerate) {
        // canModerate: 보는 사람이 작성자보다 높은 채널 운영진이라 이 글을 지울 수 있는지
    }

    public record LikeResponse(boolean liked, int likeCount) {
    }
}
