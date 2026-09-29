package com.loop.community.post;

import com.loop.community.post.PostDtos.PostSummary;
import java.time.Instant;
import java.util.List;

public interface PostQueryRepository {

    List<PostSummary> findSummaries(PostSearch search, Long cursor, int limit);

    List<PostSummary> findPopular(String channelSlug, Instant since, int limit);

    /** 여러 채널의 최근 글을 채널마다 perChannel 개씩 (최신순) */
    List<PostSummary> findRecentByChannels(List<Long> channelIds, int perChannel);

    record PostSearch(String channelSlug, Long categoryId, Long authorId, String keyword) {
    }
}
