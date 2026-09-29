package com.loop.community.mail;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface EmailCodeRepository extends JpaRepository<EmailCode, Long> {

    /** 가장 최근에 보낸 번호. (email, purpose, id) 인덱스를 거꾸로 읽는다 */
    Optional<EmailCode> findFirstByEmailAndPurposeOrderByIdDesc(String email, CodePurpose purpose);

    Optional<EmailCode> findByChallenge(String challenge);

    /** 한 시간에 보낸 횟수 (메일 폭탄 방지) */
    long countByEmailAndPurposeAndCreatedAtAfter(String email, CodePurpose purpose, Instant since);

    /** 새 번호를 보내면 예전 번호는 바로 만료시킨다 (발송 횟수를 세야 해서 지우지는 않는다) */
    @Modifying
    @Query("update EmailCode c set c.expiresAt = :now where c.email = :email and c.purpose = :purpose and c.expiresAt > :now")
    void expireAll(@Param("email") String email, @Param("purpose") CodePurpose purpose, @Param("now") Instant now);

    @Modifying
    @Query("delete from EmailCode c where c.createdAt < :before")
    int deleteCreatedBefore(@Param("before") Instant before);
}
