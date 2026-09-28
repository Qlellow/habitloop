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
                p.id, c.slug, c.name, p.title, p.excerpt, a.nickname,
                p.likeCount, p.commentCount, p.viewCount, p.createdAt)
            from Post p join p.author a join p.channel c
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
        if (search.channelSlug() != null) {
            // slug 는 unique 라 채널 1건을 찾은 뒤 (channel_id, id) 인덱스로 범위 스캔한다
            jpql.append(" and c.slug = :channel");
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
        if (search.channelSlug() != null) {
            query.setParameter("channel", search.channelSlug());
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
    public List<PostSummary> findPopular(String channelSlug, Instant since, int limit) {
        String where = channelSlug == null ? " where p.createdAt >= :since" : " where c.slug = :channel and p.createdAt >= :since";
        TypedQuery<PostSummary> query = em.createQuery(SELECT_SUMMARY + where
                + " order by p.likeCount desc, p.commentCount desc, p.id desc", PostSummary.class);
        if (channelSlug != null) {
            query.setParameter("channel", channelSlug);
        }
        return query.setParameter("since", since).setMaxResults(limit).getResultList();
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
