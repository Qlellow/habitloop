package com.loop.community.channel;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChannelCategoryRepository extends JpaRepository<ChannelCategory, Long> {

    /** (channel_id, position) 인덱스 순서 그대로 읽는다 */
    List<ChannelCategory> findByChannelIdOrderByPositionAsc(Long channelId);

    long countByChannelId(Long channelId);

    boolean existsByChannelIdAndName(Long channelId, String name);

    @Query("select coalesce(max(c.position), -1) from ChannelCategory c where c.channel.id = :channelId")
    int findMaxPosition(@Param("channelId") Long channelId);
}
