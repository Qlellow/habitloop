package com.loop.community.channel;

import com.loop.community.channel.ChannelDtos.CategoryRequest;
import com.loop.community.channel.ChannelDtos.CategoryResponse;
import com.loop.community.common.ApiException;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChannelCategoryService {

    public static final int MAX_CATEGORIES = 20;

    private final ChannelService channelService;
    private final ChannelCategoryRepository categoryRepository;

    public ChannelCategoryService(ChannelService channelService, ChannelCategoryRepository categoryRepository) {
        this.channelService = channelService;
        this.categoryRepository = categoryRepository;
    }

    @Transactional
    public List<CategoryResponse> create(Long userId, String slug, CategoryRequest request) {
        Channel channel = ownedChannel(userId, slug);
        String name = request.name().strip();
        if (categoryRepository.countByChannelId(channel.getId()) >= MAX_CATEGORIES) {
            throw ApiException.badRequest("카테고리는 " + MAX_CATEGORIES + "개까지 만들 수 있어요");
        }
        if (categoryRepository.existsByChannelIdAndName(channel.getId(), name)) {
            throw ApiException.conflict("같은 이름의 카테고리가 이미 있어요");
        }
        int position = categoryRepository.findMaxPosition(channel.getId()) + 1;
        categoryRepository.save(new ChannelCategory(channel, name, request.ownerOnly(), position));
        return list(channel);
    }

    @Transactional
    public List<CategoryResponse> update(Long userId, String slug, Long categoryId, CategoryRequest request) {
        Channel channel = ownedChannel(userId, slug);
        ChannelCategory category = find(channel, categoryId);
        String name = request.name().strip();
        if (!name.equals(category.getName()) && categoryRepository.existsByChannelIdAndName(channel.getId(), name)) {
            throw ApiException.conflict("같은 이름의 카테고리가 이미 있어요");
        }
        category.update(name, request.ownerOnly());
        return list(channel);
    }

    /** 카테고리만 지우고 글은 남긴다 (posts.category_id 는 FK ON DELETE SET NULL) */
    @Transactional
    public List<CategoryResponse> delete(Long userId, String slug, Long categoryId) {
        Channel channel = ownedChannel(userId, slug);
        categoryRepository.delete(find(channel, categoryId));
        categoryRepository.flush();
        return list(channel);
    }

    /** ids 순서대로 position 을 다시 매긴다. 채널의 카테고리를 빠짐없이 한 번씩 보내야 한다. */
    @Transactional
    public List<CategoryResponse> reorder(Long userId, String slug, List<Long> ids) {
        Channel channel = ownedChannel(userId, slug);
        Map<Long, ChannelCategory> byId = categoryRepository.findByChannelIdOrderByPositionAsc(channel.getId())
                .stream().collect(Collectors.toMap(ChannelCategory::getId, Function.identity()));
        if (ids.size() != byId.size() || !byId.keySet().equals(new HashSet<>(ids))) {
            throw ApiException.badRequest("카테고리 목록이 바뀌었어요. 새로고침 후 다시 시도해 주세요");
        }
        for (int i = 0; i < ids.size(); i++) {
            byId.get(ids.get(i)).moveTo(i); // dirty checking + jdbc batch 로 한 번에 반영
        }
        categoryRepository.flush();
        return list(channel);
    }

    /**
     * 글을 쓸 때 고른 카테고리가 그 채널 것인지, 관리자 전용이면 쓰는 사람이 소유자인지 확인한다.
     * categoryId 가 null 이면 카테고리 없이 쓴다.
     */
    @Transactional(readOnly = true)
    public ChannelCategory resolveForPost(Channel channel, Long categoryId, Long userId) {
        if (categoryId == null) {
            return null;
        }
        ChannelCategory category = categoryRepository.findById(categoryId)
                .filter(c -> c.belongsTo(channel.getId()))
                .orElseThrow(() -> ApiException.badRequest("이 채널에 없는 카테고리예요"));
        if (category.isOwnerOnly() && !channel.isOwnedBy(userId)) {
            throw ApiException.forbidden("'" + category.getName() + "' 카테고리는 채널 관리자만 쓸 수 있어요");
        }
        return category;
    }

    private List<CategoryResponse> list(Channel channel) {
        return categoryRepository.findByChannelIdOrderByPositionAsc(channel.getId()).stream()
                .map(CategoryResponse::from)
                .toList();
    }

    private Channel ownedChannel(Long userId, String slug) {
        Channel channel = channelService.findWithOwner(slug);
        if (!channel.isOwnedBy(userId)) {
            throw ApiException.forbidden();
        }
        return channel;
    }

    private ChannelCategory find(Channel channel, Long categoryId) {
        return categoryRepository.findById(categoryId)
                .filter(c -> c.belongsTo(channel.getId()))
                .orElseThrow(() -> ApiException.notFound("카테고리를 찾을 수 없어요"));
    }
}
