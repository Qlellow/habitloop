package com.loop.community.comment;

import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
