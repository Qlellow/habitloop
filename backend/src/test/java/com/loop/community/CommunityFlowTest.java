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
        mvc.perform(json(post("/api/posts"), Map.of("channel", "free", "title", "t", "content", "c")))
                .andExpect(status().isUnauthorized());

        // 채널 만들기
        mvc.perform(auth(json(post("/api/channels"),
                        Map.of("slug", "cats", "name", "고양이", "description", "냥냥")), alice))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mine").value(true))
                .andExpect(jsonPath("$.ownerNickname").value("앨리스"));

        // 'cats' 는 만든 사람이라 자동 가입, 'free' 는 가입해야 글을 쓸 수 있다
        mvc.perform(auth(post("/api/channels/free/members"), alice)).andExpect(jsonPath("$.joined").value(true));

        // 글 25개 작성 → 커서 페이지네이션 확인
        long lastId = 0;
        for (int i = 1; i <= 25; i++) {
            String channel = i % 2 == 0 ? "cats" : "free";
            JsonNode created = body(mvc.perform(auth(json(post("/api/posts"),
                            Map.of("channel", channel, "title", "제목 " + i, "content", "본문   \n\n **내용** " + i)), alice))
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

        // 채널 / 검색 필터
        mvc.perform(get("/api/posts").param("channel", "cats").param("size", "50"))
                .andExpect(jsonPath("$.items", hasSize(12)))
                .andExpect(jsonPath("$.items[0].channelName").value("고양이"));
        mvc.perform(get("/api/channels/cats")).andExpect(jsonPath("$.postCount").value(12));
        mvc.perform(get("/api/channels").param("q", "고양")).andExpect(jsonPath("$[0].slug").value("cats"));
        mvc.perform(get("/api/channels")).andExpect(jsonPath("$[0].slug").value("free")); // 글 13개로 1위
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
        mvc.perform(get("/api/posts/popular").param("channel", "free"))
                .andExpect(jsonPath("$[0].id").value(lastId));
        mvc.perform(get("/api/posts/popular").param("channel", "cats"))
                .andExpect(jsonPath("$[0].likeCount").value(0));
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

        // 댓글 좋아요 & 베스트 댓글 (좋아요 2개 이상)
        String commentLike = "/api/posts/" + lastId + "/comments/" + comment.get("id").asLong() + "/like";
        mvc.perform(auth(post(commentLike), alice))
                .andExpect(jsonPath("$.liked").value(true))
                .andExpect(jsonPath("$.likeCount").value(1));
        mvc.perform(auth(post(commentLike), alice)).andExpect(jsonPath("$.likeCount").value(1));
        mvc.perform(get("/api/posts/" + lastId + "/comments/best")).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(auth(post(commentLike), bob)).andExpect(jsonPath("$.likeCount").value(2));
        mvc.perform(auth(get("/api/posts/" + lastId + "/comments/best"), alice))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].liked").value(true))
                .andExpect(jsonPath("$[0].likeCount").value(2));
        mvc.perform(auth(get("/api/posts/" + lastId + "/comments"), alice))
                .andExpect(jsonPath("$.items[0].liked").value(true));
        mvc.perform(get("/api/posts/" + lastId + "/comments"))
                .andExpect(jsonPath("$.items[0].liked").value(false));
        mvc.perform(auth(delete(commentLike), bob)).andExpect(jsonPath("$.likeCount").value(1));
        mvc.perform(auth(delete("/api/posts/" + lastId + "/comments/" + comment.get("id").asLong()), alice))
                .andExpect(status().isForbidden());
        mvc.perform(auth(delete("/api/posts/" + lastId + "/comments/" + comment.get("id").asLong()), bob))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/" + lastId)).andExpect(jsonPath("$.commentCount").value(0));

        // 수정 / 삭제 권한
        Map<String, String> edit = Map.of("title", "수정됨", "content", "# 수정 본문");
        mvc.perform(auth(json(put("/api/posts/" + lastId), edit), bob)).andExpect(status().isForbidden());
        mvc.perform(auth(json(put("/api/posts/" + lastId), edit), alice))
                .andExpect(jsonPath("$.title").value("수정됨"))
                .andExpect(jsonPath("$.channel.slug").value("free"))
                .andExpect(jsonPath("$.content").value("# 수정 본문"));
        mvc.perform(auth(post("/api/posts/" + lastId + "/like"), bob)).andExpect(status().isOk());
        mvc.perform(auth(delete("/api/posts/" + lastId), alice)).andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/" + lastId)).andExpect(status().isNotFound());
        mvc.perform(get("/api/channels/free")).andExpect(jsonPath("$.postCount").value(12));
    }

    @Test
    void channelRules() throws Exception {
        String owner = signup("owner@test.dev", "채널주인");
        String other = signup("other@test.dev", "지나가는사람");
        Map<String, String> req = Map.of("slug", "books", "name", "독서", "description", "책 이야기");

        mvc.perform(json(post("/api/channels"), req)).andExpect(status().isUnauthorized());
        mvc.perform(auth(json(post("/api/channels"), req), owner)).andExpect(status().isCreated());
        mvc.perform(auth(json(post("/api/channels"), req), other)).andExpect(status().isConflict());
        mvc.perform(auth(json(post("/api/channels"), Map.of("slug", "books2", "name", "독서")), other))
                .andExpect(status().isConflict());
        mvc.perform(auth(json(post("/api/channels"), Map.of("slug", "new", "name", "새채널")), other))
                .andExpect(status().isConflict());
        mvc.perform(auth(json(post("/api/channels"), Map.of("slug", "Bad Slug!", "name", "잘못된주소")), other))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(json(post("/api/posts"), Map.of("channel", "nope", "title", "t", "content", "c")), other))
                .andExpect(status().isNotFound());

        Map<String, String> edit = Map.of("name", "책과 사람", "description", "바뀐 소개");
        mvc.perform(auth(json(put("/api/channels/books"), edit), other)).andExpect(status().isForbidden());
        mvc.perform(auth(json(put("/api/channels/books"), edit), owner))
                .andExpect(jsonPath("$.name").value("책과 사람"))
                .andExpect(jsonPath("$.slug").value("books"));
        mvc.perform(auth(json(put("/api/channels/free"), edit), owner)).andExpect(status().isForbidden());
    }

    @Test
    void channelCategories() throws Exception {
        String owner = signup("cat-owner@test.dev", "창작주인");
        String member = signup("cat-member@test.dev", "창작회원");
        mvc.perform(auth(json(post("/api/channels"), Map.of("slug", "art", "name", "그림방")), owner))
                .andExpect(jsonPath("$.categories", hasSize(0)));
        String base = "/api/channels/art/categories";

        // 소유자만 카테고리를 만들 수 있다
        mvc.perform(auth(json(post(base), Map.of("name", "공지사항", "ownerOnly", true)), member))
                .andExpect(status().isForbidden());
        mvc.perform(auth(json(post(base), Map.of("name", "공지사항", "ownerOnly", true)), owner))
                .andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(auth(json(post(base), Map.of("name", "소설", "ownerOnly", false)), owner));
        JsonNode cats = body(mvc.perform(auth(json(post(base), Map.of("name", "일러스트", "ownerOnly", false)), owner))
                .andExpect(jsonPath("$[*].name").value(org.hamcrest.Matchers.contains("공지사항", "소설", "일러스트"))));
        long notice = cats.get(0).get("id").asLong();
        long novel = cats.get(1).get("id").asLong();
        long art = cats.get(2).get("id").asLong();
        mvc.perform(auth(json(post(base), Map.of("name", "소설", "ownerOnly", false)), owner))
                .andExpect(status().isConflict());

        // 순서 바꾸기 (일부만 보내면 거절)
        mvc.perform(auth(json(put(base + "/order"), Map.of("ids", java.util.List.of(art, notice))), owner))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(json(put(base + "/order"), Map.of("ids", java.util.List.of(notice, art, novel))), owner))
                .andExpect(jsonPath("$[*].name").value(org.hamcrest.Matchers.contains("공지사항", "일러스트", "소설")));
        mvc.perform(get("/api/channels/art"))
                .andExpect(jsonPath("$.categories[1].name").value("일러스트"))
                .andExpect(jsonPath("$.categories[0].ownerOnly").value(true));

        mvc.perform(auth(post("/api/channels/art/members"), member)).andExpect(status().isOk());
        mvc.perform(auth(post("/api/channels/free/members"), member)).andExpect(status().isOk());

        // 관리자 전용 카테고리: 회원은 못 쓰고 소유자는 쓸 수 있다
        mvc.perform(auth(json(post("/api/posts"),
                        Map.of("channel", "art", "categoryId", notice, "title", "공지", "content", "c")), member))
                .andExpect(status().isForbidden());
        mvc.perform(auth(json(post("/api/posts"),
                        Map.of("channel", "art", "categoryId", notice, "title", "공지", "content", "c")), owner))
                .andExpect(jsonPath("$.category.name").value("공지사항"));
        JsonNode novelPost = body(mvc.perform(auth(json(post("/api/posts"),
                        Map.of("channel", "art", "categoryId", novel, "title", "소설 1화", "content", "c")), member))
                .andExpect(jsonPath("$.category.name").value("소설")));
        mvc.perform(auth(json(post("/api/posts"), Map.of("channel", "art", "title", "잡담", "content", "c")), member))
                .andExpect(status().isCreated());
        // 다른 채널의 카테고리는 쓸 수 없다
        mvc.perform(auth(json(post("/api/posts"),
                        Map.of("channel", "free", "categoryId", novel, "title", "t", "content", "c")), member))
                .andExpect(status().isBadRequest());

        // 카테고리 탭 목록
        mvc.perform(get("/api/posts").param("channel", "art").param("category", String.valueOf(novel)))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].categoryName").value("소설"));
        mvc.perform(get("/api/posts").param("channel", "art")).andExpect(jsonPath("$.items", hasSize(3)));

        // 글의 카테고리 바꾸기
        long postId = novelPost.get("id").asLong();
        mvc.perform(auth(json(put("/api/posts/" + postId),
                        Map.of("categoryId", art, "title", "그림으로 바꿈", "content", "c")), member))
                .andExpect(jsonPath("$.category.name").value("일러스트"));
        mvc.perform(auth(json(put("/api/posts/" + postId),
                        Map.of("categoryId", notice, "title", "t", "content", "c")), member))
                .andExpect(status().isForbidden());

        // 이름 변경 / 삭제 → 글은 남고 카테고리만 빈다
        mvc.perform(auth(json(put(base + "/" + art), Map.of("name", "그림", "ownerOnly", false)), owner))
                .andExpect(jsonPath("$[1].name").value("그림"));
        mvc.perform(get("/api/posts/" + postId)).andExpect(jsonPath("$.category.name").value("그림"));
        mvc.perform(auth(delete(base + "/" + art), member)).andExpect(status().isForbidden());
        mvc.perform(auth(delete(base + "/" + art), owner)).andExpect(jsonPath("$", hasSize(2)));
        mvc.perform(get("/api/posts/" + postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").doesNotExist());
        mvc.perform(get("/api/channels/art")).andExpect(jsonPath("$.postCount").value(3));
    }

    @Test
    void channelPreviewsShowRecentPostsPerChannel() throws Exception {
        String owner = signup("preview@test.dev", "미리보기");
        for (String slug : new String[]{"pv-many", "pv-few", "pv-empty"}) {
            mvc.perform(auth(json(post("/api/channels"), Map.of("slug", slug, "name", "미리" + slug.substring(3))), owner))
                    .andExpect(status().isCreated());
        }
        for (int i = 1; i <= 10; i++) {
            mvc.perform(auth(json(post("/api/posts"), Map.of("channel", "pv-many", "title", "많은글 " + i, "content", "c")), owner));
        }
        for (int i = 1; i <= 2; i++) {
            mvc.perform(auth(json(post("/api/posts"), Map.of("channel", "pv-few", "title", "적은글 " + i, "content", "c")), owner));
        }

        JsonNode list = body(mvc.perform(get("/api/channels/previews").param("q", "미리")).andExpect(status().isOk()));
        Map<String, JsonNode> bySlug = new java.util.HashMap<>();
        list.forEach(c -> bySlug.put(c.get("slug").asText(), c));
        org.assertj.core.api.Assertions.assertThat(bySlug).containsKeys("pv-many", "pv-few", "pv-empty");

        JsonNode many = bySlug.get("pv-many").get("recentPosts");
        org.assertj.core.api.Assertions.assertThat(many).hasSize(8); // 최대 8개
        org.assertj.core.api.Assertions.assertThat(many.get(0).get("title").asText()).isEqualTo("많은글 10"); // 최신순
        org.assertj.core.api.Assertions.assertThat(many.get(7).get("title").asText()).isEqualTo("많은글 3");
        org.assertj.core.api.Assertions.assertThat(bySlug.get("pv-few").get("recentPosts")).hasSize(2);
        org.assertj.core.api.Assertions.assertThat(bySlug.get("pv-empty").get("recentPosts")).isEmpty();

        // 개수 지정 (상한 8)
        mvc.perform(get("/api/channels/previews").param("q", "pv-many").param("size", "3"))
                .andExpect(jsonPath("$[0].recentPosts", hasSize(3)));
        mvc.perform(get("/api/channels/previews").param("q", "pv-many").param("size", "50"))
                .andExpect(jsonPath("$[0].recentPosts", hasSize(8)));
        // 검색어 없이 부르면 인기 채널 기준
        mvc.perform(get("/api/channels/previews")).andExpect(status().isOk());
        // 'previews' 는 채널 주소로 쓸 수 없다
        mvc.perform(auth(json(post("/api/channels"), Map.of("slug", "previews", "name", "예약어")), owner))
                .andExpect(status().isConflict());
    }

    @Test
    void channelMembership() throws Exception {
        String owner = signup("club-owner@test.dev", "모임장");
        String guest = signup("club-guest@test.dev", "구경꾼");
        mvc.perform(auth(json(post("/api/channels"), Map.of("slug", "club", "name", "동호회")), owner))
                .andExpect(jsonPath("$.joined").value(true))
                .andExpect(jsonPath("$.memberCount").value(1));
        long postId = body(mvc.perform(auth(json(post("/api/posts"),
                        Map.of("channel", "club", "title", "환영해요", "content", "c")), owner))
                .andExpect(status().isCreated())).get("id").asLong();

        // 가입 안 한 사람: 글쓰기는 막히고
        mvc.perform(auth(get("/api/channels/club"), guest)).andExpect(jsonPath("$.joined").value(false));
        mvc.perform(auth(json(post("/api/posts"), Map.of("channel", "club", "title", "t", "content", "c")), guest))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("'동호회' 채널에 가입해야 글을 쓸 수 있어요"));
        // 보기 · 공감 · 댓글 · 댓글 좋아요는 된다
        mvc.perform(auth(get("/api/posts/" + postId), guest)).andExpect(status().isOk());
        mvc.perform(auth(post("/api/posts/" + postId + "/like"), guest)).andExpect(jsonPath("$.liked").value(true));
        long commentId = body(mvc.perform(auth(json(post("/api/posts/" + postId + "/comments"),
                        Map.of("content", "구경 왔어요")), guest))
                .andExpect(status().isCreated())).get("id").asLong();
        mvc.perform(auth(post("/api/posts/" + postId + "/comments/" + commentId + "/like"), guest))
                .andExpect(jsonPath("$.liked").value(true));

        // 가입하면 글을 쓸 수 있다 (여러 번 눌러도 한 번만)
        mvc.perform(auth(post("/api/channels/club/members"), guest))
                .andExpect(jsonPath("$.joined").value(true))
                .andExpect(jsonPath("$.memberCount").value(2));
        mvc.perform(auth(post("/api/channels/club/members"), guest)).andExpect(jsonPath("$.memberCount").value(2));
        mvc.perform(auth(json(post("/api/posts"), Map.of("channel", "club", "title", "가입 인사", "content", "c")), guest))
                .andExpect(status().isCreated());
        mvc.perform(auth(get("/api/me/channels"), guest))
                .andExpect(jsonPath("$[0].slug").value("club"))
                .andExpect(jsonPath("$[0].memberCount").value(2))
                .andExpect(jsonPath("$[0].owner").value(false));
        mvc.perform(auth(get("/api/me/channels"), owner)).andExpect(jsonPath("$[0].owner").value(true));
        mvc.perform(auth(get("/api/channels/previews").param("q", "club"), guest))
                .andExpect(jsonPath("$[0].joined").value(true));
        mvc.perform(get("/api/channels/previews").param("q", "club"))
                .andExpect(jsonPath("$[0].joined").value(false));

        // 탈퇴하면 다시 못 쓴다. 만든 사람은 탈퇴할 수 없다
        mvc.perform(auth(delete("/api/channels/club/members/me"), guest))
                .andExpect(jsonPath("$.joined").value(false))
                .andExpect(jsonPath("$.memberCount").value(1));
        mvc.perform(auth(json(post("/api/posts"), Map.of("channel", "club", "title", "t", "content", "c")), guest))
                .andExpect(status().isForbidden());
        mvc.perform(auth(delete("/api/channels/club/members/me"), owner)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/channels/club/members")).andExpect(status().isUnauthorized());
        mvc.perform(auth(get("/api/me/channels"), guest)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void bookmarksAndProfile() throws Exception {
        String me = signup("mypage@test.dev", "마이페이지");
        signup("taken@test.dev", "이미있음");

        // 채널 북마크 (가입과 별개, 여러 번 눌러도 같음)
        mvc.perform(auth(get("/api/channels/free"), me)).andExpect(jsonPath("$.bookmarked").value(false));
        mvc.perform(auth(put("/api/channels/free/bookmark"), me)).andExpect(jsonPath("$.bookmarked").value(true));
        mvc.perform(auth(put("/api/channels/free/bookmark"), me)).andExpect(jsonPath("$.bookmarked").value(true));
        mvc.perform(auth(put("/api/channels/daily/bookmark"), me));
        mvc.perform(auth(get("/api/channels/free"), me))
                .andExpect(jsonPath("$.bookmarked").value(true))
                .andExpect(jsonPath("$.joined").value(false));
        mvc.perform(auth(get("/api/me/bookmarks/channels"), me))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].slug").value("daily")); // 최근 북마크 순
        mvc.perform(auth(delete("/api/channels/free/bookmark"), me)).andExpect(jsonPath("$.bookmarked").value(false));
        mvc.perform(auth(get("/api/me/bookmarks/channels"), me)).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(put("/api/channels/free/bookmark")).andExpect(status().isUnauthorized());

        // 닉네임 변경: 새 토큰과 함께 돌아오고, 겹치면 409
        mvc.perform(auth(json(put("/api/me/profile"), Map.of("nickname", "이미있음")), me)).andExpect(status().isConflict());
        String renamedToken = body(mvc.perform(auth(json(put("/api/me/profile"), Map.of("nickname", "새닉네임")), me))
                .andExpect(jsonPath("$.user.nickname").value("새닉네임"))).get("token").asText();
        mvc.perform(auth(get("/api/me"), renamedToken)).andExpect(jsonPath("$.nickname").value("새닉네임"));

        // 비밀번호 변경: 지금 비밀번호가 맞아야 한다
        mvc.perform(auth(json(put("/api/me/password"),
                        Map.of("currentPassword", "wrong-password", "newPassword", "newpassword123")), me))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("지금 비밀번호가 맞지 않아요"));
        mvc.perform(auth(json(put("/api/me/password"),
                        Map.of("currentPassword", "password1234", "newPassword", "short")), me))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(json(put("/api/me/password"),
                        Map.of("currentPassword", "password1234", "newPassword", "newpassword123")), me))
                .andExpect(status().isNoContent());
        mvc.perform(json(post("/api/auth/login"), Map.of("email", "mypage@test.dev", "password", "password1234")))
                .andExpect(status().isUnauthorized());
        mvc.perform(json(post("/api/auth/login"), Map.of("email", "mypage@test.dev", "password", "newpassword123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.nickname").value("새닉네임"));
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
