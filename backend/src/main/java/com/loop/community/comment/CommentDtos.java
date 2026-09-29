package com.loop.community.comment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.loop.community.channel.ChannelRole;
import java.time.Instant;

public final class CommentDtos {

    private CommentDtos() {
    }

    public record CommentRequest(
            @NotBlank(message = "댓글을 입력해 주세요") @Size(max = 1000, message = "댓글은 1000자 이내로 입력해 주세요") String content) {
    }

    /** authorRole: 작성자의 채널 운영진 역할 (닉네임 옆 배지). 일반 멤버는 null */
    /** deletable: 내 댓글이거나, 내가 작성자보다 높은 채널 운영진이라 지울 수 있는지 */
    public record CommentResponse(Long id, Long authorId, String authorNickname, ChannelRole authorRole,
                                  String content, int likeCount, boolean liked, Instant createdAt, boolean mine,
                                  boolean deletable) {

        static CommentResponse of(Comment comment, Long viewerId, boolean liked, ChannelRole authorRole,
                                  ChannelRole viewerRole) {
            boolean mine = viewerId != null && comment.isWrittenBy(viewerId);
            return new CommentResponse(
                    comment.getId(),
                    comment.getAuthor().getId(),
                    comment.getAuthor().getNickname(),
                    ChannelRole.badge(authorRole),
                    comment.getContent(),
                    comment.getLikeCount(),
                    liked,
                    comment.getCreatedAt(),
                    mine,
                    mine || (viewerRole != null && viewerRole.canModerate(authorRole)));
        }
    }

    public record CommentLikeResponse(boolean liked, int likeCount) {
    }
}
