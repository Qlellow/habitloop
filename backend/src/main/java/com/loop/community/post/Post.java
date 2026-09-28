package com.loop.community.post;

import com.loop.community.channel.Channel;
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
import java.util.regex.Pattern;

@Entity
@Table(name = "posts")
public class Post {

    static final int EXCERPT_LENGTH = 150;

    // 목록 미리보기에서 마크다운 문법 기호를 걷어내기 위한 패턴 (순서대로 적용)
    private static final Pattern CODE_FENCE = Pattern.compile("```[^\\n]*\\n?|~~~[^\\n]*\\n?");
    private static final Pattern IMAGE = Pattern.compile("!\\[([^\\]]*)]\\([^)]*\\)");
    private static final Pattern LINK = Pattern.compile("\\[([^\\]]*)]\\([^)]*\\)");
    private static final Pattern LINE_PREFIX = Pattern.compile("(?m)^\\s{0,3}(#{1,6}\\s+|>\\s?|[-*+]\\s+\\[[ xX]]\\s+|[-*+]\\s+|\\d+[.)]\\s+)");
    private static final Pattern HR = Pattern.compile("(?m)^\\s*([-*_]\\s*){3,}$");
    private static final Pattern EMPHASIS = Pattern.compile("(\\*\\*|__|~~|`|\\*)");
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false, updatable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false, updatable = false)
    private Channel channel;

    @Column(nullable = false, length = 100)
    private String title;

    /** 마크다운 원문. 렌더링(과 XSS 방지 sanitize)은 클라이언트에서 한다. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /** 목록 조회 시 TEXT 컬럼을 읽지 않도록 미리 잘라 둔 (마크다운 기호를 뺀) 미리보기 */
    @Column(nullable = false, length = 160)
    private String excerpt;

    // 카운터는 원자적 UPDATE 쿼리로만 변경한다 (엔티티 dirty checking 으로 덮어쓰지 않도록 updatable=false)
    @Column(nullable = false, updatable = false)
    private long viewCount;

    @Column(nullable = false, updatable = false)
    private int likeCount;

    @Column(nullable = false, updatable = false)
    private int commentCount;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected Post() {
    }

    public Post(User author, Channel channel, String title, String content) {
        this.author = author;
        this.channel = channel;
        this.createdAt = Instant.now();
        update(title, content);
    }

    public void update(String title, String content) {
        this.title = title.trim();
        this.content = content;
        this.excerpt = makeExcerpt(content);
        this.updatedAt = Instant.now();
    }

    public boolean isWrittenBy(Long userId) {
        // LAZY 프록시에서 id 접근은 초기화(추가 쿼리)를 일으키지 않는다
        return author.getId().equals(userId);
    }

    static String makeExcerpt(String content) {
        String text = CODE_FENCE.matcher(content).replaceAll("");
        text = IMAGE.matcher(text).replaceAll("");
        text = LINK.matcher(text).replaceAll("$1");
        text = HR.matcher(text).replaceAll("");
        text = LINE_PREFIX.matcher(text).replaceAll("");
        text = EMPHASIS.matcher(text).replaceAll("");
        text = HTML_TAG.matcher(text).replaceAll("");
        String flat = text.strip().replaceAll("\\s+", " ");
        return flat.length() <= EXCERPT_LENGTH ? flat : flat.substring(0, EXCERPT_LENGTH);
    }

    public Long getId() {
        return id;
    }

    public User getAuthor() {
        return author;
    }

    public Channel getChannel() {
        return channel;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public String getExcerpt() {
        return excerpt;
    }

    public long getViewCount() {
        return viewCount;
    }

    public int getLikeCount() {
        return likeCount;
    }

    public int getCommentCount() {
        return commentCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
