package com.loop.community.mail;

import org.springframework.web.util.HtmlUtils;

/** 메일 본문. 메일 앱마다 CSS 지원이 달라 인라인 스타일만 쓴다 */
final class MailTemplates {

    private MailTemplates() {
    }

    static String codeSubject(CodePurpose purpose, String code) {
        return "[루프] " + purpose.label() + " 인증번호 " + code;
    }

    static String codeText(CodePurpose purpose, String code, long ttlMinutes) {
        return purpose.guide() + "\n\n인증번호: " + code + "\n\n" + ttlMinutes + "분 동안 쓸 수 있어요.\n"
                + "직접 요청하지 않았다면 이 메일은 무시해 주세요. 누군가 이메일 주소를 잘못 입력했을 수 있어요.\n\n— 루프";
    }

    static String codeHtml(CodePurpose purpose, String code, long ttlMinutes) {
        return layout(HtmlUtils.htmlEscape(purpose.label()) + " 인증번호", """
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4e5968">%s</p>
                <div style="margin:0 0 20px;padding:20px 0;border-radius:10px;background:#f2f4f6;text-align:center;\
                font-size:32px;font-weight:700;letter-spacing:8px;color:#191f28">%s</div>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#8b95a1">%d분 동안 쓸 수 있어요.<br>
                직접 요청하지 않았다면 이 메일은 무시해 주세요.</p>
                """.formatted(HtmlUtils.htmlEscape(purpose.guide()), code, ttlMinutes));
    }

    static String noticeHtml(String subject, String message) {
        return layout(HtmlUtils.htmlEscape(subject), """
                <p style="margin:0;font-size:15px;line-height:1.6;color:#4e5968">%s</p>
                """.formatted(HtmlUtils.htmlEscape(message).replace("\n", "<br>")));
    }

    private static String layout(String title, String body) {
        return """
                <!doctype html><html lang="ko"><body style="margin:0;padding:32px 16px;background:#f9fafb;\
                font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif">
                <div style="max-width:440px;margin:0 auto;padding:32px 28px;border-radius:12px;background:#fff;border:1px solid #e5e8eb">
                <div style="margin:0 0 24px;font-size:18px;font-weight:800;color:#3182f6">루프</div>
                <h1 style="margin:0 0 12px;font-size:20px;color:#191f28">%s</h1>
                %s
                </div></body></html>
                """.formatted(title, body);
    }
}
