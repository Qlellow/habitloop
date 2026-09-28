package com.loop.community.channel;

import com.loop.community.common.ApiException;
import com.loop.community.channel.ChannelDtos.ChannelDetail;
import com.loop.community.channel.ChannelDtos.ChannelSummary;
import com.loop.community.channel.ChannelDtos.CreateChannelRequest;
import com.loop.community.channel.ChannelDtos.UpdateChannelRequest;
import com.loop.community.user.UserRepository;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChannelService {

    private static final int POPULAR_SIZE = 30;
    private static final int SEARCH_SIZE = 30;
    /** 라우트와 겹치거나 오해를 부를 수 있는 주소는 막는다 */
    private static final Set<String> RESERVED = Set.of("new", "all", "admin", "api", "me", "search", "write", "loop");

    private final ChannelRepository channelRepository;
    private final ChannelCategoryRepository categoryRepository;
    private final UserRepository userRepository;

    public ChannelService(ChannelRepository channelRepository, ChannelCategoryRepository categoryRepository,
                          UserRepository userRepository) {
        this.channelRepository = channelRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
    }

    /** 홈과 채널 목록에 매번 노출되므로 짧게 캐시한다. */
    @Cacheable("popularChannels")
    @Transactional(readOnly = true)
    public List<ChannelSummary> popular() {
        return channelRepository.findPopular(Limit.of(POPULAR_SIZE));
    }

    @Transactional(readOnly = true)
    public List<ChannelSummary> search(String keyword) {
        String escaped = keyword.strip().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return channelRepository.search("%" + escaped + "%", Limit.of(SEARCH_SIZE));
    }

    @Transactional(readOnly = true)
    public ChannelDetail detail(String slug, Long viewerId) {
        Channel channel = findWithOwner(slug);
        return ChannelDetail.of(channel, viewerId, categoryRepository.findByChannelIdOrderByPositionAsc(channel.getId()));
    }

    @Transactional
    @CacheEvict(value = "popularChannels", allEntries = true)
    public ChannelDetail create(Long userId, CreateChannelRequest request) {
        String slug = request.slug().strip().toLowerCase(Locale.ROOT);
        String name = request.name().strip();
        if (RESERVED.contains(slug) || channelRepository.existsBySlug(slug)) {
            throw ApiException.conflict("이미 사용 중인 채널 주소예요");
        }
        if (channelRepository.existsByName(name)) {
            throw ApiException.conflict("같은 이름의 채널이 이미 있어요");
        }
        Channel channel = channelRepository.save(
                new Channel(slug, name, request.description(), userRepository.getReferenceById(userId)));
        return ChannelDetail.of(findWithOwner(channel.getSlug()), userId, List.of());
    }

    @Transactional
    @CacheEvict(value = "popularChannels", allEntries = true)
    public ChannelDetail update(Long userId, String slug, UpdateChannelRequest request) {
        Channel channel = findWithOwner(slug);
        if (!channel.isOwnedBy(userId)) {
            throw ApiException.forbidden();
        }
        String name = request.name().strip();
        if (!name.equals(channel.getName()) && channelRepository.existsByName(name)) {
            throw ApiException.conflict("같은 이름의 채널이 이미 있어요");
        }
        channel.update(name, request.description());
        return ChannelDetail.of(channel, userId, categoryRepository.findByChannelIdOrderByPositionAsc(channel.getId()));
    }

    @Transactional(readOnly = true)
    public Channel getBySlug(String slug) {
        return channelRepository.findBySlug(slug).orElseThrow(ChannelService::notFound);
    }

    Channel findWithOwner(String slug) {
        return channelRepository.findWithOwnerBySlug(slug).orElseThrow(ChannelService::notFound);
    }

    static ApiException notFound() {
        return ApiException.notFound("채널을 찾을 수 없어요");
    }
}
