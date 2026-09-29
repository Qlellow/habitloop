package com.loop.community.channel;

import com.loop.community.channel.ChannelDtos.ChannelSummary;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChannelRepository extends JpaRepository<Channel, Long> {

    Optional<Channel> findBySlug(String slug);

    @Query("select c from Channel c left join fetch c.owner where c.slug = :slug")
    Optional<Channel> findWithOwnerBySlug(@Param("slug") String slug);

    boolean existsBySlug(String slug);

    boolean existsByName(String name);

    @Query("""
            select new com.loop.community.channel.ChannelDtos$ChannelSummary(c.id, c.slug, c.name, c.description, c.postCount, c.memberCount)
            from Channel c order by c.postCount desc, c.id asc
            """)
    List<ChannelSummary> findPopular(Limit limit);

    @Query("""
            select new com.loop.community.channel.ChannelDtos$ChannelSummary(c.id, c.slug, c.name, c.description, c.postCount, c.memberCount)
            from Channel c
            where lower(c.name) like :pattern escape '\\' or c.slug like :pattern escape '\\'
            order by c.postCount desc, c.id asc
            """)
    List<ChannelSummary> search(@Param("pattern") String pattern, Limit limit);

    @Modifying
    @Query("update Channel c set c.postCount = c.postCount + :delta where c.id = :id")
    int addPostCount(@Param("id") Long id, @Param("delta") int delta);

    // 같은 트랜잭션에서 방금 만든 채널을 다시 읽을 때 옛 값(0)이 보이지 않도록 영속성 컨텍스트를 비운다
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Channel c set c.memberCount = c.memberCount + :delta where c.id = :id")
    int addMemberCount(@Param("id") Long id, @Param("delta") int delta);

    @Query("select c.memberCount from Channel c where c.id = :id")
    int findMemberCount(@Param("id") Long id);
}
