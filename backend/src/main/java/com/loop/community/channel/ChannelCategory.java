package com.loop.community.channel;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** 채널 안의 카테고리. 채널 소유자만 만들고 고칠 수 있다. */
@Entity
@Table(name = "channel_categories")
public class ChannelCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false, updatable = false)
    private Channel channel;

    @Column(nullable = false, length = 20)
    private String name;

    @Column(nullable = false)
    private int position;

    /** 채널 소유자만 글을 쓸 수 있는 카테고리 (공지사항 등) */
    @Column(nullable = false)
    private boolean ownerOnly;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected ChannelCategory() {
    }

    public ChannelCategory(Channel channel, String name, boolean ownerOnly, int position) {
        this.channel = channel;
        this.position = position;
        this.createdAt = Instant.now();
        update(name, ownerOnly);
    }

    public void update(String name, boolean ownerOnly) {
        this.name = name.strip();
        this.ownerOnly = ownerOnly;
    }

    public void moveTo(int position) {
        this.position = position;
    }

    public boolean belongsTo(Long channelId) {
        return channel.getId().equals(channelId);
    }

    public Long getId() {
        return id;
    }

    public Channel getChannel() {
        return channel;
    }

    public String getName() {
        return name;
    }

    public int getPosition() {
        return position;
    }

    public boolean isOwnerOnly() {
        return ownerOnly;
    }
}
