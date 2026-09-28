package com.loop.community.post;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PostTest {

    @Test
    void excerptFlattensWhitespaceAndTruncates() {
        assertThat(Post.makeExcerpt("  안녕\n\n하세요\t반가워요 ")).isEqualTo("안녕 하세요 반가워요");
        assertThat(Post.makeExcerpt("가".repeat(500))).hasSize(Post.EXCERPT_LENGTH);
    }

    @Test
    void excerptStripsMarkdownSyntax() {
        String markdown = """
                # 제목
                **굵게** 와 *기울임*, `코드` 그리고 [링크](https://a.dev)
                ![이미지](https://a.dev/x.png)
                > 인용문
                - 목록
                1. 번호
                ---
                ```js
                const snake_case = 1;
                ```
                """;
        assertThat(Post.makeExcerpt(markdown))
                .isEqualTo("제목 굵게 와 기울임, 코드 그리고 링크 인용문 목록 번호 const snake_case = 1;");
    }
}
