package com.loop.community.mail;

import com.loop.community.common.ApiException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;

/** Gmail 같은 SMTP 서버로 실제 메일을 보낸다 */
class SmtpMailer implements Mailer {

    private static final Logger log = LoggerFactory.getLogger(SmtpMailer.class);

    private final JavaMailSender sender;
    private final String from;
    private final long ttlMinutes;

    SmtpMailer(JavaMailSender sender, String from, long ttlMinutes) {
        this.sender = sender;
        this.from = from;
        this.ttlMinutes = ttlMinutes;
    }

    @Override
    public void sendCode(String to, CodePurpose purpose, String code) {
        send(to, MailTemplates.codeSubject(purpose, code), MailTemplates.codeText(purpose, code, ttlMinutes),
                MailTemplates.codeHtml(purpose, code, ttlMinutes));
    }

    @Override
    public void sendNotice(String to, String subject, String message) {
        send(to, "[루프] " + subject, message + "\n\n— 루프", MailTemplates.noticeHtml(subject, message));
    }

    private void send(String to, String subject, String text, String html) {
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(from, "루프");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, html);
            sender.send(message);
        } catch (MailException | MessagingException | UnsupportedEncodingException e) {
            log.warn("메일 발송 실패 to={}: {}", to, e.getMessage());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요");
        }
    }
}
