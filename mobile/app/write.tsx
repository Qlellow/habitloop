import { useDeferredValue, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { KeyboardArea, useKeyboardVisible } from '../src/Keyboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { uploadPostImage, useChannel, useMyChannels, usePost, useSavePost, type PostDetail } from '@loop/shared';
import { Markdown } from '../src/Markdown';
import { pickImage } from '../src/pickImage';
import { ChannelIcon, Chip, Input, Loading } from '../src/ui';
import { cn } from '../src/cn';
import { useColors } from '../src/theme';

/** 올릴 채널: 글은 팔로우한 채널에만 쓸 수 있어서 내 채널(팔로우 · 북마크 순)에서 고른다 */
function ChannelPicker({ value, onChange }: { value?: string; onChange: (slug: string) => void }) {
  const [open, setOpen] = useState(!value);
  const [input, setInput] = useState('');
  const q = useDeferredValue(input.trim().toLowerCase());
  const { data: selected } = useChannel(value);
  const { data: mine, isPending } = useMyChannels(true);
  const list = (mine ?? []).filter((c) => !q || c.name.toLowerCase().includes(q) || c.slug.includes(q));

  if (!open && selected) {
    return (
      <Pressable className="flex-row items-center gap-2.5 p-3 rounded-md bg-field mb-3 active:opacity-70" onPress={() => setOpen(true)}>
        <ChannelIcon slug={selected.slug} name={selected.name} color={selected.color} iconVersion={selected.iconVersion} size={30} />
        <Text className="flex-1 text-base font-semibold text-fg-strong">{selected.name}</Text>
        <Text className="text-sm font-semibold text-primary">변경</Text>
      </Pressable>
    );
  }
  return (
    <View className="gap-1 mb-3">
      <Input placeholder="어느 채널에 올릴까요?" value={input} onChangeText={setInput} />
      {isPending ? <Loading /> : null}
      {!isPending && !mine?.length ? (
        <Text className="py-3 text-sm text-fg-sub">팔로우한 채널이 없어요. 채널을 팔로우하면 그 채널에 글을 쓸 수 있어요.</Text>
      ) : null}
      {list.slice(0, 12).map((c) => (
        <Pressable
          key={c.slug}
          className="flex-row items-center gap-2.5 py-2.5 px-1 active:opacity-60"
          onPress={() => {
            onChange(c.slug);
            setOpen(false);
          }}
        >
          <ChannelIcon slug={c.slug} name={c.name} color={c.color} iconVersion={c.iconVersion} size={30} />
          <Text className="flex-1 text-base font-semibold text-fg-strong">{c.name}</Text>
          <Text className="text-[13px] text-fg-weak">c/{c.slug}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** 카테고리: 카테고리가 있는 채널은 꼭 골라야 한다 (서버도 막는다). 운영진 전용 카테고리는 운영진에게만 */
function CategoryPicker({ channel, value, onChange }: { channel: string; value: number | null; onChange: (id: number | null) => void }) {
  const { data, isPlaceholderData } = useChannel(channel);
  if (!data || isPlaceholderData) return null;
  const selectable = data.categories.filter((c) => !c.ownerOnly || data.staff);
  if (!selectable.length) return null;
  return (
    <View className="pb-3">
      <Text className={cn('mb-2 text-[13px] font-semibold', value == null ? 'text-primary' : 'text-fg-weak')}>카테고리를 골라 주세요</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {selectable.map((c) => (
          <Chip key={c.id} label={c.ownerOnly ? `📌 ${c.name}` : c.name} selected={value === c.id} onPress={() => onChange(c.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

type Wrap = (sel: string) => [string, string, string];
const TOOLS: [string, Wrap][] = [
  ['B', (t) => ['**', t || '굵은 글씨', '**']],
  ['I', (t) => ['*', t || '기울인 글씨', '*']],
  ['H', (t) => ['\n## ', t || '제목', '\n']],
  ['•', (t) => ['\n- ', t || '항목', '\n']],
  ['“', (t) => ['\n> ', t || '인용문', '\n']],
  ['</>', (t) => ['`', t || 'code', '`']],
  ['🔗', (t) => ['[', t || '링크 텍스트', '](https://)']],
];

function Form({ initial, defaultChannel, defaultCategory }: { initial?: PostDetail; defaultChannel?: string; defaultCategory?: number }) {
  const c = useColors();
  const navigation = useNavigation();
  const save = useSavePost(initial?.id);
  const [channel, setChannel] = useState(initial?.channel.slug ?? defaultChannel);
  const [categoryId, setCategoryId] = useState<number | null>(initial ? (initial.category?.id ?? null) : (defaultCategory ?? null));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [preview, setPreview] = useState(false);
  const selection = useRef({ start: 0, end: 0 });
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  const { data: channelData } = useChannel(channel);
  const needsCategory = !!channelData?.categories.length;
  const valid = !!channel && title.trim().length > 0 && content.trim().length > 0 && (!needsCategory || categoryId != null);
  const [uploading, setUploading] = useState(false);

  const submit = () => {
    if (!valid || save.isPending) return;
    save.mutate(
      { channel, categoryId, title: title.trim(), content },
      {
        onSuccess: (post) => {
          router.back();
          if (!initial) router.push(`/post/${post.id}`);
        },
        onError: (e) => Alert.alert(e.message),
      },
    );
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: initial ? '글 수정' : '글쓰기',
      headerLeft: () => (
        <Text className="text-base text-fg-sub px-1" onPress={() => router.back()}>
          취소
        </Text>
      ),
      headerRight: () => (
        <Text className={cn('text-base font-bold text-primary px-1', !valid && 'opacity-35')} onPress={submit}>
          {save.isPending ? '저장 중' : initial ? '저장' : '올리기'}
        </Text>
      ),
    });
  });

  const apply = (wrap: Wrap) => {
    const { start, end } = selection.current;
    const [before, text, after] = wrap(content.slice(start, end));
    setContent(content.slice(0, start) + before + text + after + content.slice(end));
    const cursor = start + before.length + text.length + after.length;
    selection.current = { start: cursor, end: cursor };
  };

  /** 사진 넣기: 서버에 올리고 커서 자리에 ![](주소) 를 넣는다 */
  const addImage = async () => {
    if (uploading) return;
    try {
      const picked = await pickImage();
      if (!picked) return;
      setUploading(true);
      const { url } = await uploadPostImage(picked.blob);
      apply(() => ['\n![](', url, ')\n']);
    } catch (e) {
      Alert.alert((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardArea className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="p-5 pb-10" keyboardShouldPersistTaps="handled">
        {initial ? (
          <View className="flex-row items-center gap-2.5 p-3 rounded-md bg-field mb-3">
            <ChannelIcon slug={initial.channel.slug} name={initial.channel.name} color={initial.channel.color} iconVersion={initial.channel.iconVersion} size={30} />
            <Text className="flex-1 text-base font-semibold text-fg-strong">{initial.channel.name}</Text>
          </View>
        ) : (
          <ChannelPicker
            value={channel}
            onChange={(slug) => {
              setChannel(slug);
              setCategoryId(null);
            }}
          />
        )}
        {channel ? <CategoryPicker channel={channel} value={categoryId} onChange={setCategoryId} /> : null}
        <TextInput
          className="text-[22px] font-bold text-fg-strong py-3 border-b border-line"
          placeholder="제목"
          placeholderTextColor={c.weak}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />
        <View className="flex-row mt-3.5 mb-2.5">
          <View className="flex-row p-[3px] rounded-[11px] bg-field">
            {(['작성', '미리보기'] as const).map((label, i) => (
              <Pressable
                key={label}
                onPress={() => setPreview(i === 1)}
                className={cn('px-3.5 py-1.5 rounded-[8px]', preview === (i === 1) && 'bg-surface')}
              >
                <Text className={cn('text-sm font-semibold text-fg-sub', preview === (i === 1) && 'text-fg-strong')}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {preview ? (
          <View className="min-h-[320px]">
            {content.trim() ? <Markdown source={content} /> : <Text className="text-fg-weak">미리 볼 내용이 없어요</Text>}
          </View>
        ) : (
          <TextInput
            className="min-h-[320px] text-base leading-6 text-fg"
            placeholder={'내용을 입력해 주세요\n마크다운 문법(**굵게**, # 제목, - 목록)을 쓸 수 있어요'}
            placeholderTextColor={c.weak}
            value={content}
            onChangeText={setContent}
            onSelectionChange={(e) => (selection.current = e.nativeEvent.selection)}
            multiline
            maxLength={20000}
            textAlignVertical="top"
            scrollEnabled={false}
          />
        )}
      </ScrollView>
      {!preview ? (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          className="grow-0 border-t border-border bg-surface"
          contentContainerClassName="px-2 py-1.5 gap-0.5"
          // 키보드가 없을 때는 안드로이드 내비게이션 바에 가리지 않게
          style={{ paddingBottom: keyboardVisible ? 0 : insets.bottom }}
        >
          <Pressable
            onPress={addImage}
            disabled={uploading}
            accessibilityLabel="사진 넣기"
            className="min-w-[42px] h-[38px] items-center justify-center rounded-[8px] active:bg-field"
            hitSlop={4}
          >
            {uploading ? <ActivityIndicator color={c.primary} /> : <Ionicons name="image-outline" size={20} color={c.sub} />}
          </Pressable>
          {TOOLS.map(([label, wrap]) => (
            <Pressable
              key={label}
              onPress={() => apply(wrap)}
              className="min-w-[42px] h-[38px] items-center justify-center rounded-[8px] active:bg-field"
              hitSlop={4}
            >
              <Text className="text-base font-bold text-fg-sub">{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </KeyboardArea>
  );
}

export default function WriteScreen() {
  const params = useLocalSearchParams<{ id?: string; channel?: string; category?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const { data, isPending } = usePost(editId ?? 0);
  if (editId) {
    if (isPending || !data?.content) return <Loading />;
    return <Form initial={data} />;
  }
  return <Form defaultChannel={params.channel} defaultCategory={Number(params.category) || undefined} />;
}
