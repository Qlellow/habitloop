package com.loop.community.post;

import com.loop.community.channel.Channel;
import com.loop.community.channel.ChannelCategory;
import com.loop.community.channel.ChannelCategoryService;
import com.loop.community.channel.ChannelMembershipService;
import com.loop.community.channel.ChannelRepository;
import com.loop.community.channel.ChannelRole;
import com.loop.community.channel.ChannelService;
import com.loop.community.common.ApiException;
import com.loop.community.common.CursorPage;
import com.loop.community.post.PostDtos.Author;
import com.loop.community.post.PostDtos.CategoryRef;
import com.loop.community.post.PostDtos.ChannelRef;
import com.loop.community.post.PostDtos.CreatePostRequest;
import com.loop.community.post.PostDtos.LikeResponse;
import com.loop.community.post.PostDtos.PostDetail;
import com.loop.community.post.PostDtos.PostSummary;
import com.loop.community.post.PostDtos.UpdatePostRequest;
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
    private final ChannelService channelService;
    private final ChannelRepository channelRepository;
    private final ChannelCategoryService categoryService;
    private final ChannelMembershipService membershipService;
    private final ViewCountBuffer viewCountBuffer;

    public PostService(PostRepository postRepository, PostLikeRepository postLikeRepository,
                       UserRepository userRepository, ChannelService channelService,
                       ChannelRepository channelRepository, ChannelCategoryService categoryService,
                       ChannelMembershipService membershipService, ViewCountBuffer viewCountBuffer) {
        this.postRepository = postRepository;
        this.postLikeRepository = postLikeRepository;
        this.userRepository = userRepository;
        this.channelService = channelService;
        this.channelRepository = channelRepository;
        this.categoryService = categoryService;
        this.membershipService = membershipService;
        this.viewCountBuffer = viewCountBuffer;
    }

    @Transactional(readOnly = true)
    public CursorPage<PostSummary> list(PostSearch search, Long cursor, int size) {
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        List<PostSummary> rows = postRepository.findSummaries(search, cursor, pageSize + 1);
        return CursorPage.of(rows, pageSize, PostSummary::id);
    }

    /** 인기글은 모든 방문자가 같은 결과를 보므로 (전체/채널별로) 짧게 캐시해 DB 정렬 쿼리를 줄인다. */
    @Cacheable(value = "popularPosts", key = "#channelSlug == null ? '*' : #channelSlug")
    @Transactional(readOnly = true)
    public List<PostSummary> popular(String channelSlug) {
        return postRepository.findPopular(channelSlug, Instant.now().minus(POPULAR_WINDOW), POPULAR_SIZE);
    }

    @Transactional(readOnly = true)
    public PostDetail detail(Long postId, Long viewerId) {
        Post post = findWithAuthor(postId);
        viewCountBuffer.increment(postId);
        boolean liked = viewerId != null && postLikeRepository.existsByPostIdAndUserId(postId, viewerId);
        return toDetail(post, viewerId, liked);
    }

    @Transactional
    public PostDetail create(Long userId, CreatePostRequest request) {
        Channel channel = channelService.getBySlug(request.channel());
        // 글쓰기는 채널 가입자만 (보기·공감·댓글은 가입 없이 가능)
        membershipService.requireMember(channel, userId);
        ChannelCategory category = categoryService.resolveForPost(channel, request.categoryId(), userId);
        User author = userRepository.getReferenceById(userId);
        Post post = postRepository.save(new Post(author, channel, category, request.title(), request.content()));
        channelRepository.addPostCount(channel.getId(), 1);
        return toDetail(findWithAuthor(post.getId()), userId, false);
    }

    @Transactional
    public PostDetail update(Long userId, Long postId, UpdatePostRequest request) {
        Post post = findWithAuthor(postId);
        if (!post.isWrittenBy(userId)) {
            throw ApiException.forbidden();
        }
        ChannelCategory category = sameCategory(post.getCategory(), request.categoryId())
                ? post.getCategory() // 이미 들어 있던 카테고리는 (관리자 전용이 됐더라도) 그대로 둘 수 있다
                : categoryService.resolveForPost(post.getChannel(), request.categoryId(), userId);
        post.update(category, request.title(), request.content());
        return toDetail(post, userId, postLikeRepository.existsByPostIdAndUserId(postId, userId));
    }

    @Transactional
    @CacheEvict(value = "popularPosts", allEntries = true)
    public void delete(Long userId, Long postId) {
        Post post = postRepository.findById(postId).orElseThrow(PostService::notFound);
        Long channelId = post.getChannel().getId();
        // 작성자 본인, 또는 작성자보다 높은 채널 운영진이 지울 수 있다
        if (!post.isWrittenBy(userId) && !canModerate(channelId, userId, post.getAuthor().getId())) {
            throw ApiException.forbidden();
        }
        postRepository.delete(post); // 댓글·좋아요는 FK ON DELETE CASCADE 로 함께 삭제
        channelRepository.addPostCount(channelId, -1);
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
        return new LikeResponse(true, postRepository.findLikeCount(postId));
    }

    @Transactional
    public LikeResponse unlike(Long userId, Long postId) {
        ensureExists(postId);
        if (postLikeRepository.deleteByPostIdAndUserId(postId, userId) > 0) {
            postRepository.addLikeCount(postId, -1);
        }
        return new LikeResponse(false, postRepository.findLikeCount(postId));
    }

    private static boolean sameCategory(ChannelCategory current, Long requestedId) {
        return current == null ? requestedId == null : current.getId().equals(requestedId);
    }

    private void ensureExists(Long postId) {
        if (!postRepository.existsById(postId)) {
            throw notFound();
        }
    }

    private Post findWithAuthor(Long postId) {
        return postRepository.findWithAuthorById(postId).orElseThrow(PostService::notFound);
    }

    private boolean canModerate(Long channelId, Long userId, Long authorId) {
        ChannelRole role = channelService.roleOf(channelId, userId);
        return role != null && role.canModerate(channelService.roleOf(channelId, authorId));
    }

    private PostDetail toDetail(Post post, Long viewerId, boolean liked) {
        User author = post.getAuthor();
        Channel channel = post.getChannel();
        ChannelCategory category = post.getCategory();
        ChannelRole authorRole = channelService.roleOf(channel.getId(), author.getId());
        ChannelRole viewerRole = channelService.roleOf(channel.getId(), viewerId);
        return new PostDetail(
                post.getId(),
                new ChannelRef(channel.getSlug(), channel.getName(), channel.getIconVersion()),
                category == null ? null : new CategoryRef(category.getId(), category.getName()),
                post.getTitle(),
                post.getContent(),
                new Author(author.getId(), author.getNickname(), ChannelRole.badge(authorRole)),
                post.getLikeCount(),
                post.getCommentCount(),
                post.getViewCount() + viewCountBuffer.pendingOf(post.getId()),
                post.getCreatedAt(),
                post.getUpdatedAt(),
                liked,
                viewerId != null && post.isWrittenBy(viewerId),
                viewerRole != null && !post.isWrittenBy(viewerId) && viewerRole.canModerate(authorRole));
    }

    static ApiException notFound() {
        return ApiException.notFound("게시글을 찾을 수 없어요");
    }
}
