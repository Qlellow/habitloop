CREATE TABLE users (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(100) NOT NULL,
    password    VARCHAR(100) NOT NULL,
    nickname    VARCHAR(20)  NOT NULL,
    created_at  DATETIME(6)  NOT NULL,
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT uk_users_nickname UNIQUE (nickname)
);

CREATE TABLE posts (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    author_id      BIGINT        NOT NULL,
    category       VARCHAR(20)   NOT NULL,
    title          VARCHAR(100)  NOT NULL,
    content        TEXT          NOT NULL,
    excerpt        VARCHAR(160)  NOT NULL,
    view_count     BIGINT        NOT NULL DEFAULT 0,
    like_count     INT           NOT NULL DEFAULT 0,
    comment_count  INT           NOT NULL DEFAULT 0,
    created_at     DATETIME(6)   NOT NULL,
    updated_at     DATETIME(6)   NOT NULL,
    CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users (id)
);
-- 커서(키셋) 페이지네이션: WHERE category = ? AND id < ? ORDER BY id DESC
CREATE INDEX idx_posts_category_id ON posts (category, id);
CREATE INDEX idx_posts_author_id ON posts (author_id, id);
-- 인기글: 최근 N일 범위 스캔
CREATE INDEX idx_posts_created_at ON posts (created_at);

CREATE TABLE comments (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id     BIGINT        NOT NULL,
    author_id   BIGINT        NOT NULL,
    content     VARCHAR(1000) NOT NULL,
    created_at  DATETIME(6)   NOT NULL,
    CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users (id)
);
CREATE INDEX idx_comments_post_id ON comments (post_id, id);

CREATE TABLE post_likes (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id     BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    CONSTRAINT uk_post_likes UNIQUE (post_id, user_id),
    CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
    CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id) REFERENCES users (id)
);
