package com.loop.community.channel;

import com.loop.community.common.ApiException;
import java.util.Set;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 채널 프로필 이미지. 브라우저가 정사각형으로 자르고 작게 줄여서(256px) 올리므로 서버는 형식과 크기만 확인한다.
 * 이미지 주소에 버전(?v=)이 붙어 있어 한 번 받은 이미지는 1년 동안 캐시된다.
 */
@Service
public class ChannelIconService {

    public static final int MAX_BYTES = 512 * 1024;
    private static final Set<String> TYPES = Set.of("image/webp", "image/png", "image/jpeg");

    private final ChannelService channelService;
    private final ChannelRepository channelRepository;
    private final ChannelIconRepository iconRepository;

    public ChannelIconService(ChannelService channelService, ChannelRepository channelRepository,
                              ChannelIconRepository iconRepository) {
        this.channelService = channelService;
        this.channelRepository = channelRepository;
        this.iconRepository = iconRepository;
    }

    public record Icon(String contentType, byte[] data) {
    }

    @Transactional(readOnly = true)
    public Icon get(String slug) {
        Channel channel = channelService.getBySlug(slug);
        return iconRepository.findById(channel.getId())
                .filter(i -> channel.getIconVersion() > 0)
                .map(i -> new Icon(i.getContentType(), i.getData()))
                .orElseThrow(() -> ApiException.notFound("프로필 이미지가 없어요"));
    }

    /** 새 버전 번호를 돌려준다 */
    @Transactional
    @CacheEvict(value = "popularChannels", allEntries = true)
    public int upload(Long userId, String slug, String contentType, byte[] data) {
        Channel channel = channelService.requireManager(slug, userId);
        String type = contentType == null ? "" : contentType.split(";")[0].strip().toLowerCase();
        if (!TYPES.contains(type)) {
            throw ApiException.badRequest("PNG, JPG, WEBP 이미지만 올릴 수 있어요");
        }
        if (data.length == 0 || data.length > MAX_BYTES) {
            throw ApiException.badRequest("이미지는 512KB 이하로 올려 주세요");
        }
        iconRepository.findById(channel.getId()).ifPresentOrElse(
                icon -> icon.replace(type, data),
                () -> iconRepository.save(new ChannelIcon(channel.getId(), type, data)));
        channelRepository.bumpIconVersion(channel.getId());
        return channelRepository.findById(channel.getId()).orElseThrow().getIconVersion();
    }

    @Transactional
    @CacheEvict(value = "popularChannels", allEntries = true)
    public void delete(Long userId, String slug) {
        Channel channel = channelService.requireManager(slug, userId);
        iconRepository.deleteById(channel.getId());
        channelRepository.hideIcon(channel.getId());
    }
}
