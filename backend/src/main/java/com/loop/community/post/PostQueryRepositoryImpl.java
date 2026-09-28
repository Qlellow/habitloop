package com.loop.community.post;

import com.loop.community.post.PostDtos.PostSummary;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.util.List;

/**
 * 목록 조회 전용 쿼리. 엔티티 대신 DTO 로 바로 프로젝션해서
 * 본문(TEXT) 컬럼 로딩과 영속성 컨텍스트 관리 비용을 없앤다.
 * 조건이 없는 경우 `(:param is null or ...)` 패턴을 쓰지 않고 JPQL 자체에서 빼서
 * 옵티마이저가 (category, id) 같은 복합 인덱스를 그대로 타도록 한다.
 */
class PostQueryRepositoryImpl implements PostQueryRepository {

    private static final String SELECT_SUMMARY = """
            select new com.loop.community.post.PostDtos$PostSummary(
                p.id, p.category, p.title, p.excerpt, a.nickname,
                p.likeCount, p.commentCount, p.viewCount, p.createdAt)
            from Post p join p.author a
            """;

    private final EntityManager em;

    PostQueryRepositoryImpl(EntityManager em) {
        this.em = em;
    }

    @Override
    public List<PostSummary> findSummaries(PostSearch search, Long cursor, int limit) {
        StringBuilder jpql = new StringBuilder(SELECT_SUMMARY).append(" where 1 = 1");
        if (cursor != null) {
            jpql.append(" and p.id < :cursor");
        }
        if (search.category() != null) {
            jpql.append(" and p.category = :category");
        }
        if (search.authorId() != null) {
            jpql.append(" and a.id = :authorId");
        }
        boolean hasKeyword = search.keyword() != null && !search.keyword().isBlank();
        if (hasKeyword) {
            jpql.append(" and lower(p.title) like :keyword escape '\\'");
        }
        jpql.append(" order by p.id desc");

        TypedQuery<PostSummary> query = em.createQuery(jpql.toString(), PostSummary.class);
        if (cursor != null) {
            query.setParameter("cursor", cursor);
        }
        if (search.category() != null) {
            query.setParameter("category", search.category());
        }
        if (search.authorId() != null) {
            query.setParameter("authorId", search.authorId());
        }
        if (hasKeyword) {
            query.setParameter("keyword", "%" + escapeLike(search.keyword().trim().toLowerCase()) + "%");
        }
        return query.setMaxResults(limit).getResultList();
    }

    @Override
    public List<PostSummary> findPopular(Instant since, int limit) {
        return em.createQuery(SELECT_SUMMARY + """
                        where p.createdAt >= :since
                        order by p.likeCount desc, p.commentCount desc, p.id desc
                        """, PostSummary.class)
                .setParameter("since", since)
                .setMaxResults(limit)
                .getResultList();
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
