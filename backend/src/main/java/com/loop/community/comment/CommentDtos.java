package com.loop.community.comment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class CommentDtos {

    private CommentDtos() {
    }

    public record CommentRequest(
            @NotBlank(message = "댓글을 입력해 주세요") @Size(max = 1000, message = "댓글은 1000자 이내로 입력해 주세요") String content) {
    }

    public record CommentResponse(Long id, Long authorId, String authorNickname, String content,
                                  Instant createdAt, boolean mine) {

        static CommentResponse of(Comment comment, Long viewerId) {
            return new CommentResponse(
                    comment.getId(),
                    comment.getAuthor().getId(),
                    comment.getAuthor().getNickname(),
                    comment.getContent(),
                    comment.getCreatedAt(),
                    viewerId != null && comment.isWrittenBy(viewerId));
        }
    }
}
