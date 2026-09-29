import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCategoryMutation, useChannel, type ChannelCategory } from '@loop/shared';
import { Button, Input, Loading } from '../../../src/ui';
import { useColors } from '../../../src/theme';

const MAX = 20;

function Row({
  slug,
  category,
  index,
  count,
  onMove,
}: {
  slug: string;
  category: ChannelCategory;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}) {
  const c = useColors();
  const mutation = useCategoryMutation(slug);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [ownerOnly, setOwnerOnly] = useState(category.ownerOnly);
  const onError = (e: Error) => Alert.alert(e.message);

  if (editing) {
    return (
      <View className="flex-row items-center gap-3 px-5 py-3 border-t border-line">
        <View className="flex-1 gap-2.5">
          <Input value={name} onChangeText={setName} maxLength={20} autoFocus />
          <View className="flex-row items-center justify-between">
            <Text className="text-[15px] font-semibold text-fg">관리자만 글쓰기</Text>
            <Switch value={ownerOnly} onValueChange={setOwnerOnly} trackColor={{ true: c.primary }} />
          </View>
          <View className="flex-row gap-2">
            <Button title="취소" variant="ghost" size="sm" className="flex-1" onPress={() => setEditing(false)} />
            <Button
              title="저장"
              size="sm"
              className="flex-1"
              disabled={!name.trim()}
              loading={mutation.isPending}
              onPress={() =>
                mutation.mutate(
                  { type: 'update', id: category.id, name: name.trim(), ownerOnly },
                  { onSuccess: () => setEditing(false), onError },
                )
              }
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-3 px-5 py-3 border-t border-line">
      <View className="gap-0.5">
        <Pressable disabled={index === 0} onPress={() => onMove(index, index - 1)} hitSlop={6} accessibilityLabel={`${category.name} 위로`}>
          <Ionicons name="chevron-up" size={20} color={index === 0 ? c.border : c.sub} />
        </Pressable>
        <Pressable
          disabled={index === count - 1}
          onPress={() => onMove(index, index + 1)}
          hitSlop={6}
          accessibilityLabel={`${category.name} 아래로`}
        >
          <Ionicons name="chevron-down" size={20} color={index === count - 1 ? c.border : c.sub} />
        </Pressable>
      </View>
      <View className="flex-1 flex-row items-center gap-2">
        <Text className="text-base font-semibold text-fg-strong">{category.name}</Text>
        {category.ownerOnly ? (
          <Text className="px-[7px] py-0.5 rounded-[6px] overflow-hidden bg-primary-weak text-primary text-xs font-semibold">
            관리자 전용
          </Text>
        ) : null}
      </View>
      <Text className="text-[15px] text-fg-sub px-1" onPress={() => setEditing(true)}>
        수정
      </Text>
      <Text
        className="text-[15px] text-danger px-1"
        onPress={() =>
          Alert.alert(`'${category.name}' 카테고리를 삭제할까요?`, '이 카테고리의 글은 지워지지 않고 카테고리만 비워져요.', [
            { text: '취소', style: 'cancel' },
            { text: '삭제', style: 'destructive', onPress: () => mutation.mutate({ type: 'delete', id: category.id }, { onError }) },
          ])
        }
      >
        삭제
      </Text>
    </View>
  );
}

export default function ManageScreen() {
  const c = useColors();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: channel, isPlaceholderData, isPending } = useChannel(slug);
  const mutation = useCategoryMutation(slug);
  const [name, setName] = useState('');
  const [ownerOnly, setOwnerOnly] = useState(false);

  if (isPending || isPlaceholderData || !channel) return <Loading />;
  if (!channel.mine) return <Redirect href={`/c/${slug}`} />;

  const categories = channel.categories;
  const move = (from: number, to: number) => {
    const ids = categories.map((x) => x.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    mutation.mutate({ type: 'reorder', ids }, { onError: (e) => Alert.alert(e.message) });
  };
  const add = () =>
    mutation.mutate(
      { type: 'create', name: name.trim(), ownerOnly },
      {
        onSuccess: () => {
          setName('');
          setOwnerOnly(false);
        },
        onError: (e) => Alert.alert(e.message),
      },
    );

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerClassName="py-3" keyboardShouldPersistTaps="handled">
        <Pressable
          className="flex-row items-center gap-3 p-5 mb-3 bg-surface active:bg-pressed"
          onPress={() => router.push(`/channel-form?slug=${slug}`)}
        >
          <View className="flex-1">
            <Text className="text-[17px] font-bold text-fg-strong">채널 정보 수정</Text>
            <Text className="mt-1 text-[13px] text-fg-sub" numberOfLines={1}>
              {channel.name} · {channel.description || '소개 없음'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.weak} />
        </Pressable>
        <View className="mb-3 bg-surface">
          <View className="p-5 pb-2">
            <Text className="text-[17px] font-bold text-fg-strong">
              카테고리{' '}
              <Text className="text-sm font-medium text-fg-weak">
                {categories.length}/{MAX}
              </Text>
            </Text>
            <Text className="mt-1 text-[13px] text-fg-sub">
              공지사항·소설·일러스트처럼 채널 글을 나눠 보세요. 순서대로 채널 탭에 보여요.
            </Text>
          </View>
          {categories.map((cat, i) => (
            <Row key={cat.id} slug={slug} category={cat} index={i} count={categories.length} onMove={move} />
          ))}
          <View className="gap-3 p-5 border-t border-line">
            <Input
              placeholder={categories.length >= MAX ? `카테고리는 ${MAX}개까지 만들 수 있어요` : '새 카테고리 이름'}
              value={name}
              onChangeText={setName}
              maxLength={20}
              editable={categories.length < MAX}
            />
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[15px] font-semibold text-fg">관리자만 글쓰기</Text>
                <Text className="mt-1 text-[13px] text-fg-sub">공지사항처럼 나만 글을 올릴 수 있어요</Text>
              </View>
              <Switch value={ownerOnly} onValueChange={setOwnerOnly} trackColor={{ true: c.primary }} />
            </View>
            <Button title="추가" full disabled={!name.trim() || categories.length >= MAX} loading={mutation.isPending} onPress={add} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
