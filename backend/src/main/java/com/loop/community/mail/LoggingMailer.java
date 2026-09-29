package com.loop.community.mail;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * SMTP 비밀번호(MAIL_PASSWORD)가 없을 때 쓰는 메일러: 메일 대신 서버 로그에 인증번호를 찍는다.
 * 로컬 개발과 테스트용이며, 테스트는 lastCode 로 방금 보낸 번호를 읽는다.
 */
public class LoggingMailer implements Mailer {

    private static final Logger log = LoggerFactory.getLogger(LoggingMailer.class);

    private final Map<String, String> lastCodes = new ConcurrentHashMap<>();
    private final Map<String, String> lastNotices = new ConcurrentHashMap<>();

    @Override
    public void sendCode(String to, CodePurpose purpose, String code) {
        lastCodes.put(to, code);
        log.info("[메일 미설정] {} 에게 보낼 {} 인증번호: {}", to, purpose.label(), code);
    }

    @Override
    public void sendNotice(String to, String subject, String message) {
        lastNotices.put(to, subject);
        log.info("[메일 미설정] {} 에게 보낼 알림: {}", to, subject);
    }

    public String lastCode(String to) {
        return lastCodes.get(to);
    }

    public String lastNotice(String to) {
        return lastNotices.get(to);
    }
}
