-- 채널 가입제: 가입한 사람만 그 채널에 글을 쓸 수 있다 (보기·공감·댓글은 누구나)
CREATE TABLE channel_members (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel_id  BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    joined_at   DATETIME(6) NOT NULL,
    CONSTRAINT uk_channel_members UNIQUE (channel_id, user_id),
    CONSTRAINT fk_channel_members_channel FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE,
    CONSTRAINT fk_channel_members_user FOREIGN KEY (user_id) REFERENCES users (id)
);
-- 내가 가입한 채널 목록: WHERE user_id = ? (uk 는 channel_id 가 앞이라 따로 둔다)
CREATE INDEX idx_channel_members_user ON channel_members (user_id, channel_id);

ALTER TABLE channels ADD COLUMN member_count INT NOT NULL DEFAULT 0;

-- 기존 사용자가 갑자기 글을 못 쓰게 되지 않도록: 이미 글을 쓴 사람과 채널 주인은 가입된 것으로 옮긴다
INSERT INTO channel_members (channel_id, user_id, joined_at)
SELECT DISTINCT p.channel_id, p.author_id, CURRENT_TIMESTAMP(6) FROM posts p;

INSERT INTO channel_members (channel_id, user_id, joined_at)
SELECT c.id, c.owner_id, CURRENT_TIMESTAMP(6) FROM channels c
WHERE c.owner_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = c.id AND m.user_id = c.owner_id);

UPDATE channels SET member_count = (SELECT COUNT(*) FROM channel_members m WHERE m.channel_id = channels.id);
