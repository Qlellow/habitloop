package com.loop.community.channel;

import com.loop.community.channel.ChannelDtos.CategoryOrderRequest;
import com.loop.community.channel.ChannelDtos.CategoryRequest;
import com.loop.community.channel.ChannelDtos.CategoryResponse;
import com.loop.community.security.AuthUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 모든 응답은 바뀐 뒤의 전체 카테고리 목록이라, 클라이언트는 그대로 캐시에 덮어쓰면 된다. */
@RestController
public class ChannelCategoryController {

    private final ChannelCategoryService categoryService;

    public ChannelCategoryController(ChannelCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @PostMapping("/api/channels/{slug}/categories")
    public List<CategoryResponse> create(@AuthenticationPrincipal AuthUser user, @PathVariable String slug,
                                         @Valid @RequestBody CategoryRequest request) {
        return categoryService.create(user.id(), slug, request);
    }

    @PutMapping("/api/channels/{slug}/categories/order")
    public List<CategoryResponse> reorder(@AuthenticationPrincipal AuthUser user, @PathVariable String slug,
                                          @Valid @RequestBody CategoryOrderRequest request) {
        return categoryService.reorder(user.id(), slug, request.ids());
    }

    @PutMapping("/api/channels/{slug}/categories/{categoryId}")
    public List<CategoryResponse> update(@AuthenticationPrincipal AuthUser user, @PathVariable String slug,
                                         @PathVariable Long categoryId, @Valid @RequestBody CategoryRequest request) {
        return categoryService.update(user.id(), slug, categoryId, request);
    }

    @DeleteMapping("/api/channels/{slug}/categories/{categoryId}")
    public List<CategoryResponse> delete(@AuthenticationPrincipal AuthUser user, @PathVariable String slug,
                                         @PathVariable Long categoryId) {
        return categoryService.delete(user.id(), slug, categoryId);
    }
}
