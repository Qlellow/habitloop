-- 이메일 인증번호: 회원가입 확인 · 2단계 인증 켜기 · 2단계 인증 로그인
-- 번호는 SHA-256 해시로만 저장하고, 10분 뒤 만료 · 5번 틀리면 폐기한다
CREATE TABLE email_codes (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(100) NOT NULL,
    purpose     VARCHAR(20)  NOT NULL,
    code_hash   CHAR(64)     NOT NULL,
    -- 2단계 인증 로그인에서 비밀번호를 확인한 사람만 번호를 입력할 수 있게 하는 일회용 토큰
    challenge   VARCHAR(64),
    user_id     BIGINT,
    attempts    INT          NOT NULL DEFAULT 0,
    expires_at  DATETIME(6)  NOT NULL,
    created_at  DATETIME(6)  NOT NULL,
    CONSTRAINT uk_email_codes_challenge UNIQUE (challenge)
);
-- 가장 최근 번호 찾기 · 재발송 간격 확인: WHERE email = ? AND purpose = ? ORDER BY id DESC
CREATE INDEX idx_email_codes_lookup ON email_codes (email, purpose, id);

ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
