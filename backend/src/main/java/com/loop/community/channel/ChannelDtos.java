package com.loop.community.channel;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import com.loop.community.post.PostDtos.PostSummary;
import java.util.List;

public final class ChannelDtos {

    /** 채널 소개(마크다운) 최대 길이 */
    public static final int MAX_DESCRIPTION = 2000;

    private ChannelDtos() {
    }

    public record CreateChannelRequest(
            @NotBlank(message = "채널 고리를 입력해 주세요")
            @Pattern(regexp = "^[a-z0-9][a-z0-9_-]{1,29}$",
                    message = "고리는 영문 소문자·숫자·-·_ 로 2~30자여야 해요") String slug,
            @NotBlank(message = "채널 이름을 입력해 주세요") @Size(min = 2, max = 20, message = "채널 이름은 2~20자로 입력해 주세요") String name,
            @Size(max = MAX_DESCRIPTION, message = "소개는 2000자 이내로 입력해 주세요") String description) {
    }

    public record UpdateChannelRequest(
            @NotBlank(message = "채널 이름을 입력해 주세요") @Size(min = 2, max = 20, message = "채널 이름은 2~20자로 입력해 주세요") String name,
            @Size(max = MAX_DESCRIPTION, message = "소개는 2000자 이내로 입력해 주세요") String description) {
    }

    /** iconVersion > 0 이면 프로필 이미지가 있다: /api/channels/{slug}/icon?v={iconVersion} */
    public record ChannelSummary(Long id, String slug, String name, String description, int postCount,
                                 int memberCount, int iconVersion) {
    }

    /** 채널 목록에서 보여 줄 채널 + 최근 글 미리보기 */
    public record ChannelPreview(Long id, String slug, String name, String description, int postCount,
                                 int memberCount, int iconVersion, boolean joined, List<PostSummary> recentPosts) {
    }

    public record MembershipResponse(boolean joined, int memberCount) {
    }

    public record BookmarkResponse(boolean bookmarked) {
    }

    /** 내가 가입한 채널. owner 면 탈퇴 대신 관리 버튼을 보여 준다 */
    public record MyChannel(Long id, String slug, String name, String description, int postCount, int memberCount,
                            int iconVersion, ChannelRole role, boolean owner) {

        public MyChannel(Long id, String slug, String name, String description, int postCount, int memberCount,
                         int iconVersion, ChannelRole role) {
            this(id, slug, name, description, postCount, memberCount, iconVersion, ChannelRole.badge(role),
                    role == ChannelRole.OWNER);
        }
    }

    /** 운영진 목록 · 멤버 검색 결과 */
    public record StaffMember(Long userId, String nickname, ChannelRole role) {
    }

    public record RoleRequest(@NotNull(message = "역할을 골라 주세요") ChannelRole role) {
    }

    /**
     * joined: 보는 사람이 이 채널에 가입했는지 (가입해야 글을 쓸 수 있다)
     * mine: 소유자인지, myRole: 보는 사람의 운영진 역할 (일반 멤버·비회원은 null)
     * canManage: 채널 관리(정보·프로필·카테고리) 가능, staff: 운영진 전용 카테고리에 글쓰기 가능
     */
    public record ChannelDetail(Long id, String slug, String name, String description, int postCount,
                                int memberCount, int iconVersion, String ownerNickname, Instant createdAt,
                                boolean mine, ChannelRole myRole, boolean canManage, boolean staff,
                                boolean joined, boolean bookmarked, List<CategoryResponse> categories) {

        static ChannelDetail of(Channel c, ChannelRole role, boolean bookmarked, List<ChannelCategory> categories) {
            return new ChannelDetail(c.getId(), c.getSlug(), c.getName(), c.getDescription(), c.getPostCount(),
                    c.getMemberCount(), c.getIconVersion(), c.getOwner() == null ? null : c.getOwner().getNickname(),
                    c.getCreatedAt(), role == ChannelRole.OWNER, ChannelRole.badge(role),
                    role != null && role.canManage(), role != null && role.isStaff(), role != null, bookmarked,
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
