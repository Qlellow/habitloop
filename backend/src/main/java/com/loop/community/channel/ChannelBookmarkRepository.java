package com.loop.community.channel;

import com.loop.community.channel.ChannelDtos.ChannelSummary;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChannelBookmarkRepository extends JpaRepository<ChannelBookmark, Long> {

    boolean existsByChannelIdAndUserId(Long channelId, Long userId);

    @Modifying
    @Query("delete from ChannelBookmark b where b.channelId = :channelId and b.userId = :userId")
    int deleteByChannelIdAndUserId(@Param("channelId") Long channelId, @Param("userId") Long userId);

    /** 최근에 북마크한 순. (user_id, id) 인덱스를 탄다 */
    @Query("""
            select new com.loop.community.channel.ChannelDtos$ChannelSummary(
                c.id, c.slug, c.name, c.description, c.postCount, c.memberCount)
            from ChannelBookmark b join Channel c on c.id = b.channelId
            where b.userId = :userId
            order by b.id desc
            """)
    List<ChannelSummary> findBookmarkedChannels(@Param("userId") Long userId);
}
