-- 채널 소유자가 만드는 채널 내부 카테고리 (공지사항, 소설, 일러스트 …)
CREATE TABLE channel_categories (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel_id  BIGINT      NOT NULL,
    name        VARCHAR(20) NOT NULL,
    position    INT         NOT NULL,
    -- true 면 채널 소유자만 이 카테고리에 글을 쓸 수 있다 (공지사항 등)
    owner_only  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  DATETIME(6) NOT NULL,
    CONSTRAINT uk_channel_categories_name UNIQUE (channel_id, name),
    CONSTRAINT fk_channel_categories_channel FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE
);
CREATE INDEX idx_channel_categories_position ON channel_categories (channel_id, position);

-- 카테고리를 지우면 글은 채널에 남고 카테고리만 비워진다
ALTER TABLE posts ADD COLUMN category_id BIGINT NULL;
ALTER TABLE posts ADD CONSTRAINT fk_posts_category FOREIGN KEY (category_id) REFERENCES channel_categories (id) ON DELETE SET NULL;
-- 카테고리 탭 목록: WHERE category_id = ? AND id < ? ORDER BY id DESC
CREATE INDEX idx_posts_category_id ON posts (category_id, id);
