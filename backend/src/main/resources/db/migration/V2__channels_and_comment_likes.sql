-- 고정 카테고리 → 사용자가 만드는 채널
CREATE TABLE channels (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug         VARCHAR(30)  NOT NULL,
    name         VARCHAR(20)  NOT NULL,
    description  VARCHAR(200) NOT NULL,
    owner_id     BIGINT       NULL,
    post_count   INT          NOT NULL DEFAULT 0,
    created_at   DATETIME(6)  NOT NULL,
    CONSTRAINT uk_channels_slug UNIQUE (slug),
    CONSTRAINT uk_channels_name UNIQUE (name),
    CONSTRAINT fk_channels_owner FOREIGN KEY (owner_id) REFERENCES users (id)
);
-- 인기 채널 목록: ORDER BY post_count DESC
CREATE INDEX idx_channels_post_count ON channels (post_count);

-- 기존 카테고리를 기본 채널로 옮긴다
INSERT INTO channels (slug, name, description, owner_id, post_count, created_at) VALUES
    ('free', '자유', '무엇이든 자유롭게 이야기해요', NULL, 0, CURRENT_TIMESTAMP(6)),
    ('question', '질문', '궁금한 건 무엇이든 물어보세요', NULL, 0, CURRENT_TIMESTAMP(6)),
    ('info', '정보', '알아두면 좋은 정보를 나눠요', NULL, 0, CURRENT_TIMESTAMP(6)),
    ('daily', '일상', '오늘 하루는 어땠나요?', NULL, 0, CURRENT_TIMESTAMP(6));

ALTER TABLE posts ADD COLUMN channel_id BIGINT NULL;
UPDATE posts SET channel_id = (SELECT c.id FROM channels c WHERE c.slug = LOWER(posts.category));
UPDATE channels SET post_count = (SELECT COUNT(*) FROM posts p WHERE p.channel_id = channels.id);
ALTER TABLE posts MODIFY channel_id BIGINT NOT NULL;
ALTER TABLE posts ADD CONSTRAINT fk_posts_channel FOREIGN KEY (channel_id) REFERENCES channels (id);
-- 채널 글 목록: WHERE channel_id = ? AND id < ? ORDER BY id DESC
CREATE INDEX idx_posts_channel_id ON posts (channel_id, id);
DROP INDEX idx_posts_category_id ON posts;
ALTER TABLE posts DROP COLUMN category;

-- 댓글 좋아요
ALTER TABLE comments ADD COLUMN like_count INT NOT NULL DEFAULT 0;
-- 베스트 댓글: WHERE post_id = ? AND like_count >= ? ORDER BY like_count DESC
CREATE INDEX idx_comments_post_like ON comments (post_id, like_count);

CREATE TABLE comment_likes (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    comment_id  BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    CONSTRAINT uk_comment_likes UNIQUE (comment_id, user_id),
    CONSTRAINT fk_comment_likes_comment FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_likes_user FOREIGN KEY (user_id) REFERENCES users (id)
);
