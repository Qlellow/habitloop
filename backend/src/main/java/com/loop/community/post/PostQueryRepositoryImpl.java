package com.loop.community.post;

import com.loop.community.post.PostDtos.PostSummary;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
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
                p.id, c.slug, c.name, cat.name, p.title, p.excerpt, a.nickname, m.role,
                p.likeCount, p.commentCount, p.viewCount, p.createdAt)
            from Post p join p.author a join p.channel c left join p.category cat
                left join ChannelMember m on m.channelId = c.id and m.userId = a.id
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
        if (search.categoryId() != null) {
            // (category_id, id) 인덱스로 카테고리 탭 목록을 바로 읽는다
            jpql.append(" and p.category.id = :categoryId");
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
        if (search.categoryId() != null) {
            query.setParameter("categoryId", search.categoryId());
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

    /**
     * 채널마다 "최근 N개" 를 한 번에 가져온다.
     * 채널별 (channel_id, id) 인덱스 범위 스캔을 UNION ALL 로 묶어, 채널에 글이 아무리 많아도
     * 각 채널에서 N 행만 읽는다. (윈도 함수 ROW_NUMBER 는 채널 글 전체를 훑어야 해서 쓰지 않는다)
     * 1) 인덱스만으로 id 를 고르고 2) 그 id 들만 DTO 로 읽는 두 번의 쿼리로 끝난다.
     */
    @Override
    public List<PostSummary> findRecentByChannels(List<Long> channelIds, int perChannel) {
        if (channelIds.isEmpty() || perChannel <= 0) {
            return List.of();
        }
        StringBuilder sql = new StringBuilder();
        for (int i = 0; i < channelIds.size(); i++) {
            if (i > 0) {
                sql.append(" UNION ALL ");
            }
            sql.append("(SELECT id FROM posts WHERE channel_id = ?").append(i + 1)
                    .append(" ORDER BY id DESC LIMIT ").append(perChannel).append(')');
        }
        Query idQuery = em.createNativeQuery(sql.toString());
        for (int i = 0; i < channelIds.size(); i++) {
            idQuery.setParameter(i + 1, channelIds.get(i));
        }
        List<Long> ids = ((List<?>) idQuery.getResultList()).stream()
                .map(id -> ((Number) id).longValue())
                .toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        return em.createQuery(SELECT_SUMMARY + " where p.id in :ids order by p.id desc", PostSummary.class)
                .setParameter("ids", ids)
                .getResultList();
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
