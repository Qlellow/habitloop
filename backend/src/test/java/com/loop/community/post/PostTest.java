package com.loop.community.post;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PostTest {

    @Test
    void excerptFlattensWhitespaceAndTruncates() {
        assertThat(Post.makeExcerpt("  안녕\n\n하세요\t반가워요 ")).isEqualTo("안녕 하세요 반가워요");
        assertThat(Post.makeExcerpt("가".repeat(500))).hasSize(Post.EXCERPT_LENGTH);
    }
}
