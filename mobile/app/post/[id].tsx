import { useLayoutEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ApiError,
  compact,
  timeAgo,
  useAddComment,
  useAuth,
  useBestComments,
  useComments,
  useDeleteComment,
  useDeletePost,
  usePost,
  useToggleCommentLike,
  useToggleLike,
  type Comment,
  type PostDetail,
} from '@loop/shared';
import { Markdown } from '../../src/Markdown';
import { Avatar, Empty, Heart, Loading, Skeleton, Button } from '../../src/ui';
import { makeStyles, useColors } from '../../src/theme';

function toast(message: string) {
  Alert.alert(message);
}

function Article({ post, placeholder }: { post: PostDetail; placeholder: boolean }) {
  const s = useStyles();
  const c = useColors();
  const { isLoggedIn } = useAuth();
  const like = useToggleLike(post.id);
  return (
    <View style={s.article}>
      <View style={s.crumbs}>
        <Text style={s.crumb} onPress={() => router.push(`/c/${post.channel.slug}`)}>
          {post.channel.name}
        </Text>
        {post.category ? (
          <>
            <Text style={s.crumbSep}>›</Text>
            <Text style={s.crumb} onPress={() => router.push(`/c/${post.channel.slug}?category=${post.category!.id}`)}>
              {post.category.name}
            </Text>
          </>
        ) : null}
      </View>
      <Text style={s.title}>{post.title}</Text>
      <View style={s.byline}>
        <Avatar name={post.author.nickname} />
        <View>
          <Text style={s.author}>{post.author.nickname}</Text>
          <Text style={s.meta}>
            {timeAgo(post.createdAt)} · 조회 {compact(post.viewCount)}
          </Text>
        </View>
      </View>
      <View style={s.content}>
        {placeholder ? (
          <>
            <Skeleton width="100%" height={18} />
            <Skeleton width="88%" height={18} style={{ marginTop: 10 }} />
            <Skeleton width="60%" height={18} style={{ marginTop: 10 }} />
          </>
        ) : (
          <Markdown source={post.content} />
        )}
      </View>
      {!placeholder && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: post.liked }}
          onPress={() =>
            isLoggedIn ? like.mutate(!post.liked, { onError: (e) => toast(e.message) }) : router.push('/login')
          }
          style={({ pressed }) => [s.likeButton, post.liked && s.likeOn, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <Heart filled={post.liked} size={20} color={post.liked ? c.danger : c.sub} />
          <Text style={[s.likeText, post.liked && { color: c.danger }]}>좋아요 {compact(post.likeCount)}</Text>
        </Pressable>
      )}
    </View>
  );
}

function CommentItem({ comment: cm, postId, best }: { comment: Comment; postId: number; best?: boolean }) {
  const s = useStyles();
  const c = useColors();
  const { isLoggedIn } = useAuth();
  const like = useToggleCommentLike(postId);
  const remove = useDeleteComment(postId);
  return (
    <View style={[s.comment, best && s.best]}>
      <View style={s.commentHead}>
        {best ? <Text style={s.bestBadge}>BEST</Text> : null}
        <Text style={s.commentAuthor}>{cm.authorNickname}</Text>
        <Text style={s.meta}>{timeAgo(cm.createdAt)}</Text>
        {cm.mine && !best ? (
          <Text
            style={[s.meta, { marginLeft: 'auto' }]}
            onPress={() =>
              Alert.alert('댓글을 삭제할까요?', undefined, [
                { text: '취소', style: 'cancel' },
                { text: '삭제', style: 'destructive', onPress: () => remove.mutate(cm.id) },
              ])
            }
          >
            삭제
          </Text>
        ) : null}
      </View>
      <Text style={s.commentBody}>{cm.content}</Text>
      <Pressable
        hitSlop={8}
        style={s.commentLike}
        onPress={() =>
          isLoggedIn
            ? like.mutate({ commentId: cm.id, like: !cm.liked }, { onError: (e) => toast(e.message) })
            : router.push('/login')
        }
      >
        <Heart filled={cm.liked} size={15} color={cm.liked ? c.danger : c.weak} />
        <Text style={[s.meta, cm.liked && { color: c.danger }]}>{cm.likeCount > 0 ? compact(cm.likeCount) : '좋아요'}</Text>
      </Pressable>
    </View>
  );
}

function Composer({ postId }: { postId: number }) {
  const s = useStyles();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuth();
  const add = useAddComment(postId);
  const [text, setText] = useState('');

  if (!isLoggedIn) {
    return (
      <View style={[s.composer, { paddingBottom: 10 + insets.bottom }]}>
        <Button title="로그인하고 댓글 남기기" variant="secondary" full onPress={() => router.push('/login')} />
      </View>
    );
  }
  const submit = () => {
    const content = text.trim();
    if (!content) return;
    add.mutate(content, { onSuccess: () => setText(''), onError: (e) => toast(e.message) });
  };
  return (
    <View style={[s.composer, { paddingBottom: 10 + insets.bottom }]}>
      <TextInput
        style={s.composerInput}
        placeholder="댓글을 남겨 보세요"
        placeholderTextColor={c.weak}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
      />
      <Pressable
        onPress={submit}
        disabled={!text.trim() || add.isPending}
        style={[s.send, (!text.trim() || add.isPending) && { opacity: 0.4 }]}
        accessibilityLabel="댓글 등록"
      >
        <Ionicons name="arrow-up" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

export default function PostScreen() {
  const s = useStyles();
  const c = useColors();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const navigation = useNavigation();
  const { data: post, isPlaceholderData, error } = usePost(id);
  const comments = useComments(id);
  const best = useBestComments(id);
  const del = useDeletePost();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: post?.channel.name ?? '',
      headerRight:
        post?.mine && !isPlaceholderData
          ? () => (
              <Pressable
                hitSlop={10}
                accessibilityLabel="더보기"
                onPress={() =>
                  Alert.alert('내 글', undefined, [
                    { text: '수정', onPress: () => router.push(`/write?id=${id}`) },
                    {
                      text: '삭제',
                      style: 'destructive',
                      onPress: () =>
                        del.mutate(id, {
                          onSuccess: () => router.back(),
                          onError: (e) => toast(e.message),
                        }),
                    },
                    { text: '취소', style: 'cancel' },
                  ])
                }
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={c.textStrong} />
              </Pressable>
            )
          : undefined,
    });
  }, [navigation, post, isPlaceholderData, id, del, c]);

  if (error instanceof ApiError && error.status === 404) {
    return <Empty>삭제되었거나 없는 글이에요</Empty>;
  }

  const list = comments.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={list}
        keyExtractor={(cm) => String(cm.id)}
        renderItem={({ item }) => <CommentItem comment={item} postId={id} />}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListHeaderComponent={
          <>
            {post ? <Article post={post} placeholder={isPlaceholderData} /> : <Loading />}
            <View style={s.commentsHead}>
              <Text style={s.commentsTitle}>
                댓글 <Text style={{ color: c.primary }}>{post?.commentCount ?? ''}</Text>
              </Text>
              {best.data?.map((cm) => (
                <CommentItem key={`best-${cm.id}`} comment={cm} postId={id} best />
              ))}
            </View>
          </>
        }
        ListEmptyComponent={comments.isPending ? <Loading /> : <Empty>첫 댓글을 남겨 보세요</Empty>}
        ListFooterComponent={comments.isFetchingNextPage ? <Loading /> : <View style={{ height: 24 }} />}
        onEndReached={() => comments.hasNextPage && !comments.isFetchingNextPage && comments.fetchNextPage()}
        onEndReachedThreshold={0.5}
        style={s.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />
      <Composer postId={id} />
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  list: { backgroundColor: c.surface },
  article: { padding: 20, paddingBottom: 28, borderBottomWidth: 12, borderBottomColor: c.bg },
  crumbs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  crumb: { fontSize: 14, fontWeight: '600', color: c.primary },
  crumbSep: { color: c.weak },
  title: { marginTop: 8, marginBottom: 16, fontSize: 24, lineHeight: 32, fontWeight: '700', color: c.textStrong },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: c.line },
  author: { fontSize: 15, fontWeight: '600', color: c.textStrong },
  meta: { fontSize: 13, color: c.weak },
  content: { marginTop: 20, marginBottom: 16, minHeight: 60 },
  likeButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: c.field,
  },
  likeOn: { backgroundColor: c.dangerWeak },
  likeText: { fontSize: 15, fontWeight: '600', color: c.sub },
  commentsHead: { paddingTop: 20 },
  commentsTitle: { paddingHorizontal: 20, paddingBottom: 8, fontSize: 17, fontWeight: '700', color: c.textStrong },
  comment: { paddingHorizontal: 20, paddingVertical: 14 },
  best: { marginHorizontal: 12, marginBottom: 6, borderRadius: 14, backgroundColor: c.primaryWeak, paddingHorizontal: 16 },
  bestBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: c.primary,
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAuthor: { fontSize: 14, fontWeight: '600', color: c.textStrong },
  commentBody: { marginTop: 4, fontSize: 15, lineHeight: 22, color: c.text },
  commentLike: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  sep: { height: 1, backgroundColor: c.line, marginHorizontal: 20 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 21,
    backgroundColor: c.field,
    fontSize: 15,
    color: c.textStrong,
  },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
}));
