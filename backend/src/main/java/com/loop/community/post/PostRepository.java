package com.loop.community.post;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long>, PostQueryRepository {

    @Query("select p from Post p join fetch p.author join fetch p.channel left join fetch p.category where p.id = :id")
    Optional<Post> findWithAuthorById(@Param("id") Long id);

    @Query("select p.channel.id from Post p where p.id = :id")
    Optional<Long> findChannelId(@Param("id") Long id);

    // 카운터는 read-modify-write 대신 DB 에서 원자적으로 증감해 동시성 문제와 락 경합을 피한다
    @Query("select p.likeCount from Post p where p.id = :id")
    int findLikeCount(@Param("id") Long id);

    @Modifying
    @Query("update Post p set p.likeCount = p.likeCount + :delta where p.id = :id")
    int addLikeCount(@Param("id") Long id, @Param("delta") int delta);

    @Modifying
    @Query("update Post p set p.commentCount = p.commentCount + :delta where p.id = :id")
    int addCommentCount(@Param("id") Long id, @Param("delta") int delta);

    @Modifying
    @Query("update Post p set p.viewCount = p.viewCount + :delta where p.id = :id")
    int addViewCount(@Param("id") Long id, @Param("delta") long delta);
}
