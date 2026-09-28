package com.loop.community.config;

import com.loop.community.comment.Comment;
import com.loop.community.comment.CommentRepository;
import com.loop.community.post.Category;
import com.loop.community.post.Post;
import com.loop.community.post.PostRepository;
import com.loop.community.user.User;
import com.loop.community.user.UserRepository;
import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** 로컬 개발용 샘플 데이터. (app.seed=true 일 때만 동작) */
@Component
@ConditionalOnProperty(name = "app.seed", havingValue = "true")
public class DataSeeder implements ApplicationRunner {

    private static final List<String[]> SAMPLES = List.of(
            new String[]{"FREE", "요즘 제일 잘 산 물건 하나씩 공유해요", "저는 무선 청소기요. 청소가 이렇게 즐거울 수 있다니…\n여러분은 뭐가 있나요?"},
            new String[]{"QUESTION", "첫 월급 관리 어떻게 하셨어요?", "다음 달에 첫 월급을 받는데, 통장 쪼개기부터 해야 할지 모르겠어요. 팁 부탁드려요!"},
            new String[]{"INFO", "자취 필수템 정리 (2026 ver.)", "1. 멀티탭은 개별 스위치형\n2. 전자레인지 용기는 유리로\n3. 암막 커튼은 생각보다 중요해요"},
            new String[]{"DAILY", "오늘 한강 노을 진짜 예뻤어요", "퇴근길에 잠깐 들렀는데 하늘이 분홍색이었어요. 다들 오늘 하루도 고생 많으셨어요."},
            new String[]{"QUESTION", "리액트 공부 순서 추천해 주세요", "자바스크립트 기초는 끝냈는데, 리액트는 어디서부터 시작해야 할까요?"},
            new String[]{"INFO", "적금 금리 비교해 봤어요", "주요 은행 12개월 적금 금리를 정리해 봤어요. 우대 조건을 꼭 확인하세요."},
            new String[]{"FREE", "주말에 뭐 하세요?", "저는 오랜만에 등산 가려고요. 추천 코스 있으면 알려주세요!"},
            new String[]{"DAILY", "3개월째 아침 운동 성공 중", "처음엔 힘들었는데 이제는 안 하면 허전해요. 작은 습관의 힘!"}
    );

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository, PostRepository postRepository,
                      CommentRepository commentRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }
        String password = passwordEncoder.encode("password1234");
        List<User> users = userRepository.saveAll(List.of(
                new User("demo@loop.dev", password, "루프"),
                new User("mint@loop.dev", password, "민트초코"),
                new User("sky@loop.dev", password, "하늘색")));

        for (int round = 0; round < 5; round++) {
            for (int i = 0; i < SAMPLES.size(); i++) {
                String[] s = SAMPLES.get(i);
                User author = users.get((i + round) % users.size());
                String title = round == 0 ? s[1] : s[1] + " (" + (round + 1) + ")";
                Post post = postRepository.save(new Post(author, Category.valueOf(s[0]), title, s[2]));
                int comments = (i + round) % 4;
                for (int c = 0; c < comments; c++) {
                    commentRepository.save(new Comment(post, users.get((i + c + 1) % users.size()), "좋은 글 감사해요 🙌"));
                }
                postRepository.addCommentCount(post.getId(), comments);
                postRepository.addLikeCount(post.getId(), (i * 7 + round * 3) % 20);
            }
        }
    }
}
