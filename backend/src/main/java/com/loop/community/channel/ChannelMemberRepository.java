package com.loop.community.channel;

import com.loop.community.channel.ChannelDtos.MyChannel;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import com.loop.community.channel.ChannelDtos.StaffMember;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChannelMemberRepository extends JpaRepository<ChannelMember, Long> {

    boolean existsByChannelIdAndUserId(Long channelId, Long userId);

    Optional<ChannelMember> findByChannelIdAndUserId(Long channelId, Long userId);

    @Query("select m.role from ChannelMember m where m.channelId = :channelId and m.userId = :userId")
    Optional<ChannelRole> findRole(@Param("channelId") Long channelId, @Param("userId") Long userId);

    /** 운영진 (소유자 → 관리자 → 매니저, 같은 역할이면 먼저 가입한 순) */
    @Query("""
            select new com.loop.community.channel.ChannelDtos$StaffMember(u.id, u.nickname, m.role)
            from ChannelMember m join User u on u.id = m.userId
            where m.channelId = :channelId and m.role <> com.loop.community.channel.ChannelRole.MEMBER
            order by case m.role when com.loop.community.channel.ChannelRole.OWNER then 0
                                 when com.loop.community.channel.ChannelRole.ADMIN then 1 else 2 end, m.id asc
            """)
    List<StaffMember> findStaff(@Param("channelId") Long channelId);

    /** 운영진으로 지정할 멤버를 닉네임으로 찾는다 */
    @Query("""
            select new com.loop.community.channel.ChannelDtos$StaffMember(u.id, u.nickname, m.role)
            from ChannelMember m join User u on u.id = m.userId
            where m.channelId = :channelId and lower(u.nickname) like :pattern escape '\\'
            order by m.id asc
            """)
    List<StaffMember> searchMembers(@Param("channelId") Long channelId, @Param("pattern") String pattern, Limit limit);

    /** 글·댓글 작성자 중 운영진인 사람의 역할 (닉네임 옆 배지용). (channel_id, user_id) unique 인덱스를 탄다 */
    @Query("""
            select m from ChannelMember m
            where m.channelId = :channelId and m.userId in :userIds
              and m.role <> com.loop.community.channel.ChannelRole.MEMBER
            """)
    List<ChannelMember> findStaffAmong(@Param("channelId") Long channelId, @Param("userIds") Collection<Long> userIds);

    @Modifying
    @Query("delete from ChannelMember m where m.channelId = :channelId and m.userId = :userId")
    int deleteByChannelIdAndUserId(@Param("channelId") Long channelId, @Param("userId") Long userId);

    /** 목록에 보이는 채널들 중 내가 가입한 것 (IN 쿼리 한 번) */
    @Query("select m.channelId from ChannelMember m where m.userId = :userId and m.channelId in :channelIds")
    List<Long> findJoinedChannelIds(@Param("userId") Long userId, @Param("channelIds") Collection<Long> channelIds);

    /** 내가 가입한 채널 (최근에 가입한 순). (user_id, channel_id) 인덱스를 탄다 */
    @Query("""
            select new com.loop.community.channel.ChannelDtos$MyChannel(
                c.id, c.slug, c.name, c.description, c.postCount, c.memberCount, c.iconVersion, m.role)
            from ChannelMember m join Channel c on c.id = m.channelId
            where m.userId = :userId
            order by m.id desc
            """)
    List<MyChannel> findMyChannels(@Param("userId") Long userId);
}
