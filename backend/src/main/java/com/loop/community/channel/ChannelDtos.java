package com.loop.community.channel;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import com.loop.community.post.PostDtos.PostSummary;
import java.util.List;

public final class ChannelDtos {

    private ChannelDtos() {
    }

    public record CreateChannelRequest(
            @NotBlank(message = "채널 주소를 입력해 주세요")
            @Pattern(regexp = "^[a-z0-9][a-z0-9_-]{1,29}$",
                    message = "채널 주소는 영문 소문자·숫자·-·_ 로 2~30자여야 해요") String slug,
            @NotBlank(message = "채널 이름을 입력해 주세요") @Size(min = 2, max = 20, message = "채널 이름은 2~20자로 입력해 주세요") String name,
            @Size(max = 200, message = "소개는 200자 이내로 입력해 주세요") String description) {
    }

    public record UpdateChannelRequest(
            @NotBlank(message = "채널 이름을 입력해 주세요") @Size(min = 2, max = 20, message = "채널 이름은 2~20자로 입력해 주세요") String name,
            @Size(max = 200, message = "소개는 200자 이내로 입력해 주세요") String description) {
    }

    public record ChannelSummary(Long id, String slug, String name, String description, int postCount,
                                 int memberCount) {
    }

    /** 채널 목록에서 보여 줄 채널 + 최근 글 미리보기 */
    public record ChannelPreview(Long id, String slug, String name, String description, int postCount,
                                 int memberCount, boolean joined, List<PostSummary> recentPosts) {
    }

    public record MembershipResponse(boolean joined, int memberCount) {
    }

    /** joined: 보는 사람이 이 채널에 가입했는지 (가입해야 글을 쓸 수 있다) */
    public record ChannelDetail(Long id, String slug, String name, String description, int postCount,
                                int memberCount, String ownerNickname, Instant createdAt, boolean mine,
                                boolean joined, List<CategoryResponse> categories) {

        static ChannelDetail of(Channel c, Long viewerId, boolean joined, List<ChannelCategory> categories) {
            return new ChannelDetail(c.getId(), c.getSlug(), c.getName(), c.getDescription(), c.getPostCount(),
                    c.getMemberCount(), c.getOwner() == null ? null : c.getOwner().getNickname(), c.getCreatedAt(),
                    viewerId != null && c.isOwnedBy(viewerId), joined,
                    categories.stream().map(CategoryResponse::from).toList());
        }
    }

    public record CategoryRequest(
            @NotBlank(message = "카테고리 이름을 입력해 주세요") @Size(max = 20, message = "카테고리 이름은 20자 이내로 입력해 주세요") String name,
            boolean ownerOnly) {
    }

    public record CategoryOrderRequest(@NotNull(message = "순서를 보내 주세요") List<Long> ids) {
    }

    public record CategoryResponse(Long id, String name, boolean ownerOnly) {
        static CategoryResponse from(ChannelCategory c) {
            return new CategoryResponse(c.getId(), c.getName(), c.isOwnerOnly());
        }
    }
}
