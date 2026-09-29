package com.loop.community.channel;

import com.loop.community.channel.ChannelDtos.BookmarkResponse;
import com.loop.community.channel.ChannelDtos.ChannelSummary;
import com.loop.community.channel.ChannelDtos.MyChannel;
import com.loop.community.channel.ChannelDtos.MembershipResponse;
import com.loop.community.common.ApiException;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 채널 가입/탈퇴와 북마크. 가입은 글쓰기 권한이고, 보기·공감·댓글에는 필요 없다. 북마크는 권한과 무관하다. */
@Service
public class ChannelMembershipService {

    private final ChannelService channelService;
    private final ChannelRepository channelRepository;
    private final ChannelMemberRepository memberRepository;
    private final ChannelBookmarkRepository bookmarkRepository;

    public ChannelMembershipService(ChannelService channelService, ChannelRepository channelRepository,
                                    ChannelMemberRepository memberRepository,
                                    ChannelBookmarkRepository bookmarkRepository) {
        this.channelService = channelService;
        this.channelRepository = channelRepository;
        this.memberRepository = memberRepository;
        this.bookmarkRepository = bookmarkRepository;
    }

    /** 여러 번 눌러도 결과가 같다 (이미 가입했으면 그대로) */
    @Transactional
    @CacheEvict(value = "popularChannels", allEntries = true)
    public MembershipResponse join(Long userId, String slug) {
        Channel channel = channelService.getBySlug(slug);
        if (!memberRepository.existsByChannelIdAndUserId(channel.getId(), userId)) {
            // 동시에 두 번 눌리면 (channel_id, user_id) unique 제약이 중복을 막는다
            memberRepository.saveAndFlush(new ChannelMember(channel.getId(), userId));
            channelRepository.addMemberCount(channel.getId(), 1);
        }
        return new MembershipResponse(true, channelRepository.findMemberCount(channel.getId()));
    }

    @Transactional
    @CacheEvict(value = "popularChannels", allEntries = true)
    public MembershipResponse leave(Long userId, String slug) {
        Channel channel = channelService.findWithOwner(slug);
        if (channel.isOwnedBy(userId)) {
            throw ApiException.badRequest("채널을 만든 사람은 탈퇴할 수 없어요");
        }
        if (memberRepository.deleteByChannelIdAndUserId(channel.getId(), userId) > 0) {
            channelRepository.addMemberCount(channel.getId(), -1);
        }
        return new MembershipResponse(false, channelRepository.findMemberCount(channel.getId()));
    }

    /** 글쓰기 전에 확인: 가입하지 않았으면 403 */
    @Transactional(readOnly = true)
    public void requireMember(Channel channel, Long userId) {
        if (!memberRepository.existsByChannelIdAndUserId(channel.getId(), userId)) {
            throw ApiException.forbidden("'" + channel.getName() + "' 채널에 가입해야 글을 쓸 수 있어요");
        }
    }

    /** 여러 번 눌러도 결과가 같다 */
    @Transactional
    public BookmarkResponse bookmark(Long userId, String slug, boolean on) {
        Channel channel = channelService.getBySlug(slug);
        boolean exists = bookmarkRepository.existsByChannelIdAndUserId(channel.getId(), userId);
        if (on && !exists) {
            bookmarkRepository.saveAndFlush(new ChannelBookmark(channel.getId(), userId));
        } else if (!on && exists) {
            bookmarkRepository.deleteByChannelIdAndUserId(channel.getId(), userId);
        }
        return new BookmarkResponse(on);
    }

    @Transactional(readOnly = true)
    public List<ChannelSummary> bookmarkedChannels(Long userId) {
        return bookmarkRepository.findBookmarkedChannels(userId);
    }

    @Transactional(readOnly = true)
    public List<MyChannel> myChannels(Long userId) {
        return memberRepository.findMyChannels(userId);
    }

    @Transactional(readOnly = true)
    public Set<Long> joinedAmong(Long userId, Collection<Long> channelIds) {
        if (userId == null || channelIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(memberRepository.findJoinedChannelIds(userId, channelIds));
    }
}
