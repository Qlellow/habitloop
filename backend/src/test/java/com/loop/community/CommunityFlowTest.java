package com.loop.community;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.loop.community.post.ViewCountBuffer;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(properties = {"app.seed=false", "app.view-flush-interval=1h"})
@AutoConfigureMockMvc
class CommunityFlowTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper om;

    @Autowired
    ViewCountBuffer viewCountBuffer;

    @Test
    void fullCommunityFlow() throws Exception {
        String alice = signup("alice@test.dev", "앨리스");
        String bob = signup("bob@test.dev", "바비");

        // 비로그인 글쓰기 불가
        mvc.perform(json(post("/api/posts"), Map.of("category", "FREE", "title", "t", "content", "c")))
                .andExpect(status().isUnauthorized());

        // 글 25개 작성 → 커서 페이지네이션 확인
        long lastId = 0;
        for (int i = 1; i <= 25; i++) {
            String category = i % 2 == 0 ? "INFO" : "FREE";
            JsonNode created = body(mvc.perform(auth(json(post("/api/posts"),
                            Map.of("category", category, "title", "제목 " + i, "content", "본문   \n\n 내용 " + i)), alice))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.mine").value(true)));
            lastId = created.get("id").asLong();
        }

        JsonNode page1 = body(mvc.perform(get("/api/posts").param("size", "10"))
                .andExpect(jsonPath("$.items", hasSize(10)))
                .andExpect(jsonPath("$.items[0].title").value("제목 25"))
                .andExpect(jsonPath("$.items[0].excerpt").value("본문 내용 25")));
        long cursor = page1.get("nextCursor").asLong();
        mvc.perform(get("/api/posts").param("size", "10").param("cursor", String.valueOf(cursor)))
                .andExpect(jsonPath("$.items[0].title").value("제목 15"));
        mvc.perform(get("/api/posts").param("size", "10").param("cursor", "6"))
                .andExpect(jsonPath("$.items", hasSize(5)))
                .andExpect(jsonPath("$.nextCursor").doesNotExist());

        // 카테고리 / 검색 필터
        mvc.perform(get("/api/posts").param("category", "INFO").param("size", "50"))
                .andExpect(jsonPath("$.items", hasSize(12)));
        mvc.perform(get("/api/posts").param("q", "제목 2"))
                .andExpect(jsonPath("$.items", hasSize(7))); // 2, 20~25
        mvc.perform(get("/api/posts").param("q", "%"))
                .andExpect(jsonPath("$.items", hasSize(0)));

        // 조회수 버퍼링
        mvc.perform(get("/api/posts/" + lastId)).andExpect(jsonPath("$.viewCount").value(1));
        mvc.perform(get("/api/posts/" + lastId)).andExpect(jsonPath("$.viewCount").value(2));
        viewCountBuffer.flush();
        mvc.perform(get("/api/posts/" + lastId)).andExpect(jsonPath("$.viewCount").value(3));

        // 좋아요 (중복 요청은 멱등)
        mvc.perform(auth(post("/api/posts/" + lastId + "/like"), bob))
                .andExpect(jsonPath("$.liked").value(true))
                .andExpect(jsonPath("$.likeCount").value(1));
        mvc.perform(auth(post("/api/posts/" + lastId + "/like"), bob))
                .andExpect(jsonPath("$.likeCount").value(1));
        mvc.perform(auth(get("/api/posts/" + lastId), bob))
                .andExpect(jsonPath("$.liked").value(true))
                .andExpect(jsonPath("$.mine").value(false));
        mvc.perform(get("/api/posts/popular"))
                .andExpect(jsonPath("$[0].id").value(lastId));
        mvc.perform(auth(delete("/api/posts/" + lastId + "/like"), bob))
                .andExpect(jsonPath("$.liked").value(false))
                .andExpect(jsonPath("$.likeCount").value(0));

        // 댓글
        JsonNode comment = body(mvc.perform(auth(json(post("/api/posts/" + lastId + "/comments"),
                        Map.of("content", "좋은 글이네요")), bob))
                .andExpect(status().isCreated()));
        mvc.perform(get("/api/posts/" + lastId + "/comments"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].authorNickname").value("바비"));
        mvc.perform(get("/api/posts/" + lastId)).andExpect(jsonPath("$.commentCount").value(1));
        mvc.perform(auth(delete("/api/posts/" + lastId + "/comments/" + comment.get("id").asLong()), alice))
                .andExpect(status().isForbidden());
        mvc.perform(auth(delete("/api/posts/" + lastId + "/comments/" + comment.get("id").asLong()), bob))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/" + lastId)).andExpect(jsonPath("$.commentCount").value(0));

        // 수정 / 삭제 권한
        Map<String, String> edit = Map.of("category", "DAILY", "title", "수정됨", "content", "수정 본문");
        mvc.perform(auth(json(put("/api/posts/" + lastId), edit), bob)).andExpect(status().isForbidden());
        mvc.perform(auth(json(put("/api/posts/" + lastId), edit), alice))
                .andExpect(jsonPath("$.title").value("수정됨"))
                .andExpect(jsonPath("$.category").value("DAILY"));
        mvc.perform(auth(post("/api/posts/" + lastId + "/like"), bob)).andExpect(status().isOk());
        mvc.perform(auth(delete("/api/posts/" + lastId), alice)).andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/" + lastId)).andExpect(status().isNotFound());
    }

    @Test
    void authValidation() throws Exception {
        signup("dup@test.dev", "중복");
        mvc.perform(json(post("/api/auth/signup"),
                        Map.of("email", "dup@test.dev", "password", "password1234", "nickname", "다른닉")))
                .andExpect(status().isConflict());
        mvc.perform(json(post("/api/auth/signup"),
                        Map.of("email", "short@test.dev", "password", "123", "nickname", "짧은비번")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("비밀번호는 8자 이상이어야 해요"));
        mvc.perform(json(post("/api/auth/login"), Map.of("email", "dup@test.dev", "password", "wrong-password")))
                .andExpect(status().isUnauthorized());
        String token = body(mvc.perform(json(post("/api/auth/login"),
                        Map.of("email", "DUP@test.dev", "password", "password1234")))
                .andExpect(status().isOk())).get("token").asText();
        mvc.perform(auth(get("/api/me"), token)).andExpect(jsonPath("$.nickname").value("중복"));
        mvc.perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, "Bearer invalid"))
                .andExpect(status().isUnauthorized());
    }

    private String signup(String email, String nickname) throws Exception {
        return body(mvc.perform(json(post("/api/auth/signup"),
                        Map.of("email", email, "password", "password1234", "nickname", nickname)))
                .andExpect(status().isCreated())).get("token").asText();
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, Object body) throws Exception {
        return builder.contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsString(body));
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private JsonNode body(org.springframework.test.web.servlet.ResultActions result) throws Exception {
        return om.readTree(result.andReturn().getResponse().getContentAsString());
    }
}
