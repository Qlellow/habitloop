package com.loop.community.comment;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentLikeRepository extends JpaRepository<CommentLike, Long> {

    boolean existsByCommentIdAndUserId(Long commentId, Long userId);

    /** 한 페이지 댓글들의 좋아요 여부를 IN 쿼리 한 번으로 조회 (댓글마다 조회하는 N+1 방지) */
    @Query("select l.commentId from CommentLike l where l.userId = :userId and l.commentId in :commentIds")
    List<Long> findLikedCommentIds(@Param("userId") Long userId, @Param("commentIds") Collection<Long> commentIds);

    @Modifying
    @Query("delete from CommentLike l where l.commentId = :commentId and l.userId = :userId")
    int deleteByCommentIdAndUserId(@Param("commentId") Long commentId, @Param("userId") Long userId);
}
