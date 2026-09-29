-- 채널 운영진: 소유자(OWNER) · 관리자(ADMIN) · 매니저(MANAGER) · 일반 멤버(MEMBER)
ALTER TABLE channel_members ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'MEMBER';
UPDATE channel_members SET role = 'OWNER'
WHERE EXISTS (SELECT 1 FROM channels c WHERE c.id = channel_members.channel_id AND c.owner_id = channel_members.user_id);

-- 채널 소개는 마크다운으로 길게 쓸 수 있다
ALTER TABLE channels MODIFY COLUMN description VARCHAR(2000) NOT NULL;

-- 채널 프로필 이미지. 목록 쿼리를 가볍게 두려고 바이트는 따로 두고, channels 에는 버전만 둔다.
-- icon_version > 0 이면 이미지가 있다. 이미지 주소에 버전을 붙여 브라우저가 1년 동안 캐시하게 한다.
-- 지울 때는 부호만 바꿔(-n) 다음에 올리는 이미지가 옛 캐시와 겹치지 않게 한다.
ALTER TABLE channels ADD COLUMN icon_version INT NOT NULL DEFAULT 0;
CREATE TABLE channel_icons (
    channel_id    BIGINT      NOT NULL PRIMARY KEY,
    content_type  VARCHAR(20) NOT NULL,
    data          MEDIUMBLOB  NOT NULL,
    CONSTRAINT fk_channel_icons_channel FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE
);
