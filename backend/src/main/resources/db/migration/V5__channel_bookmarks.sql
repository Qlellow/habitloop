-- 채널 북마크 (가입과 별개로, 자주 보는 채널을 모아 두는 용도)
CREATE TABLE channel_bookmarks (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel_id  BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    CONSTRAINT uk_channel_bookmarks UNIQUE (channel_id, user_id),
    CONSTRAINT fk_channel_bookmarks_channel FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE,
    CONSTRAINT fk_channel_bookmarks_user FOREIGN KEY (user_id) REFERENCES users (id)
);
-- 내 북마크 목록: WHERE user_id = ? ORDER BY id DESC
CREATE INDEX idx_channel_bookmarks_user ON channel_bookmarks (user_id, id);
