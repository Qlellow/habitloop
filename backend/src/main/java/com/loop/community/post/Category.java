package com.loop.community.post;

public enum Category {
    FREE("자유"),
    QUESTION("질문"),
    INFO("정보"),
    DAILY("일상");

    private final String label;

    Category(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
