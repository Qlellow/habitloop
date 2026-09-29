package com.loop.community.channel;

import com.loop.community.channel.ChannelDtos.StaffMember;
import com.loop.community.common.ApiException;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 채널 운영진(관리자·매니저) 지정. 지정과 해제는 소유자만 할 수 있다. */
@Service
public class ChannelStaffService {

    private static final int SEARCH_SIZE = 10;
    /** 한 채널의 운영진(소유자 제외) 최대 인원 */
    public static final int MAX_STAFF = 20;

    private final ChannelService channelService;
    private final ChannelMemberRepository memberRepository;

    public ChannelStaffService(ChannelService channelService, ChannelMemberRepository memberRepository) {
        this.channelService = channelService;
        this.memberRepository = memberRepository;
    }

    @Transactional(readOnly = true)
    public List<StaffMember> staff(String slug) {
        return memberRepository.findStaff(channelService.getBySlug(slug).getId());
    }

    /** 운영진으로 지정할 멤버 찾기 (소유자만) */
    @Transactional(readOnly = true)
    public List<StaffMember> searchMembers(Long userId, String slug, String keyword) {
        Channel channel = requireOwner(userId, slug);
        String escaped = keyword == null ? "" : keyword.strip().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        if (escaped.isEmpty()) {
            return List.of();
        }
        return memberRepository.searchMembers(channel.getId(), "%" + escaped + "%", Limit.of(SEARCH_SIZE));
    }

    /** 멤버의 역할을 관리자·매니저·일반 멤버로 바꾼다. 여러 번 보내도 결과가 같다 */
    @Transactional
    public List<StaffMember> changeRole(Long userId, String slug, Long targetUserId, ChannelRole role) {
        Channel channel = requireOwner(userId, slug);
        if (role == ChannelRole.OWNER) {
            throw ApiException.badRequest("소유자는 넘길 수 없어요");
        }
        ChannelMember member = memberRepository.findByChannelIdAndUserId(channel.getId(), targetUserId)
                .orElseThrow(() -> ApiException.badRequest("채널에 가입한 사람만 운영진으로 지정할 수 있어요"));
        if (member.getRole() == ChannelRole.OWNER) {
            throw ApiException.badRequest("소유자의 역할은 바꿀 수 없어요");
        }
        if (role.isStaff() && !member.getRole().isStaff()
                && memberRepository.findStaff(channel.getId()).size() > MAX_STAFF) {
            throw ApiException.badRequest("운영진은 " + MAX_STAFF + "명까지 지정할 수 있어요");
        }
        member.changeRole(role);
        memberRepository.flush();
        return memberRepository.findStaff(channel.getId());
    }

    private Channel requireOwner(Long userId, String slug) {
        Channel channel = channelService.findWithOwner(slug);
        if (userId == null || !channel.isOwnedBy(userId)) {
            throw ApiException.forbidden("운영진은 채널 소유자만 지정할 수 있어요");
        }
        return channel;
    }
}
