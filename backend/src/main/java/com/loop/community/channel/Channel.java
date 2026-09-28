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

    /** URL 에 쓰이는 고유 주소 (/c/{slug}). 만든 뒤에는 바꿀 수 없다. */
    @Column(nullable = false, unique = true, length = 30, updatable = false)
    private String slug;

    @Column(nullable = false, unique = true, length = 20)
    private String name;

    @Column(nullable = false, length = 200)
    private String description;

    /** 기본 채널은 운영 채널이라 주인이 없다 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", updatable = false)
    private User owner;

    @Column(nullable = false, updatable = false)
    private int postCount;

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

    public Instant getCreatedAt() {
        return createdAt;
    }
}
