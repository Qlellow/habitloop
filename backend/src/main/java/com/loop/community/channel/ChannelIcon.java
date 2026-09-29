package com.loop.community.channel;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

/** 채널 프로필 이미지. 채널 목록 쿼리가 무거워지지 않게 바이트는 따로 둔다 */
@Entity
@Table(name = "channel_icons")
public class ChannelIcon {

    @Id
    private Long channelId;

    @Column(nullable = false, length = 20)
    private String contentType;

    @Lob
    @Column(nullable = false, columnDefinition = "MEDIUMBLOB")
    private byte[] data;

    protected ChannelIcon() {
    }

    public ChannelIcon(Long channelId, String contentType, byte[] data) {
        this.channelId = channelId;
        replace(contentType, data);
    }

    public void replace(String contentType, byte[] data) {
        this.contentType = contentType;
        this.data = data;
    }

    public String getContentType() {
        return contentType;
    }

    public byte[] getData() {
        return data;
    }
}
