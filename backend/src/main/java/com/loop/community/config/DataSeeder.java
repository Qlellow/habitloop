package com.loop.community.config;

import com.loop.community.channel.Channel;
import com.loop.community.channel.ChannelCategory;
import com.loop.community.channel.ChannelCategoryRepository;
import com.loop.community.channel.ChannelRepository;
import com.loop.community.comment.Comment;
import com.loop.community.comment.CommentLike;
import com.loop.community.comment.CommentLikeRepository;
import com.loop.community.comment.CommentRepository;
import com.loop.community.post.Post;
import com.loop.community.post.PostRepository;
import com.loop.community.user.User;
import com.loop.community.user.UserRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

    private static final String MARKDOWN_SAMPLE = """
            리액트를 처음 공부할 때 **이 순서**로 하니까 덜 헤맸어요.

            ## 1. 기초 문법
            - JSX 와 컴포넌트
            - `props` 와 `state`
            - 조건부 렌더링, 리스트

            ## 2. 훅
            1. `useState`, `useEffect`
            2. 커스텀 훅 만들어 보기

            > 처음부터 상태 관리 라이브러리를 붙이지 말고, 꼭 필요할 때 도입하세요.

            ```tsx
            function Counter() {
              const [count, setCount] = useState(0);
              return <button onClick={() => setCount(count + 1)}>{count}</button>;
            }
            ```

            자세한 건 [공식 문서](https://react.dev)를 참고하세요!
            """;

    /** channel slug, title, content */
    private static final List<String[]> SAMPLES = List.of(
            new String[]{"free", "요즘 제일 잘 산 물건 하나씩 공유해요", "저는 무선 청소기요. 청소가 이렇게 즐거울 수 있다니…\n여러분은 뭐가 있나요?"},
            new String[]{"money", "첫 월급 관리 어떻게 하셨어요?", "다음 달에 첫 월급을 받는데, **통장 쪼개기**부터 해야 할지 모르겠어요. 팁 부탁드려요!"},
            new String[]{"info", "자취 필수템 정리 (2026 ver.)", "1. 멀티탭은 개별 스위치형\n2. 전자레인지 용기는 유리로\n3. 암막 커튼은 생각보다 중요해요"},
            new String[]{"daily", "오늘 한강 노을 진짜 예뻤어요", "퇴근길에 잠깐 들렀는데 하늘이 분홍색이었어요. 다들 오늘 하루도 고생 많으셨어요."},
            new String[]{"dev", "리액트 공부 순서 정리해 봤어요", MARKDOWN_SAMPLE},
            new String[]{"money", "적금 금리 비교해 봤어요", "주요 은행 12개월 적금 금리를 정리해 봤어요.\n\n| 은행 | 기본 | 우대 |\n| --- | --- | --- |\n| A은행 | 3.1% | 4.0% |\n| B은행 | 3.3% | 3.8% |\n\n우대 조건을 꼭 확인하세요."},
            new String[]{"question", "주말에 갈 만한 등산 코스 있을까요?", "초보도 갈 수 있는 서울 근교 코스 추천 부탁드려요!"},
            new String[]{"daily", "3개월째 아침 운동 성공 중", "처음엔 힘들었는데 이제는 안 하면 허전해요. 작은 습관의 힘!"}
    );

    private final UserRepository userRepository;
    private final ChannelRepository channelRepository;
    private final ChannelCategoryRepository categoryRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final CommentLikeRepository commentLikeRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository, ChannelRepository channelRepository,
                      ChannelCategoryRepository categoryRepository, PostRepository postRepository, CommentRepository commentRepository,
                      CommentLikeRepository commentLikeRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.channelRepository = channelRepository;
        this.categoryRepository = categoryRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.commentLikeRepository = commentLikeRepository;
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

        // 기본 채널(free/question/info/daily)은 마이그레이션이 만들고, 사용자 채널을 몇 개 추가한다
        channelRepository.save(new Channel("dev", "개발", "개발 이야기, 코드 리뷰, 커리어 고민까지", users.get(0)));
        channelRepository.save(new Channel("money", "재테크", "월급 관리부터 투자까지 돈 이야기", users.get(1)));
        Map<String, Channel> channels = new HashMap<>();
        channelRepository.findAll().forEach(c -> channels.put(c.getSlug(), c));

        List<String> replies = List.of("좋은 글 감사해요 🙌", "저도 궁금했어요!", "완전 공감해요", "꿀팁 저장합니다");
        for (int round = 0; round < 5; round++) {
            for (int i = 0; i < SAMPLES.size(); i++) {
                String[] s = SAMPLES.get(i);
                Channel channel = channels.get(s[0]);
                User author = users.get((i + round) % users.size());
                String title = round == 0 ? s[1] : s[1] + " (" + (round + 1) + ")";
                Post post = postRepository.save(new Post(author, channel, null, title, s[2]));
                channelRepository.addPostCount(channel.getId(), 1);

                int comments = (i + round) % 4 + 1;
                for (int c = 0; c < comments; c++) {
                    Comment comment = commentRepository.save(
                            new Comment(post, users.get((i + c + 1) % users.size()), replies.get((i + c) % replies.size())));
                    // 첫 댓글에 좋아요를 몰아줘서 베스트 댓글 예시를 만든다
                    int likes = c == 0 ? (i + round) % 3 + 1 : 0;
                    for (int l = 0; l < likes; l++) {
                        commentLikeRepository.save(new CommentLike(comment.getId(), users.get(l).getId()));
                    }
                    commentRepository.addLikeCount(comment.getId(), likes);
                }
                postRepository.addCommentCount(post.getId(), comments);
                postRepository.addLikeCount(post.getId(), (i * 7 + round * 3) % 20);
            }
        }
        seedCreativeChannel(users);
    }

    /** 채널 안 카테고리 예시: 공지사항(관리자 전용) / 소설 / 일러스트 */
    private void seedCreativeChannel(List<User> users) {
        User owner = users.get(0);
        Channel creative = channelRepository.save(new Channel("creative", "창작", "직접 쓴 소설과 그린 그림을 나눠요", owner));
        ChannelCategory notice = categoryRepository.save(new ChannelCategory(creative, "공지사항", true, 0));
        ChannelCategory novel = categoryRepository.save(new ChannelCategory(creative, "소설", false, 1));
        ChannelCategory art = categoryRepository.save(new ChannelCategory(creative, "일러스트", false, 2));

        List<Object[]> posts = List.of(
                new Object[]{owner, notice, "창작 채널 이용 안내", "## 환영해요!\n\n- 직접 만든 작품만 올려 주세요\n- 소설은 **소설**, 그림은 **일러스트** 카테고리에 올려 주세요"},
                new Object[]{users.get(1), novel, "[단편] 새벽 세 시의 편의점", "> 형광등 아래에서 우리는 모두 조금씩 외로웠다.\n\n새벽 세 시, 편의점 문이 열렸다…"},
                new Object[]{users.get(2), art, "봄 풍경 수채화 그려 봤어요", "처음 그려 본 수채화예요. 벚꽃 색 내기가 어렵네요 🌸"},
                new Object[]{users.get(1), novel, "[연재] 달의 도서관 1화", "도서관은 보름달이 뜨는 밤에만 문을 열었다."},
                new Object[]{users.get(2), null, "다들 작업할 때 뭐 들으세요?", "저는 주로 로파이 틀어 놔요."});
        for (Object[] p : posts) {
            postRepository.save(new Post((User) p[0], creative, (ChannelCategory) p[1], (String) p[2], (String) p[3]));
        }
        channelRepository.addPostCount(creative.getId(), posts.size());
    }
}
