package com.loop.community.channel;

import com.loop.community.channel.ChannelDtos.ChannelPreview;
import com.loop.community.channel.ChannelDtos.ChannelSummary;
import com.loop.community.post.PostDtos.PostSummary;
import com.loop.community.post.PostRepository;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 채널 목록 + 채널별 최근 글 미리보기. 채널 수와 상관없이 쿼리 수가 일정하다 (채널 목록, 가입 여부, 글 id, 글 내용). */
@Service
public class ChannelPreviewService {

    public static final int MAX_POSTS_PER_CHANNEL = 8;

    private final ChannelService channelService;
    private final ChannelMembershipService membershipService;
    private final PostRepository postRepository;

    public ChannelPreviewService(ChannelService channelService, ChannelMembershipService membershipService,
                                 PostRepository postRepository) {
        this.channelService = channelService;
        this.membershipService = membershipService;
        this.postRepository = postRepository;
    }

    @Transactional(readOnly = true)
    public List<ChannelPreview> previews(String keyword, int postsPerChannel, Long viewerId) {
        int perChannel = Math.clamp(postsPerChannel, 0, MAX_POSTS_PER_CHANNEL);
        // 인기 채널 목록은 캐시되어 있어 대부분 DB 를 타지 않는다
        List<ChannelSummary> channels = keyword == null || keyword.isBlank()
                ? channelService.popular()
                : channelService.search(keyword);

        List<Long> ids = channels.stream().map(ChannelSummary::id).toList();
        Set<Long> joined = membershipService.joinedAmong(viewerId, ids);
        Map<String, List<PostSummary>> postsByChannel = postRepository
                .findRecentByChannels(ids, perChannel)
                .stream()
                .collect(Collectors.groupingBy(PostSummary::channelSlug));

        return channels.stream()
                .map(c -> new ChannelPreview(c.id(), c.slug(), c.name(), c.description(), c.postCount(),
                        c.memberCount(), joined.contains(c.id()), postsByChannel.getOrDefault(c.slug(), List.of())))
                .toList();
    }
}
