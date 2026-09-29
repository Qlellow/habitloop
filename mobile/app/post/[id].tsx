import { useLayoutEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
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
import { cn } from '../../src/cn';
import { useColors } from '../../src/theme';

function toast(message: string) {
  Alert.alert(message);
}

function Article({ post, placeholder }: { post: PostDetail; placeholder: boolean }) {
  const c = useColors();
  const { isLoggedIn } = useAuth();
  const like = useToggleLike(post.id);
  return (
    <View className="p-5 pb-7 border-b-[12px] border-bg">
      <View className="flex-row items-center gap-1.5">
        <Text className="text-sm font-semibold text-primary" onPress={() => router.push(`/c/${post.channel.slug}`)}>
          {post.channel.name}
        </Text>
        {post.category ? (
          <>
            <Text className="text-fg-weak">›</Text>
            <Text
              className="text-sm font-semibold text-primary"
              onPress={() => router.push(`/c/${post.channel.slug}?category=${post.category!.id}`)}
            >
              {post.category.name}
            </Text>
          </>
        ) : null}
      </View>
      <Text className="mt-2 mb-4 text-2xl leading-8 font-bold text-fg-strong">{post.title}</Text>
      <View className="flex-row items-center gap-2.5 pb-[18px] border-b border-line">
        <Avatar name={post.author.nickname} />
        <View>
          <Text className="text-[15px] font-semibold text-fg-strong">{post.author.nickname}</Text>
          <Text className="text-[13px] text-fg-weak">
            {timeAgo(post.createdAt)} · 조회 {compact(post.viewCount)}
          </Text>
        </View>
      </View>
      <View className="mt-5 mb-4 min-h-[60px]">
        {placeholder ? (
          <>
            <Skeleton width="100%" height={18} />
            <Skeleton width="88%" height={18} className="mt-2.5" />
            <Skeleton width="60%" height={18} className="mt-2.5" />
          </>
        ) : (
          <Markdown source={post.content} />
        )}
      </View>
      {!placeholder && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: post.liked }}
          onPress={() => (isLoggedIn ? like.mutate(!post.liked, { onError: (e) => toast(e.message) }) : router.push('/login'))}
          className={cn(
            'self-center flex-row items-center gap-1.5 h-11 px-5 rounded-full active:scale-95',
            post.liked ? 'bg-danger-weak' : 'bg-field',
          )}
        >
          <Heart filled={post.liked} size={20} color={post.liked ? c.danger : c.sub} />
          <Text className={cn('text-[15px] font-semibold', post.liked ? 'text-danger' : 'text-fg-sub')}>
            좋아요 {compact(post.likeCount)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function CommentItem({ comment: cm, postId, best }: { comment: Comment; postId: number; best?: boolean }) {
  const c = useColors();
  const { isLoggedIn } = useAuth();
  const like = useToggleCommentLike(postId);
  const remove = useDeleteComment(postId);
  return (
    <View className={cn('px-5 py-3.5', best && 'mx-3 mb-1.5 rounded-md bg-primary-weak px-4')}>
      <View className="flex-row items-center gap-2">
        {best ? (
          <Text className="px-1.5 py-px rounded-[6px] overflow-hidden bg-primary text-white text-[11px] font-extrabold">BEST</Text>
        ) : null}
        <Text className="text-sm font-semibold text-fg-strong">{cm.authorNickname}</Text>
        <Text className="text-[13px] text-fg-weak">{timeAgo(cm.createdAt)}</Text>
        {cm.mine && !best ? (
          <Text
            className="text-[13px] text-fg-weak ml-auto"
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
      <Text className="mt-1 text-[15px] leading-[22px] text-fg">{cm.content}</Text>
      <Pressable
        hitSlop={8}
        className="flex-row items-center gap-1 mt-2 self-start"
        onPress={() =>
          isLoggedIn ? like.mutate({ commentId: cm.id, like: !cm.liked }, { onError: (e) => toast(e.message) }) : router.push('/login')
        }
      >
        <Heart filled={cm.liked} size={15} color={cm.liked ? c.danger : c.weak} />
        <Text className={cn('text-[13px] text-fg-weak', cm.liked && 'text-danger')}>
          {cm.likeCount > 0 ? compact(cm.likeCount) : '좋아요'}
        </Text>
      </Pressable>
    </View>
  );
}

function Composer({ postId }: { postId: number }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuth();
  const add = useAddComment(postId);
  const [text, setText] = useState('');

  if (!isLoggedIn) {
    return (
      <View
        className="flex-row items-end gap-2 px-3 pt-2.5 bg-surface border-t border-border"
        style={{ paddingBottom: 10 + insets.bottom }}
      >
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
    <View className="flex-row items-end gap-2 px-3 pt-2.5 bg-surface border-t border-border" style={{ paddingBottom: 10 + insets.bottom }}>
      <TextInput
        className="flex-1 min-h-[42px] max-h-[120px] px-4 py-[11px] rounded-[21px] bg-field text-[15px] text-fg-strong"
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
        className={cn(
          'w-[42px] h-[42px] rounded-full bg-primary items-center justify-center',
          (!text.trim() || add.isPending) && 'opacity-40',
        )}
        accessibilityLabel="댓글 등록"
      >
        <Ionicons name="arrow-up" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

export default function PostScreen() {
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
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={list}
        keyExtractor={(cm) => String(cm.id)}
        renderItem={({ item }) => <CommentItem comment={item} postId={id} />}
        ItemSeparatorComponent={() => <View className="h-px bg-line mx-5" />}
        ListHeaderComponent={
          <>
            {post ? <Article post={post} placeholder={isPlaceholderData} /> : <Loading />}
            <View className="pt-5">
              <Text className="px-5 pb-2 text-[17px] font-bold text-fg-strong">
                댓글 <Text className="text-primary">{post?.commentCount ?? ''}</Text>
              </Text>
              {best.data?.map((cm) => (
                <CommentItem key={`best-${cm.id}`} comment={cm} postId={id} best />
              ))}
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
      <Composer postId={id} />
    </KeyboardAvoidingView>
  );
}
