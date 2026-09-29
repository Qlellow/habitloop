package com.loop.community.channel;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 채널 북마크. 가입과 별개로 자주 보는 채널을 모아 둔다. */
@Entity
@Table(name = "channel_bookmarks")
public class ChannelBookmark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long channelId;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Instant createdAt;

    protected ChannelBookmark() {
    }

    public ChannelBookmark(Long channelId, Long userId) {
        this.channelId = channelId;
        this.userId = userId;
        this.createdAt = Instant.now();
    }
}
