package com.loop.community.channel;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;

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

    public record ChannelSummary(Long id, String slug, String name, String description, int postCount) {
    }

    public record ChannelDetail(Long id, String slug, String name, String description, int postCount,
                                String ownerNickname, Instant createdAt, boolean mine) {

        static ChannelDetail of(Channel c, Long viewerId) {
            return new ChannelDetail(c.getId(), c.getSlug(), c.getName(), c.getDescription(), c.getPostCount(),
                    c.getOwner() == null ? null : c.getOwner().getNickname(), c.getCreatedAt(),
                    viewerId != null && c.isOwnedBy(viewerId));
        }
    }
}
