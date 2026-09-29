package com.loop.community.mail;

/** 인증번호·알림 메일 보내기. SMTP 설정이 없으면(로컬 개발·테스트) 서버 로그에 대신 찍는다 */
public interface Mailer {

    void sendCode(String to, CodePurpose purpose, String code);

    void sendNotice(String to, String subject, String message);
}
