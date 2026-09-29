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
            select new com.loop.community.channel.ChannelDtos$ChannelSummary(c.id, c.slug, c.name, c.description, c.postCount, c.memberCount, c.iconVersion)
            from Channel c order by c.postCount desc, c.id asc
            """)
    List<ChannelSummary> findPopular(Limit limit);

    /** 채널 이름에 검색어가 들어간 채널. 이름이 검색어로 시작하는 채널을 먼저, 그다음 글이 많은 순 */
    @Query("""
            select new com.loop.community.channel.ChannelDtos$ChannelSummary(c.id, c.slug, c.name, c.description, c.postCount, c.memberCount, c.iconVersion)
            from Channel c
            where lower(c.name) like :pattern escape '\\'
            order by case when lower(c.name) like :prefix escape '\\' then 0 else 1 end,
                     c.postCount desc, c.id asc
            """)
    List<ChannelSummary> search(@Param("pattern") String pattern, @Param("prefix") String prefix, Limit limit);

    @Modifying
    @Query("update Channel c set c.postCount = c.postCount + :delta where c.id = :id")
    int addPostCount(@Param("id") Long id, @Param("delta") int delta);

    // 같은 트랜잭션에서 방금 만든 채널을 다시 읽을 때 옛 값(0)이 보이지 않도록 영속성 컨텍스트를 비운다
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Channel c set c.memberCount = c.memberCount + :delta where c.id = :id")
    int addMemberCount(@Param("id") Long id, @Param("delta") int delta);

    /** 프로필 이미지를 올리면 버전을 올리고(양수), 지우면 부호만 바꾼다(음수) — V6 마이그레이션 설명 참고 */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Channel c set c.iconVersion = abs(c.iconVersion) + 1 where c.id = :id")
    int bumpIconVersion(@Param("id") Long id);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Channel c set c.iconVersion = -abs(c.iconVersion) where c.id = :id")
    int hideIcon(@Param("id") Long id);

    @Query("select c.memberCount from Channel c where c.id = :id")
    int findMemberCount(@Param("id") Long id);
}
