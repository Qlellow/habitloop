package com.loop.community.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.javamail.JavaMailSender;

class SmtpMailerTest {

    @Test
    void buildsKoreanCodeMail() throws Exception {
        JavaMailSender sender = mock(JavaMailSender.class);
        when(sender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));

        new SmtpMailer(sender, "sender@example.com", 10).sendCode("user@test.dev", CodePurpose.SIGNUP, "123456");

        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(sent.capture());
        MimeMessage message = sent.getValue();
        message.saveChanges();
        assertThat(message.getSubject()).isEqualTo("[루프] 회원가입 인증번호 123456");
        InternetAddress from = (InternetAddress) message.getFrom()[0];
        assertThat(from.getAddress()).isEqualTo("sender@example.com");
        assertThat(from.getPersonal()).isEqualTo("루프");
        assertThat(message.getAllRecipients()[0].toString()).isEqualTo("user@test.dev");
        ByteArrayOutputStream raw = new ByteArrayOutputStream();
        message.writeTo(raw);
        // 본문(텍스트 + HTML) 이 모두 들어 있고 10분 안내가 있다
        assertThat(raw.toString(StandardCharsets.UTF_8)).contains("multipart/alternative").contains("text/html");
    }
}
