package com.loop.community.channel;

import com.loop.community.channel.ChannelDtos.ChannelDetail;
import com.loop.community.channel.ChannelDtos.ChannelPreview;
import com.loop.community.channel.ChannelDtos.ChannelSummary;
import com.loop.community.channel.ChannelDtos.MembershipResponse;
import com.loop.community.channel.ChannelDtos.CreateChannelRequest;
import com.loop.community.channel.ChannelDtos.UpdateChannelRequest;
import com.loop.community.security.AuthUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
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
public class ChannelController {

    private final ChannelService channelService;
    private final ChannelPreviewService previewService;
    private final ChannelMembershipService membershipService;

    public ChannelController(ChannelService channelService, ChannelPreviewService previewService,
                             ChannelMembershipService membershipService) {
        this.channelService = channelService;
        this.previewService = previewService;
        this.membershipService = membershipService;
    }

    /** q 가 없으면 인기 채널, 있으면 이름/주소 검색 */
    @GetMapping("/api/channels")
    public List<ChannelSummary> list(@RequestParam(required = false) String q) {
        return q == null || q.isBlank() ? channelService.popular() : channelService.search(q);
    }

    /** 채널 목록 페이지용: 채널마다 최근 글 size 개(최대 8)를 함께 돌려준다 */
    @GetMapping("/api/channels/previews")
    public List<ChannelPreview> previews(@RequestParam(required = false) String q,
                                         @RequestParam(defaultValue = "8") int size,
                                         @AuthenticationPrincipal AuthUser user) {
        return previewService.previews(q, size, user == null ? null : user.id());
    }

    /** 채널 가입 (이미 가입했으면 그대로) */
    @PostMapping("/api/channels/{slug}/members")
    public MembershipResponse join(@AuthenticationPrincipal AuthUser user, @PathVariable String slug) {
        return membershipService.join(user.id(), slug);
    }

    /** 채널 탈퇴 (만든 사람은 탈퇴할 수 없다) */
    @DeleteMapping("/api/channels/{slug}/members/me")
    public MembershipResponse leave(@AuthenticationPrincipal AuthUser user, @PathVariable String slug) {
        return membershipService.leave(user.id(), slug);
    }

    /** 내가 가입한 채널 */
    @GetMapping("/api/me/channels")
    public List<ChannelSummary> myChannels(@AuthenticationPrincipal AuthUser user) {
        return membershipService.myChannels(user.id());
    }

    @GetMapping("/api/channels/{slug}")
    public ChannelDetail detail(@PathVariable String slug, @AuthenticationPrincipal AuthUser user) {
        return channelService.detail(slug, user == null ? null : user.id());
    }

    @PostMapping("/api/channels")
    @ResponseStatus(HttpStatus.CREATED)
    public ChannelDetail create(@AuthenticationPrincipal AuthUser user,
                                @Valid @RequestBody CreateChannelRequest request) {
        return channelService.create(user.id(), request);
    }

    @PutMapping("/api/channels/{slug}")
    public ChannelDetail update(@AuthenticationPrincipal AuthUser user, @PathVariable String slug,
                                @Valid @RequestBody UpdateChannelRequest request) {
        return channelService.update(user.id(), slug, request);
    }
}
