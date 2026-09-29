package com.loop.community.channel;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 채널 가입. 가입한 사람만 그 채널에 글을 쓸 수 있다. */
@Entity
@Table(name = "channel_members")
public class ChannelMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long channelId;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Instant joinedAt;

    protected ChannelMember() {
    }

    public ChannelMember(Long channelId, Long userId) {
        this.channelId = channelId;
        this.userId = userId;
        this.joinedAt = Instant.now();
    }
}
