package com.loop.community.mail;

import com.loop.community.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 이메일 인증번호 발급과 확인.
 * - 6자리 숫자, 10분 유효, 해시만 저장
 * - 5번 틀리면 폐기 (다시 받아야 한다), 재발송은 60초 간격 · 한 시간에 10번까지
 */
@Service
public class VerificationService {

    public static final int MAX_ATTEMPTS = 5;
    private static final int HOURLY_LIMIT = 10;
    /** 비밀번호를 확인한 뒤 이 시간 안에만 로그인 인증번호를 다시 받을 수 있다 */
    private static final Duration CHALLENGE_TTL = Duration.ofMinutes(30);

    private final EmailCodeRepository repository;
    private final Mailer mailer;
    private final Duration ttl;
    private final Duration resendInterval;
    private final SecureRandom random = new SecureRandom();

    public VerificationService(EmailCodeRepository repository, Mailer mailer,
                               @Value("${app.mail.code-ttl}") Duration ttl,
                               @Value("${app.mail.resend-interval}") Duration resendInterval) {
        this.repository = repository;
        this.mailer = mailer;
        this.ttl = ttl;
        this.resendInterval = resendInterval;
    }

    /** 인증번호를 만들어 메일로 보낸다. 로그인용이면 번호 입력 화면에서 쓸 일회용 challenge 를 돌려준다 */
    @Transactional
    public String send(String email, CodePurpose purpose, Long userId) {
        Instant now = Instant.now();
        repository.findFirstByEmailAndPurposeOrderByIdDesc(email, purpose).ifPresent(last -> {
            long wait = resendInterval.minus(Duration.between(last.getCreatedAt(), now)).toSeconds();
            if (wait > 0) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, wait + "초 뒤에 다시 받을 수 있어요");
            }
        });
        if (repository.countByEmailAndPurposeAndCreatedAtAfter(email, purpose, now.minus(Duration.ofHours(1))) >= HOURLY_LIMIT) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "인증번호를 너무 많이 요청했어요. 한 시간 뒤에 다시 시도해 주세요");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        String challenge = purpose == CodePurpose.LOGIN ? randomToken() : null;
        repository.expireAll(email, purpose, now);
        repository.save(new EmailCode(email, purpose, hash(code), challenge, userId, now, now.plus(ttl)));
        mailer.sendCode(email, purpose, code); // 실패하면 예외 → 저장도 되돌린다
        return challenge;
    }

    /**
     * 이메일로 받은 번호가 맞는지 확인하고, 맞으면 번호를 폐기한다.
     * 틀린 횟수는 호출한 쪽이 실패로 되돌려도 남아야 하므로 따로 커밋한다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = ApiException.class)
    public void verify(String email, CodePurpose purpose, String code) {
        EmailCode saved = repository.findFirstByEmailAndPurposeOrderByIdDesc(email, purpose)
                .orElseThrow(() -> ApiException.badRequest("인증번호를 먼저 받아 주세요"));
        check(saved, code);
    }

    /** 2단계 인증 로그인: challenge 로 번호를 찾아 확인하고, 그 번호를 받은 사용자 id 를 돌려준다 */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = ApiException.class)
    public Long verifyChallenge(String challenge, String code) {
        EmailCode saved = repository.findByChallenge(challenge)
                .orElseThrow(() -> ApiException.badRequest("인증 시간이 지났어요. 다시 로그인해 주세요"));
        check(saved, code);
        return saved.getUserId();
    }

    private void check(EmailCode saved, String code) {
        Instant now = Instant.now();
        if (saved.isExpired(now)) {
            throw ApiException.badRequest("인증번호가 만료됐어요. 새 번호를 받아 주세요");
        }
        boolean match = code != null && MessageDigest.isEqual(
                saved.getCodeHash().getBytes(StandardCharsets.US_ASCII), hash(code.strip()).getBytes(StandardCharsets.US_ASCII));
        if (!match) {
            int attempts = saved.failAttempt();
            if (attempts >= MAX_ATTEMPTS) {
                saved.expire(now);
                throw ApiException.badRequest("인증번호를 " + MAX_ATTEMPTS + "번 틀렸어요. 새 번호를 받아 주세요");
            }
            throw ApiException.badRequest("인증번호가 맞지 않아요 (" + attempts + "/" + MAX_ATTEMPTS + ")");
        }
        saved.expire(now); // 한 번 쓴 번호는 다시 못 쓴다
    }

    /** 2단계 인증 로그인에서 '다시 받기': 같은 사람에게 새 번호와 새 challenge 를 보낸다 */
    @Transactional
    public String resendChallenge(String challenge) {
        EmailCode saved = repository.findByChallenge(challenge)
                .filter(c -> c.getCreatedAt().isAfter(Instant.now().minus(CHALLENGE_TTL)))
                .orElseThrow(() -> ApiException.badRequest("인증 시간이 지났어요. 다시 로그인해 주세요"));
        return send(saved.getEmail(), CodePurpose.LOGIN, saved.getUserId());
    }

    /** 하루 지난 번호 기록 정리 (한 시간마다). 발송 횟수 제한에 최근 한 시간 기록만 쓰므로 하루면 충분하다 */
    @Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT5M")
    @Transactional
    public void purgeOld() {
        repository.deleteCreatedBefore(Instant.now().minus(Duration.ofDays(1)));
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String code) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(code.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
