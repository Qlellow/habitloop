package com.loop.community.channel;

import com.loop.community.channel.ChannelDtos.ChannelSummary;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChannelMemberRepository extends JpaRepository<ChannelMember, Long> {

    boolean existsByChannelIdAndUserId(Long channelId, Long userId);

    @Modifying
    @Query("delete from ChannelMember m where m.channelId = :channelId and m.userId = :userId")
    int deleteByChannelIdAndUserId(@Param("channelId") Long channelId, @Param("userId") Long userId);

    /** 목록에 보이는 채널들 중 내가 가입한 것 (IN 쿼리 한 번) */
    @Query("select m.channelId from ChannelMember m where m.userId = :userId and m.channelId in :channelIds")
    List<Long> findJoinedChannelIds(@Param("userId") Long userId, @Param("channelIds") Collection<Long> channelIds);

    /** 내가 가입한 채널 (최근에 가입한 순). (user_id, channel_id) 인덱스를 탄다 */
    @Query("""
            select new com.loop.community.channel.ChannelDtos$ChannelSummary(
                c.id, c.slug, c.name, c.description, c.postCount, c.memberCount)
            from ChannelMember m join Channel c on c.id = m.channelId
            where m.userId = :userId
            order by m.id desc
            """)
    List<ChannelSummary> findMyChannels(@Param("userId") Long userId);
}
