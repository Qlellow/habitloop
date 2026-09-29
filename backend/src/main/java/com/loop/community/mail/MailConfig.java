package com.loop.community.mail;

import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;

@Configuration
public class MailConfig {

    /**
     * MAIL_PASSWORD(Gmail 앱 비밀번호)가 있으면 실제로 메일을 보내고,
     * 없으면 서버 로그에 인증번호를 찍는다 (로컬 개발 · 테스트).
     */
    @Bean
    Mailer mailer(ObjectProvider<JavaMailSender> sender,
                  @Value("${spring.mail.password:}") String password,
                  @Value("${app.mail.from}") String from,
                  @Value("${app.mail.code-ttl}") java.time.Duration ttl) {
        if (password == null || password.isBlank()) {
            LoggerFactory.getLogger(MailConfig.class)
                    .warn("MAIL_PASSWORD 가 없어 인증번호를 메일 대신 서버 로그에 찍어요 (운영에서는 꼭 설정하세요)");
            return new LoggingMailer();
        }
        return new SmtpMailer(sender.getObject(), from, ttl.toMinutes());
    }
}
