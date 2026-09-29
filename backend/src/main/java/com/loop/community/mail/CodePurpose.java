package com.loop.community.mail;

/** 인증번호를 어디에 쓰는지. 메일 제목과 안내 문구가 달라진다 */
public enum CodePurpose {
    SIGNUP("회원가입", "루프 회원가입을 마치려면 아래 인증번호를 입력해 주세요."),
    LOGIN("로그인", "2단계 인증이 켜진 계정에 로그인하려면 아래 인증번호를 입력해 주세요."),
    ENABLE_2FA("2단계 인증 설정", "2단계 인증을 켜려면 아래 인증번호를 입력해 주세요.");

    private final String label;
    private final String guide;

    CodePurpose(String label, String guide) {
        this.label = label;
        this.guide = guide;
    }

    public String label() {
        return label;
    }

    public String guide() {
        return guide;
    }
}
