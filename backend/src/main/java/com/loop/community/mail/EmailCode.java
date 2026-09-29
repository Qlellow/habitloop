package com.loop.community.mail;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 이메일로 보낸 인증번호 (해시만 저장) */
@Entity
@Table(name = "email_codes")
public class EmailCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CodePurpose purpose;

    @Column(nullable = false, length = 64, columnDefinition = "CHAR(64)")
    private String codeHash;

    @Column(length = 64)
    private String challenge;

    private Long userId;

    @Column(nullable = false)
    private int attempts;

    @Column(nullable = false)
    private Instant expiresAt;

    @Column(nullable = false)
    private Instant createdAt;

    protected EmailCode() {
    }

    EmailCode(String email, CodePurpose purpose, String codeHash, String challenge, Long userId, Instant now,
              Instant expiresAt) {
        this.email = email;
        this.purpose = purpose;
        this.codeHash = codeHash;
        this.challenge = challenge;
        this.userId = userId;
        this.createdAt = now;
        this.expiresAt = expiresAt;
    }

    int failAttempt() {
        return ++attempts;
    }

    /** 다 쓴 번호는 지우지 않고 만료시킨다 (한 시간 발송 횟수를 세는 데 쓴다) */
    void expire(Instant now) {
        this.expiresAt = now;
        this.challenge = null;
    }

    boolean isExpired(Instant now) {
        return now.isAfter(expiresAt);
    }

    String getEmail() {
        return email;
    }

    String getCodeHash() {
        return codeHash;
    }

    Long getUserId() {
        return userId;
    }

    Instant getCreatedAt() {
        return createdAt;
    }
}
