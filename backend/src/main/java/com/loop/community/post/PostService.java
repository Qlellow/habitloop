package com.loop.community.post;

import com.loop.community.common.ApiException;
import com.loop.community.common.CursorPage;
import com.loop.community.post.PostDtos.Author;
import com.loop.community.post.PostDtos.LikeResponse;
import com.loop.community.post.PostDtos.PostDetail;
import com.loop.community.post.PostDtos.PostRequest;
import com.loop.community.post.PostDtos.PostSummary;
import com.loop.community.post.PostQueryRepository.PostSearch;
import com.loop.community.user.User;
import com.loop.community.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PostService {

    public static final int MAX_PAGE_SIZE = 50;
    private static final Duration POPULAR_WINDOW = Duration.ofDays(7);
    private static final int POPULAR_SIZE = 5;

    private final PostRepository postRepository;
    private final PostLikeRepository postLikeRepository;
    private final UserRepository userRepository;
    private final ViewCountBuffer viewCountBuffer;

    public PostService(PostRepository postRepository, PostLikeRepository postLikeRepository,
                       UserRepository userRepository, ViewCountBuffer viewCountBuffer) {
        this.postRepository = postRepository;
        this.postLikeRepository = postLikeRepository;
        this.userRepository = userRepository;
        this.viewCountBuffer = viewCountBuffer;
    }

    @Transactional(readOnly = true)
    public CursorPage<PostSummary> list(PostSearch search, Long cursor, int size) {
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        List<PostSummary> rows = postRepository.findSummaries(search, cursor, pageSize + 1);
        return CursorPage.of(rows, pageSize, PostSummary::id);
    }

    /** 인기글은 모든 방문자가 같은 결과를 보므로 짧게 캐시해 DB 정렬 쿼리를 줄인다. */
    @Cacheable("popularPosts")
    @Transactional(readOnly = true)
    public List<PostSummary> popular() {
        return postRepository.findPopular(Instant.now().minus(POPULAR_WINDOW), POPULAR_SIZE);
    }

    @Transactional(readOnly = true)
    public PostDetail detail(Long postId, Long viewerId) {
        Post post = findWithAuthor(postId);
        viewCountBuffer.increment(postId);
        boolean liked = viewerId != null && postLikeRepository.existsByPostIdAndUserId(postId, viewerId);
        return toDetail(post, viewerId, liked);
    }

    @Transactional
    public PostDetail create(Long userId, PostRequest request) {
        User author = userRepository.getReferenceById(userId);
        Post post = postRepository.save(new Post(author, request.category(), request.title(), request.content()));
        return toDetail(findWithAuthor(post.getId()), userId, false);
    }

    @Transactional
    public PostDetail update(Long userId, Long postId, PostRequest request) {
        Post post = findWithAuthor(postId);
        if (!post.isWrittenBy(userId)) {
            throw ApiException.forbidden();
        }
        post.update(request.category(), request.title(), request.content());
        return toDetail(post, userId, postLikeRepository.existsByPostIdAndUserId(postId, userId));
    }

    @Transactional
    @CacheEvict(value = "popularPosts", allEntries = true)
    public void delete(Long userId, Long postId) {
        Post post = postRepository.findById(postId).orElseThrow(PostService::notFound);
        if (!post.isWrittenBy(userId)) {
            throw ApiException.forbidden();
        }
        postRepository.delete(post); // 댓글·좋아요는 FK ON DELETE CASCADE 로 함께 삭제
        viewCountBuffer.discard(postId);
    }

    @Transactional
    public LikeResponse like(Long userId, Long postId) {
        ensureExists(postId);
        // 동시에 두 번 눌리면 (post_id, user_id) unique 제약이 중복을 막고 409 로 응답한다
        if (!postLikeRepository.existsByPostIdAndUserId(postId, userId)) {
            postLikeRepository.saveAndFlush(new PostLike(postId, userId));
            postRepository.addLikeCount(postId, 1);
        }
        return new LikeResponse(true, currentLikeCount(postId));
    }

    @Transactional
    public LikeResponse unlike(Long userId, Long postId) {
        ensureExists(postId);
        if (postLikeRepository.deleteByPostIdAndUserId(postId, userId) > 0) {
            postRepository.addLikeCount(postId, -1);
        }
        return new LikeResponse(false, currentLikeCount(postId));
    }

    private int currentLikeCount(Long postId) {
        return postRepository.findLikeCount(postId);
    }

    private void ensureExists(Long postId) {
        if (!postRepository.existsById(postId)) {
            throw notFound();
        }
    }

    private Post findWithAuthor(Long postId) {
        return postRepository.findWithAuthorById(postId).orElseThrow(PostService::notFound);
    }

    private PostDetail toDetail(Post post, Long viewerId, boolean liked) {
        User author = post.getAuthor();
        return new PostDetail(
                post.getId(),
                post.getCategory(),
                post.getTitle(),
                post.getContent(),
                new Author(author.getId(), author.getNickname()),
                post.getLikeCount(),
                post.getCommentCount(),
                post.getViewCount() + viewCountBuffer.pendingOf(post.getId()),
                post.getCreatedAt(),
                post.getUpdatedAt(),
                liked,
                viewerId != null && post.isWrittenBy(viewerId));
    }

    static ApiException notFound() {
        return ApiException.notFound("게시글을 찾을 수 없어요");
    }
}
