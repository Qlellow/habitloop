package com.loop.community.comment;

import com.loop.community.common.CursorPage;
import com.loop.community.comment.CommentDtos.CommentLikeResponse;
import com.loop.community.comment.CommentDtos.CommentRequest;
import com.loop.community.comment.CommentDtos.CommentResponse;
import com.loop.community.security.AuthUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @GetMapping("/api/posts/{postId}/comments")
    public CursorPage<CommentResponse> list(@PathVariable Long postId,
                                            @RequestParam(required = false) Long cursor,
                                            @RequestParam(defaultValue = "30") int size,
                                            @AuthenticationPrincipal AuthUser user) {
        return commentService.list(postId, cursor, size, user == null ? null : user.id());
    }

    @GetMapping("/api/posts/{postId}/comments/best")
    public List<CommentResponse> best(@PathVariable Long postId, @AuthenticationPrincipal AuthUser user) {
        return commentService.best(postId, user == null ? null : user.id());
    }

    @PostMapping("/api/posts/{postId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse create(@AuthenticationPrincipal AuthUser user, @PathVariable Long postId,
                                  @Valid @RequestBody CommentRequest request) {
        return commentService.create(user.id(), postId, request);
    }

    @DeleteMapping("/api/posts/{postId}/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long postId,
                       @PathVariable Long commentId) {
        commentService.delete(user.id(), postId, commentId);
    }

    @PostMapping("/api/posts/{postId}/comments/{commentId}/like")
    public CommentLikeResponse like(@AuthenticationPrincipal AuthUser user, @PathVariable Long postId,
                                    @PathVariable Long commentId) {
        return commentService.like(user.id(), postId, commentId);
    }

    @DeleteMapping("/api/posts/{postId}/comments/{commentId}/like")
    public CommentLikeResponse unlike(@AuthenticationPrincipal AuthUser user, @PathVariable Long postId,
                                      @PathVariable Long commentId) {
        return commentService.unlike(user.id(), postId, commentId);
    }
}
