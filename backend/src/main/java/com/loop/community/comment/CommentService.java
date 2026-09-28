package com.loop.community.comment;

import com.loop.community.common.ApiException;
import com.loop.community.common.CursorPage;
import com.loop.community.comment.CommentDtos.CommentRequest;
import com.loop.community.comment.CommentDtos.CommentResponse;
import com.loop.community.post.Post;
import com.loop.community.post.PostRepository;
import com.loop.community.user.User;
import com.loop.community.user.UserRepository;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommentService {

    private static final int MAX_PAGE_SIZE = 100;

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;

    public CommentService(CommentRepository commentRepository, PostRepository postRepository,
                          UserRepository userRepository) {
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public CursorPage<CommentResponse> list(Long postId, Long cursor, int size, Long viewerId) {
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        List<CommentResponse> rows = commentRepository
                .findPage(postId, cursor == null ? 0L : cursor, Limit.of(pageSize + 1))
                .stream()
                .map(c -> CommentResponse.of(c, viewerId))
                .toList();
        return CursorPage.of(rows, pageSize, CommentResponse::id);
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
        return CommentResponse.of(comment, userId);
    }

    @Transactional
    public void delete(Long userId, Long postId, Long commentId) {
        Comment comment = commentRepository.findById(commentId)
                .filter(c -> c.getPost().getId().equals(postId))
                .orElseThrow(() -> ApiException.notFound("댓글을 찾을 수 없어요"));
        if (!comment.isWrittenBy(userId)) {
            throw ApiException.forbidden();
        }
        commentRepository.delete(comment);
        postRepository.addCommentCount(postId, -1);
    }
}
