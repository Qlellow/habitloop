package com.loop.community.post;

import com.loop.community.common.CursorPage;
import com.loop.community.post.PostDtos.CategoryResponse;
import com.loop.community.post.PostDtos.LikeResponse;
import com.loop.community.post.PostDtos.PostDetail;
import com.loop.community.post.PostDtos.PostRequest;
import com.loop.community.post.PostDtos.PostSummary;
import com.loop.community.post.PostQueryRepository.PostSearch;
import com.loop.community.security.AuthUser;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PostController {

    private static final List<CategoryResponse> CATEGORIES = Arrays.stream(Category.values())
            .map(c -> new CategoryResponse(c, c.getLabel()))
            .toList();

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @GetMapping("/api/categories")
    public ResponseEntity<List<CategoryResponse>> categories() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                .body(CATEGORIES);
    }

    @GetMapping("/api/posts")
    public CursorPage<PostSummary> list(
            @RequestParam(required = false) Category category,
            @RequestParam(required = false) Long authorId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") int size) {
        return postService.list(new PostSearch(category, authorId, q), cursor, size);
    }

    @GetMapping("/api/posts/popular")
    public ResponseEntity<List<PostSummary>> popular() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofSeconds(30)).cachePublic())
                .body(postService.popular());
    }

    @GetMapping("/api/posts/{id}")
    public PostDetail detail(@PathVariable Long id, @AuthenticationPrincipal AuthUser user) {
        return postService.detail(id, user == null ? null : user.id());
    }

    @PostMapping("/api/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public PostDetail create(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody PostRequest request) {
        return postService.create(user.id(), request);
    }

    @PutMapping("/api/posts/{id}")
    public PostDetail update(@AuthenticationPrincipal AuthUser user, @PathVariable Long id,
                             @Valid @RequestBody PostRequest request) {
        return postService.update(user.id(), id, request);
    }

    @DeleteMapping("/api/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        postService.delete(user.id(), id);
    }

    @PostMapping("/api/posts/{id}/like")
    public LikeResponse like(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        return postService.like(user.id(), id);
    }

    @DeleteMapping("/api/posts/{id}/like")
    public LikeResponse unlike(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        return postService.unlike(user.id(), id);
    }
}
