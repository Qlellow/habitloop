package com.loop.community.channel;

import com.loop.community.channel.ChannelDtos.BookmarkResponse;
import com.loop.community.channel.ChannelDtos.ChannelDetail;
import com.loop.community.channel.ChannelDtos.ChannelPreview;
import com.loop.community.channel.ChannelDtos.ChannelSummary;
import com.loop.community.channel.ChannelDtos.MyChannel;
import com.loop.community.channel.ChannelDtos.MembershipResponse;
import com.loop.community.channel.ChannelDtos.CreateChannelRequest;
import com.loop.community.channel.ChannelDtos.UpdateChannelRequest;
import com.loop.community.channel.ChannelDtos.RoleRequest;
import com.loop.community.channel.ChannelDtos.StaffMember;
import com.loop.community.common.ApiException;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestHeader;
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
    private final ChannelStaffService staffService;
    private final ChannelIconService iconService;

    public ChannelController(ChannelService channelService, ChannelPreviewService previewService,
                             ChannelMembershipService membershipService, ChannelStaffService staffService,
                             ChannelIconService iconService) {
        this.channelService = channelService;
        this.previewService = previewService;
        this.membershipService = membershipService;
        this.staffService = staffService;
        this.iconService = iconService;
    }

    /** 운영진 목록 (누구나 볼 수 있다) */
    @GetMapping("/api/channels/{slug}/staff")
    public List<StaffMember> staff(@PathVariable String slug) {
        return staffService.staff(slug);
    }

    /** 운영진으로 지정할 멤버를 닉네임으로 찾기 (소유자만) */
    @GetMapping("/api/channels/{slug}/members")
    public List<StaffMember> searchMembers(@AuthenticationPrincipal AuthUser user, @PathVariable String slug,
                                           @RequestParam(required = false) String q) {
        return staffService.searchMembers(user == null ? null : user.id(), slug, q);
    }

    /** 멤버를 관리자·매니저로 지정하거나 일반 멤버로 되돌린다 (소유자만) */
    @PutMapping("/api/channels/{slug}/members/{userId}/role")
    public List<StaffMember> changeRole(@AuthenticationPrincipal AuthUser user, @PathVariable String slug,
                                        @PathVariable Long userId, @Valid @RequestBody RoleRequest request) {
        return staffService.changeRole(user.id(), slug, userId, request.role());
    }

    /** 프로필 이미지. 주소에 버전(?v=)이 있으면 내용이 바뀌지 않으므로 오래 캐시한다 */
    @GetMapping("/api/channels/{slug}/icon")
    public ResponseEntity<byte[]> icon(@PathVariable String slug, @RequestParam(required = false) Integer v) {
        ChannelIconService.Icon icon = iconService.get(slug);
        CacheControl cache = v == null ? CacheControl.noCache() : CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(icon.contentType()))
                .cacheControl(cache)
                .header("X-Content-Type-Options", "nosniff")
                .body(icon.data());
    }

    /** 이미지 바이트를 그대로 올린다 (Content-Type: image/webp | image/png | image/jpeg) */
    @PutMapping("/api/channels/{slug}/icon")
    public Map<String, Integer> uploadIcon(@AuthenticationPrincipal AuthUser user, @PathVariable String slug,
                                           @RequestHeader(value = "Content-Type", required = false) String contentType,
                                           @RequestBody(required = false) byte[] data) {
        if (data == null) {
            throw ApiException.badRequest("이미지를 골라 주세요");
        }
        return Map.of("iconVersion", iconService.upload(user.id(), slug, contentType, data));
    }

    @DeleteMapping("/api/channels/{slug}/icon")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteIcon(@AuthenticationPrincipal AuthUser user, @PathVariable String slug) {
        iconService.delete(user.id(), slug);
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

    @PutMapping("/api/channels/{slug}/bookmark")
    public BookmarkResponse bookmark(@AuthenticationPrincipal AuthUser user, @PathVariable String slug) {
        return membershipService.bookmark(user.id(), slug, true);
    }

    @DeleteMapping("/api/channels/{slug}/bookmark")
    public BookmarkResponse unbookmark(@AuthenticationPrincipal AuthUser user, @PathVariable String slug) {
        return membershipService.bookmark(user.id(), slug, false);
    }

    /** 내가 북마크한 채널 */
    @GetMapping("/api/me/bookmarks/channels")
    public List<ChannelSummary> bookmarkedChannels(@AuthenticationPrincipal AuthUser user) {
        return membershipService.bookmarkedChannels(user.id());
    }

    /** 내가 가입한 채널 */
    @GetMapping("/api/me/channels")
    public List<MyChannel> myChannels(@AuthenticationPrincipal AuthUser user) {
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
