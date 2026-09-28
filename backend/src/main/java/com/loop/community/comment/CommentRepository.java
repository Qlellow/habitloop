package com.loop.community.comment;

import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    /** (post_id, id) 인덱스를 타는 키셋 페이지네이션. 작성자는 fetch join 으로 한 번에 가져와 N+1 을 막는다. */
    @Query("""
            select c from Comment c join fetch c.author
            where c.post.id = :postId and c.id > :cursor
            order by c.id asc
            """)
    List<Comment> findPage(@Param("postId") Long postId, @Param("cursor") long cursor, Limit limit);

    /** 베스트 댓글: (post_id, like_count) 인덱스로 좋아요가 일정 수 이상인 댓글만 본다 */
    @Query("""
            select c from Comment c join fetch c.author
            where c.post.id = :postId and c.likeCount >= :minLikes
            order by c.likeCount desc, c.id asc
            """)
    List<Comment> findBest(@Param("postId") Long postId, @Param("minLikes") int minLikes, Limit limit);

    @Query("select c.likeCount from Comment c where c.id = :id")
    int findLikeCount(@Param("id") Long id);

    @Modifying
    @Query("update Comment c set c.likeCount = c.likeCount + :delta where c.id = :id")
    int addLikeCount(@Param("id") Long id, @Param("delta") int delta);
}
