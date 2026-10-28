import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ApiError,
  REACTIONS,
  REPORT_REASONS,
  apiUrl,
  compact,
  timeAgo,
  useAddComment,
  useAuth,
  useBestComments,
  useBlockUser,
  useComments,
  useDeleteComment,
  useDeletePost,
  useEditComment,
  usePost,
  useReport,
  useToggleCommentLike,
  useToggleLike,
  useToggleReaction,
  type Comment,
  type PostDetail,
} from '@loop/shared';
import { Markdown } from '../../src/Markdown';
import { Avatar, BadgeMark, Button, Empty, Heart, Loading, RoleTag, Sheet, Skeleton, type SheetOption } from '../../src/ui';
import { cn } from '../../src/cn';
import { useColors } from '../../src/theme';

/** 댓글 안의 사진 ![](/api/images/…) 은 글자 대신 작은 사진으로 */
const COMMENT_IMAGE = /!\[[^\]\n]*\]\((\/api\/images\/[A-Za-z0-9_-]{16,32})(?:#[^)\s]*)?\)/g;

function CommentContent({ content }: { content: string }) {
  const images = [...content.matchAll(COMMENT_IMAGE)].map((m) => m[1]);
  const text = content.replace(COMMENT_IMAGE, '').replace(/\n{3,}/g, '\n\n').trim();
  return (
    <>
      {text ? <Text className="mt-1 text-[15px] leading-[22px] text-fg">{text}</Text> : null}
      {images.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 mt-2">
          {images.map((src, i) => (
            <Image key={i} source={{ uri: apiUrl(src) }} style={{ width: 120, height: 120, borderRadius: 8 }} resizeMode="cover" />
          ))}
        </View>
      ) : null}
    </>
  );
}

function toast(message: string) {
  Alert.alert(message);
}

/** 댓글 입력창이 지금 하는 일: 새 댓글 · 답글 · 고치기 */
type Mode = { kind: 'new' } | { kind: 'reply'; to: Comment } | { kind: 'edit'; target: Comment };

/** 화면 하나에 고르기 창 하나: 글 · 댓글 메뉴와 신고 사유가 같이 쓴다 */
interface ScreenCtx {
  postId: number;
  openSheet: (title: string | undefined, options: SheetOption[]) => void;
  setMode: (m: Mode) => void;
  report: (commentId?: number) => void;
  block: (userId: string, nickname: string) => void;
}
const Ctx = createContext<ScreenCtx>(null!);

function Author({ post }: { post: PostDetail }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(`/u/${post.author.id}`)}
      className="flex-row items-center gap-2.5 pb-[18px] border-b border-line active:opacity-70"
    >
      <Avatar name={post.author.nickname} uri={post.author.avatarUrl} />
      <View className="shrink">
        <View className="flex-row items-center gap-1.5">
          <Text className="shrink text-[15px] font-semibold text-fg-strong" numberOfLines={1}>
            {post.author.nickname}
          </Text>
          <BadgeMark badge={post.author.featuredBadge} />
          <RoleTag role={post.author.role} />
        </View>
        <Text className="text-[13px] text-fg-weak">
          {timeAgo(post.createdAt)} · 조회 {compact(post.viewCount)}
        </Text>
      </View>
    </Pressable>
  );
}

/** 좋아요 + 감정 반응 (종류마다 한 번씩) */
function Reactions({ post }: { post: PostDetail }) {
  const c = useColors();
  const { isLoggedIn } = useAuth();
  const like = useToggleLike(post.id);
  const react = useToggleReaction(post.id);
  const mine = new Set(post.myReactions ?? []);
  const guard = (fn: () => void) => (isLoggedIn ? fn() : router.push('/login'));
  return (
    <View className="items-center gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: post.liked }}
        onPress={() => guard(() => like.mutate(!post.liked, { onError: (e) => toast(e.message) }))}
        className={cn('flex-row items-center gap-1.5 h-11 px-5 rounded-full active:scale-95', post.liked ? 'bg-danger-weak' : 'bg-field')}
      >
        <Heart filled={post.liked} size={20} color={post.liked ? c.danger : c.sub} />
        <Text className={cn('text-[15px] font-semibold', post.liked ? 'text-danger' : 'text-fg-sub')}>좋아요 {compact(post.likeCount)}</Text>
      </Pressable>
      <View className="flex-row flex-wrap justify-center gap-2">
        {REACTIONS.map((r) => {
          const on = mine.has(r.kind);
          const n = post.reactions?.[r.kind] ?? 0;
          return (
            <Pressable
              key={r.kind}
              accessibilityRole="button"
              accessibilityLabel={`${r.label} ${n}`}
              accessibilityState={{ selected: on }}
              onPress={() => guard(() => react.mutate({ kind: r.kind, on: !on }, { onError: (e) => toast(e.message) }))}
              className={cn(
                'flex-row items-center gap-1 h-9 px-3 rounded-full border active:scale-95',
                on ? 'bg-primary-weak border-primary' : 'bg-surface border-border',
              )}
            >
              <Text className="text-base">{r.emoji}</Text>
              {n > 0 ? <Text className={cn('text-[13px] font-semibold', on ? 'text-primary' : 'text-fg-sub')}>{compact(n)}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Article({ post, placeholder }: { post: PostDetail; placeholder: boolean }) {
  const [showBlocked, setShowBlocked] = useState(false);
  const masked = post.blockedAuthor && !showBlocked;
  return (
    <View className="p-5 pb-7 border-b-[12px] border-bg">
      <View className="flex-row items-center gap-1.5">
        <Text className="text-sm font-semibold text-primary" onPress={() => router.push(`/c/${post.channel.slug}`)}>
          {post.channel.name}
        </Text>
        {post.category ? (
          <>
            <Text className="text-fg-weak">›</Text>
            <Text className="text-sm font-semibold text-primary" onPress={() => router.push(`/c/${post.channel.slug}?category=${post.category!.id}`)}>
              {post.category.name}
            </Text>
          </>
        ) : null}
      </View>
      <Text className="mt-2 mb-4 text-2xl leading-8 font-bold text-fg-strong">{post.title}</Text>
      <Author post={post} />
      {post.hidden ? (
        <View className="mt-4 px-3.5 py-2.5 rounded-sm bg-field">
          <Text className="text-[13px] text-fg-sub">운영진이 숨긴 글이에요. 쓴 사람과 운영진에게만 보여요.</Text>
        </View>
      ) : null}
      <View className="mt-5 mb-4 min-h-[60px]">
        {placeholder ? (
          <>
            <Skeleton width="100%" height={18} />
            <Skeleton width="88%" height={18} className="mt-2.5" />
            <Skeleton width="60%" height={18} className="mt-2.5" />
          </>
        ) : masked ? (
          <Empty action={<Button title="그래도 보기" variant="ghost" size="sm" onPress={() => setShowBlocked(true)} />}>차단한 사용자의 글이에요</Empty>
        ) : (
          <Markdown source={post.content} />
        )}
      </View>
      {!placeholder && !masked && <Reactions post={post} />}
    </View>
  );
}

function CommentItem({ comment: cm, best, reply }: { comment: Comment; best?: boolean; reply?: boolean }) {
  const c = useColors();
  const { isLoggedIn } = useAuth();
  const { postId, openSheet, setMode, report, block } = useContext(Ctx);
  const like = useToggleCommentLike(postId);
  const remove = useDeleteComment(postId);
  const masked = cm.blocked || (cm.hidden && !cm.content);

  const confirmDelete = () =>
    Alert.alert(cm.replies?.length ? '답글까지 함께 지워져요. 삭제할까요?' : '댓글을 삭제할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => remove.mutate(cm.id, { onError: (e) => toast(e.message) }) },
    ]);

  const menu = () => {
    const options: SheetOption[] = [];
    if (cm.mine) options.push({ label: '수정', onPress: () => setMode({ kind: 'edit', target: cm }) });
    if (cm.deletable) options.push({ label: '삭제', destructive: true, onPress: confirmDelete });
    if (!cm.mine && isLoggedIn) {
      options.push({ label: '신고', destructive: true, onPress: () => report(cm.id) });
      if (!cm.blocked) options.push({ label: `${cm.authorNickname}님 차단`, destructive: true, onPress: () => block(cm.authorId, cm.authorNickname) });
    }
    if (!isLoggedIn) options.push({ label: '로그인하고 신고하기', onPress: () => router.push('/login') });
    openSheet(undefined, options);
  };

  return (
    <View className={cn(best && 'mx-3 mb-1.5 rounded-md bg-primary-weak', reply && 'ml-12 border-l-2 border-line')}>
      <View className={cn('flex-row gap-2.5 py-3.5', best ? 'px-4' : reply ? 'pl-3 pr-5' : 'px-5')}>
        <Pressable onPress={() => !masked && router.push(`/u/${cm.authorId}`)} accessibilityLabel={`${cm.authorNickname} 프로필`}>
          <Avatar name={masked ? '?' : cm.authorNickname} uri={masked ? undefined : cm.authorAvatar} size={reply ? 28 : 32} />
        </Pressable>
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            {best ? (
              <Text className="px-1.5 py-px rounded-[6px] overflow-hidden bg-primary text-white text-[11px] font-extrabold">BEST</Text>
            ) : null}
            <Text className="shrink text-sm font-semibold text-fg-strong" numberOfLines={1}>
              {masked ? '알 수 없음' : cm.authorNickname}
            </Text>
            {!masked && <BadgeMark badge={cm.authorBadge} size={16} />}
            {!masked && <RoleTag role={cm.authorRole} />}
            <Text className="text-[13px] text-fg-weak">
              {timeAgo(cm.createdAt)}
              {cm.updatedAt ? ' · 수정됨' : ''}
            </Text>
            {!best && !masked ? (
              <Pressable hitSlop={10} className="ml-auto" onPress={menu} accessibilityLabel="댓글 메뉴">
                <Ionicons name="ellipsis-horizontal" size={16} color={c.weak} />
              </Pressable>
            ) : null}
          </View>
          {cm.blocked ? (
            <Text className="mt-1 text-[15px] text-fg-weak">차단한 사용자의 댓글이에요</Text>
          ) : masked ? (
            <Text className="mt-1 text-[15px] text-fg-weak">운영진이 숨긴 댓글이에요</Text>
          ) : (
            <>
              {cm.hidden ? <Text className="mt-1 text-xs font-semibold text-fg-weak">숨겨진 댓글 (운영진 · 쓴 사람만 보여요)</Text> : null}
              <CommentContent content={cm.content} />
            </>
          )}
          {!masked && (
            <View className="flex-row items-center gap-4 mt-2">
              <Pressable
                hitSlop={8}
                className="flex-row items-center gap-1"
                accessibilityRole="button"
                accessibilityState={{ selected: cm.liked }}
                onPress={() =>
                  isLoggedIn ? like.mutate({ commentId: cm.id, like: !cm.liked }, { onError: (e) => toast(e.message) }) : router.push('/login')
                }
              >
                <Heart filled={cm.liked} size={15} color={cm.liked ? c.danger : c.weak} />
                <Text className={cn('text-[13px] text-fg-weak', cm.liked && 'text-danger')}>{cm.likeCount > 0 ? compact(cm.likeCount) : '좋아요'}</Text>
              </Pressable>
              {!best && !reply ? (
                <Pressable hitSlop={8} accessibilityRole="button" onPress={() => (isLoggedIn ? setMode({ kind: 'reply', to: cm }) : router.push('/login'))}>
                  <Text className="text-[13px] text-fg-weak">답글 달기</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </View>
      {!best && cm.replies?.map((r) => <CommentItem key={r.id} comment={r} reply />)}
    </View>
  );
}

function Composer({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuth();
  const { postId } = useContext(Ctx);
  const add = useAddComment(postId);
  const edit = useEditComment(postId);
  const [text, setText] = useState('');
  const input = useRef<TextInput>(null);

  // 고치기를 고르면 그 댓글로 채우고, 답글 · 고치기를 고르면 입력창에 바로 커서를 둔다
  useEffect(() => {
    if (mode.kind === 'new') return;
    if (mode.kind === 'edit') setText(mode.target.content);
    const t = setTimeout(() => input.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [mode]);

  if (!isLoggedIn) {
    return (
      <View className="flex-row items-end gap-2 px-3 pt-2.5 bg-surface border-t border-border" style={{ paddingBottom: 10 + insets.bottom }}>
        <Button title="로그인하고 댓글 남기기" variant="secondary" full onPress={() => router.push('/login')} />
      </View>
    );
  }
  const pending = add.isPending || edit.isPending;
  const done = () => {
    setText('');
    setMode({ kind: 'new' });
  };
  const submit = () => {
    const content = text.trim();
    if (!content) return;
    const onError = (e: Error) => toast(e.message);
    if (mode.kind === 'edit') edit.mutate({ id: mode.target.id, content }, { onSuccess: done, onError });
    else add.mutate(mode.kind === 'reply' ? { content, parentId: mode.to.id } : content, { onSuccess: done, onError });
  };
  return (
    <View className="bg-surface border-t border-border" style={{ paddingBottom: 10 + insets.bottom }}>
      {mode.kind !== 'new' ? (
        <View className="flex-row items-center px-4 pt-2">
          <Text className="flex-1 text-[13px] text-fg-sub" numberOfLines={1}>
            {mode.kind === 'reply' ? `${mode.to.authorNickname}님에게 답글` : '댓글 고치는 중'}
          </Text>
          <Pressable hitSlop={10} onPress={done} accessibilityLabel="취소">
            <Ionicons name="close" size={18} color={c.weak} />
          </Pressable>
        </View>
      ) : null}
      <View className="flex-row items-end gap-2 px-3 pt-2.5">
        <TextInput
          ref={input}
          className="flex-1 min-h-[42px] max-h-[120px] px-4 py-[11px] rounded-[21px] bg-field text-[15px] text-fg-strong"
          placeholder={mode.kind === 'reply' ? '답글을 남겨 보세요' : '댓글을 남겨 보세요'}
          placeholderTextColor={c.weak}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <Pressable
          onPress={submit}
          disabled={!text.trim() || pending}
          className={cn('w-[42px] h-[42px] rounded-full bg-primary items-center justify-center', (!text.trim() || pending) && 'opacity-40')}
          accessibilityLabel={mode.kind === 'edit' ? '댓글 저장' : '댓글 등록'}
        >
          <Ionicons name={mode.kind === 'edit' ? 'checkmark' : 'arrow-up'} size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

export default function PostScreen() {
  const c = useColors();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const navigation = useNavigation();
  const { isLoggedIn } = useAuth();
  const { data: post, isPlaceholderData, error } = usePost(id);
  const comments = useComments(id);
  const best = useBestComments(id);
  const del = useDeletePost();
  const reportMut = useReport();
  const blockMut = useBlockUser();
  const [sheet, setSheet] = useState<{ title?: string; options: SheetOption[] } | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'new' });

  const ctx: ScreenCtx = {
    postId: id,
    setMode,
    openSheet: (title, options) => setSheet({ title, options }),
    // 사유를 고르면 바로 신고한다 (고르기 창이 닫히는 애니메이션 뒤에 다음 창을 연다)
    report: (commentId) =>
      setTimeout(
        () =>
          setSheet({
            title: commentId ? '댓글 신고 사유' : '글 신고 사유',
            options: REPORT_REASONS.map((r) => ({
              label: r.label,
              onPress: () =>
                reportMut.mutate(
                  { postId: id, commentId, reason: r.value },
                  { onSuccess: () => toast('신고했어요. 운영진이 확인할게요.'), onError: (e) => toast(e.message) },
                ),
            })),
          }),
        250,
      ),
    block: (userId, nickname) =>
      Alert.alert(`${nickname}님을 차단할까요?`, '이 사람의 글과 댓글이 가려지고, 나에게 알림을 보낼 수 없어요.', [
        { text: '취소', style: 'cancel' },
        {
          text: '차단',
          style: 'destructive',
          onPress: () => blockMut.mutate({ userId, block: true }, { onSuccess: () => toast('차단했어요'), onError: (e) => toast(e.message) }),
        },
      ]),
  };

  const postMenu = () => {
    if (!post) return;
    const options: SheetOption[] = [];
    if (post.mine) options.push({ label: '수정', onPress: () => router.push(`/write?id=${id}`) });
    if (post.mine || post.canModerate)
      options.push({
        label: post.mine ? '삭제' : '운영진 권한으로 삭제',
        destructive: true,
        onPress: () =>
          Alert.alert('글을 삭제할까요?', '댓글도 함께 지워져요.', [
            { text: '취소', style: 'cancel' },
            { text: '삭제', style: 'destructive', onPress: () => del.mutate(id, { onSuccess: () => router.back(), onError: (e) => toast(e.message) }) },
          ]),
      });
    if (!post.mine) {
      if (!isLoggedIn) options.push({ label: '로그인하고 신고하기', onPress: () => router.push('/login') });
      else {
        options.push({ label: '신고', destructive: true, onPress: () => ctx.report() });
        if (!post.blockedAuthor) options.push({ label: `${post.author.nickname}님 차단`, destructive: true, onPress: () => ctx.block(post.author.id, post.author.nickname) });
      }
    }
    setSheet({ options });
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: post?.channel.name ?? '',
      headerRight:
        post && !isPlaceholderData
          ? () => (
              <Pressable hitSlop={10} accessibilityLabel="더보기" onPress={postMenu}>
                <Ionicons name="ellipsis-horizontal" size={22} color={c.textStrong} />
              </Pressable>
            )
          : undefined,
    });
  });

  if (error instanceof ApiError && error.status === 404) {
    return <Empty>삭제되었거나 없는 글이에요</Empty>;
  }

  const list = comments.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Ctx.Provider value={ctx}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          data={list}
          keyExtractor={(cm) => String(cm.id)}
          renderItem={({ item }) => <CommentItem comment={item} />}
          ItemSeparatorComponent={() => <View className="h-px bg-line mx-5" />}
          ListHeaderComponent={
            <>
              {post ? <Article post={post} placeholder={isPlaceholderData} /> : <Loading />}
              <View className="pt-5">
                <Text className="px-5 pb-2 text-[17px] font-bold text-fg-strong">
                  댓글 <Text className="text-primary">{post?.commentCount ?? ''}</Text>
                </Text>
                {best.data?.map((cm) => <CommentItem key={`best-${cm.id}`} comment={cm} best />)}
              </View>
            </>
          }
          ListEmptyComponent={comments.isPending ? <Loading /> : <Empty>첫 댓글을 남겨 보세요</Empty>}
          ListFooterComponent={comments.isFetchingNextPage ? <Loading /> : <View className="h-6" />}
          onEndReached={() => comments.hasNextPage && !comments.isFetchingNextPage && comments.fetchNextPage()}
          onEndReachedThreshold={0.5}
          className="bg-surface"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />
        <Composer mode={mode} setMode={setMode} />
      </KeyboardAvoidingView>
      <Sheet visible={sheet != null} title={sheet?.title} options={sheet?.options ?? []} onClose={() => setSheet(null)} />
    </Ctx.Provider>
  );
}
