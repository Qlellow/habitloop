import { useDeferredValue, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useChannel, useChannels, usePost, useSavePost, type PostDetail } from '@loop/shared';
import { Markdown } from '../src/Markdown';
import { ChannelIcon, Chip, Input, Loading } from '../src/ui';
import { makeStyles, useColors } from '../src/theme';

function ChannelPicker({ value, onChange }: { value?: string; onChange: (slug: string) => void }) {
  const s = useStyles();
  const [open, setOpen] = useState(!value);
  const [input, setInput] = useState('');
  const q = useDeferredValue(input);
  const { data: selected } = useChannel(value);
  const { data: channels } = useChannels(q);

  if (!open && selected) {
    return (
      <Pressable style={s.picked} onPress={() => setOpen(true)}>
        <ChannelIcon slug={selected.slug} name={selected.name} size={30} />
        <Text style={s.pickedName}>{selected.name}</Text>
        <Text style={s.change}>변경</Text>
      </Pressable>
    );
  }
  return (
    <View style={s.picker}>
      <Input placeholder="어느 채널에 올릴까요?" value={input} onChangeText={setInput} />
      {channels?.slice(0, 8).map((c) => (
        <Pressable
          key={c.slug}
          style={({ pressed }) => [s.option, pressed && { opacity: 0.6 }]}
          onPress={() => {
            onChange(c.slug);
            setOpen(false);
          }}
        >
          <ChannelIcon slug={c.slug} name={c.name} size={30} />
          <Text style={s.pickedName}>{c.name}</Text>
          <Text style={s.optionSlug}>c/{c.slug}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function CategoryPicker({ channel, value, onChange }: { channel: string; value: number | null; onChange: (id: number | null) => void }) {
  const { data, isPlaceholderData } = useChannel(channel);
  if (!data || isPlaceholderData) return null;
  // 관리자 전용 카테고리는 채널 관리자에게만 보인다
  const selectable = data.categories.filter((c) => !c.ownerOnly || data.mine);
  if (!selectable.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
      <Chip label="선택 안 함" selected={value == null} onPress={() => onChange(null)} />
      {selectable.map((c) => (
        <Chip key={c.id} label={c.name} selected={value === c.id} onPress={() => onChange(c.id)} />
      ))}
    </ScrollView>
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
  const s = useStyles();
  const c = useColors();
  const navigation = useNavigation();
  const save = useSavePost(initial?.id);
  const [channel, setChannel] = useState(initial?.channel.slug ?? defaultChannel);
  const [categoryId, setCategoryId] = useState<number | null>(initial ? (initial.category?.id ?? null) : (defaultCategory ?? null));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [preview, setPreview] = useState(false);
  const selection = useRef({ start: 0, end: 0 });

  const valid = !!channel && title.trim().length > 0 && content.trim().length > 0;

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
        <Text style={s.headerCancel} onPress={() => router.back()}>
          취소
        </Text>
      ),
      headerRight: () => (
        <Text style={[s.headerSubmit, !valid && { opacity: 0.35 }]} onPress={submit}>
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        {initial ? (
          <View style={s.picked}>
            <ChannelIcon slug={initial.channel.slug} name={initial.channel.name} size={30} />
            <Text style={s.pickedName}>{initial.channel.name}</Text>
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
        <TextInput style={s.title} placeholder="제목" placeholderTextColor={c.weak} value={title} onChangeText={setTitle} maxLength={100} />
        <View style={s.bar}>
          <View style={s.segment}>
            {(['작성', '미리보기'] as const).map((label, i) => (
              <Pressable key={label} onPress={() => setPreview(i === 1)} style={[s.segmentItem, preview === (i === 1) && s.segmentOn]}>
                <Text style={[s.segmentText, preview === (i === 1) && { color: c.textStrong }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {preview ? (
          <View style={s.preview}>{content.trim() ? <Markdown source={content} /> : <Text style={{ color: c.weak }}>미리 볼 내용이 없어요</Text>}</View>
        ) : (
          <TextInput
            style={s.body}
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
        <ScrollView horizontal keyboardShouldPersistTaps="always" style={s.toolbar} contentContainerStyle={s.toolbarInner}>
          {TOOLS.map(([label, wrap]) => (
            <Pressable key={label} onPress={() => apply(wrap)} style={s.tool} hitSlop={4}>
              <Text style={s.toolText}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </KeyboardAvoidingView>
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

const useStyles = makeStyles((c) => ({
  wrap: { padding: 20, paddingBottom: 40 },
  headerCancel: { fontSize: 16, color: c.sub, paddingHorizontal: 4 },
  headerSubmit: { fontSize: 16, fontWeight: '700', color: c.primary, paddingHorizontal: 4 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: c.field, marginBottom: 12 },
  pickedName: { flex: 1, fontSize: 16, fontWeight: '600', color: c.textStrong },
  change: { fontSize: 14, fontWeight: '600', color: c.primary },
  picker: { gap: 4, marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4 },
  optionSlug: { fontSize: 13, color: c.weak },
  title: { fontSize: 22, fontWeight: '700', color: c.textStrong, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line },
  bar: { flexDirection: 'row', marginTop: 14, marginBottom: 10 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 11, backgroundColor: c.field },
  segmentItem: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  segmentOn: { backgroundColor: c.surface },
  segmentText: { fontSize: 14, fontWeight: '600', color: c.sub },
  body: { minHeight: 320, fontSize: 16, lineHeight: 24, color: c.text },
  preview: { minHeight: 320 },
  toolbar: { flexGrow: 0, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
  toolbarInner: { paddingHorizontal: 8, paddingVertical: 6, gap: 2 },
  tool: { minWidth: 42, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  toolText: { fontSize: 16, fontWeight: '700', color: c.sub },
}));
