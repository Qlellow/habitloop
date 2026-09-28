package com.loop.community.post;

import com.loop.community.post.PostDtos.PostSummary;
import java.time.Instant;
import java.util.List;

public interface PostQueryRepository {

    List<PostSummary> findSummaries(PostSearch search, Long cursor, int limit);

    List<PostSummary> findPopular(String channelSlug, Instant since, int limit);

    record PostSearch(String channelSlug, Long authorId, String keyword) {
    }
}
