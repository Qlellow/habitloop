package com.loop.community.channel;

import com.loop.community.user.User;
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

@Entity
@Table(name = "channels")
public class Channel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 고리: URL 에 쓰이는 채널의 짧은 이름 (/c/{slug}). 만든 뒤에는 바꿀 수 없다. */
    @Column(nullable = false, unique = true, length = 30, updatable = false)
    private String slug;

    @Column(nullable = false, unique = true, length = 20)
    private String name;

    /** 마크다운 */
    @Column(nullable = false, length = 2000)
    private String description;

    /** 기본 채널은 운영 채널이라 주인이 없다 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", updatable = false)
    private User owner;

    @Column(nullable = false, updatable = false)
    private int postCount;

    /** 원자적 UPDATE 쿼리로만 변경한다 */
    @Column(nullable = false, updatable = false)
    private int memberCount;

    /** 프로필 이미지 버전. 0 보다 크면 이미지가 있다. 원자적 UPDATE 쿼리로만 변경한다 */
    @Column(nullable = false, updatable = false)
    private int iconVersion;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected Channel() {
    }

    public Channel(String slug, String name, String description, User owner) {
        this.slug = slug;
        this.owner = owner;
        this.createdAt = Instant.now();
        update(name, description);
    }

    public void update(String name, String description) {
        this.name = name.strip();
        this.description = description == null ? "" : description.strip();
    }

    public boolean isOwnedBy(Long userId) {
        return owner != null && owner.getId().equals(userId);
    }

    public Long getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public User getOwner() {
        return owner;
    }

    public int getPostCount() {
        return postCount;
    }

    public int getMemberCount() {
        return memberCount;
    }

    public int getIconVersion() {
        return iconVersion;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
