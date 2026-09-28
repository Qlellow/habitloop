package com.loop.community.comment;

import com.loop.community.common.ApiException;
import com.loop.community.common.CursorPage;
import com.loop.community.comment.CommentDtos.CommentLikeResponse;
import com.loop.community.comment.CommentDtos.CommentRequest;
import com.loop.community.comment.CommentDtos.CommentResponse;
import com.loop.community.post.Post;
import com.loop.community.post.PostRepository;
import com.loop.community.user.User;
import com.loop.community.user.UserRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommentService {

    private static final int MAX_PAGE_SIZE = 100;
    /** 베스트 댓글이 되려면 받아야 하는 최소 좋아요 수 */
    public static final int BEST_MIN_LIKES = 2;
    private static final int BEST_SIZE = 3;

    private final CommentRepository commentRepository;
    private final CommentLikeRepository commentLikeRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;

    public CommentService(CommentRepository commentRepository, CommentLikeRepository commentLikeRepository,
                          PostRepository postRepository, UserRepository userRepository) {
        this.commentRepository = commentRepository;
        this.commentLikeRepository = commentLikeRepository;
        this.postRepository = postRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public CursorPage<CommentResponse> list(Long postId, Long cursor, int size, Long viewerId) {
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        List<Comment> rows = commentRepository.findPage(postId, cursor == null ? 0L : cursor, Limit.of(pageSize + 1));
        return CursorPage.of(toResponses(rows, viewerId), pageSize, CommentResponse::id);
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> best(Long postId, Long viewerId) {
        return toResponses(commentRepository.findBest(postId, BEST_MIN_LIKES, Limit.of(BEST_SIZE)), viewerId);
    }

    @Transactional
    public CommentResponse create(Long userId, Long postId, CommentRequest request) {
        if (!postRepository.existsById(postId)) {
            throw ApiException.notFound("게시글을 찾을 수 없어요");
        }
        Post post = postRepository.getReferenceById(postId);
        User author = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없어요"));
        Comment comment = commentRepository.save(new Comment(post, author, request.content()));
        postRepository.addCommentCount(postId, 1);
        return CommentResponse.of(comment, userId, false);
    }

    @Transactional
    public void delete(Long userId, Long postId, Long commentId) {
        Comment comment = find(postId, commentId);
        if (!comment.isWrittenBy(userId)) {
            throw ApiException.forbidden();
        }
        commentRepository.delete(comment); // 댓글 좋아요는 FK ON DELETE CASCADE
        postRepository.addCommentCount(postId, -1);
    }

    @Transactional
    public CommentLikeResponse like(Long userId, Long postId, Long commentId) {
        find(postId, commentId);
        if (!commentLikeRepository.existsByCommentIdAndUserId(commentId, userId)) {
            commentLikeRepository.saveAndFlush(new CommentLike(commentId, userId));
            commentRepository.addLikeCount(commentId, 1);
        }
        return new CommentLikeResponse(true, commentRepository.findLikeCount(commentId));
    }

    @Transactional
    public CommentLikeResponse unlike(Long userId, Long postId, Long commentId) {
        find(postId, commentId);
        if (commentLikeRepository.deleteByCommentIdAndUserId(commentId, userId) > 0) {
            commentRepository.addLikeCount(commentId, -1);
        }
        return new CommentLikeResponse(false, commentRepository.findLikeCount(commentId));
    }

    private Comment find(Long postId, Long commentId) {
        return commentRepository.findById(commentId)
                .filter(c -> c.getPost().getId().equals(postId))
                .orElseThrow(() -> ApiException.notFound("댓글을 찾을 수 없어요"));
    }

    private List<CommentResponse> toResponses(List<Comment> comments, Long viewerId) {
        Set<Long> liked = viewerId == null || comments.isEmpty()
                ? Set.of()
                : new HashSet<>(commentLikeRepository.findLikedCommentIds(
                        viewerId, comments.stream().map(Comment::getId).toList()));
        return comments.stream()
                .map(c -> CommentResponse.of(c, viewerId, liked.contains(c.getId())))
                .toList();
    }
}
