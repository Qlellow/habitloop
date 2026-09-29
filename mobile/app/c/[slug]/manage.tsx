import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCategoryMutation, useChannel, type ChannelCategory } from '@loop/shared';
import { Button, Input, Loading } from '../../../src/ui';
import { makeStyles, useColors } from '../../../src/theme';

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
  const s = useStyles();
  const c = useColors();
  const mutation = useCategoryMutation(slug);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [ownerOnly, setOwnerOnly] = useState(category.ownerOnly);
  const onError = (e: Error) => Alert.alert(e.message);

  if (editing) {
    return (
      <View style={s.row}>
        <View style={{ flex: 1, gap: 10 }}>
          <Input value={name} onChangeText={setName} maxLength={20} autoFocus />
          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>관리자만 글쓰기</Text>
            <Switch value={ownerOnly} onValueChange={setOwnerOnly} trackColor={{ true: c.primary }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="취소" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => setEditing(false)} />
            <Button
              title="저장"
              size="sm"
              style={{ flex: 1 }}
              disabled={!name.trim()}
              loading={mutation.isPending}
              onPress={() =>
                mutation.mutate({ type: 'update', id: category.id, name: name.trim(), ownerOnly }, { onSuccess: () => setEditing(false), onError })
              }
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.row}>
      <View style={s.order}>
        <Pressable disabled={index === 0} onPress={() => onMove(index, index - 1)} hitSlop={6} accessibilityLabel={`${category.name} 위로`}>
          <Ionicons name="chevron-up" size={20} color={index === 0 ? c.border : c.sub} />
        </Pressable>
        <Pressable disabled={index === count - 1} onPress={() => onMove(index, index + 1)} hitSlop={6} accessibilityLabel={`${category.name} 아래로`}>
          <Ionicons name="chevron-down" size={20} color={index === count - 1 ? c.border : c.sub} />
        </Pressable>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={s.name}>{category.name}</Text>
        {category.ownerOnly ? <Text style={s.badge}>관리자 전용</Text> : null}
      </View>
      <Text style={s.action} onPress={() => setEditing(true)}>
        수정
      </Text>
      <Text
        style={[s.action, { color: c.danger }]}
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
  const s = useStyles();
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ paddingVertical: 12 }} keyboardShouldPersistTaps="handled">
        <Pressable style={s.card} onPress={() => router.push(`/channel-form?slug=${slug}`)}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>채널 정보 수정</Text>
            <Text style={s.cardDesc} numberOfLines={1}>
              {channel.name} · {channel.description || '소개 없음'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.weak} />
        </Pressable>
        <View style={[s.card, { flexDirection: 'column', alignItems: 'stretch', padding: 0 }]}>
          <View style={{ padding: 20, paddingBottom: 8 }}>
            <Text style={s.cardTitle}>
              카테고리 <Text style={s.count}>{categories.length}/{MAX}</Text>
            </Text>
            <Text style={s.cardDesc}>공지사항·소설·일러스트처럼 채널 글을 나눠 보세요. 순서대로 채널 탭에 보여요.</Text>
          </View>
          {categories.map((cat, i) => (
            <Row key={cat.id} slug={slug} category={cat} index={i} count={categories.length} onMove={move} />
          ))}
          <View style={s.addBox}>
            <Input
              placeholder={categories.length >= MAX ? `카테고리는 ${MAX}개까지 만들 수 있어요` : '새 카테고리 이름'}
              value={name}
              onChangeText={setName}
              maxLength={20}
              editable={categories.length < MAX}
            />
            <View style={s.toggleRow}>
              <View>
                <Text style={s.toggleLabel}>관리자만 글쓰기</Text>
                <Text style={s.cardDesc}>공지사항처럼 나만 글을 올릴 수 있어요</Text>
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

const useStyles = makeStyles((c) => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, marginBottom: 12, backgroundColor: c.surface },
  cardTitle: { fontSize: 17, fontWeight: '700', color: c.textStrong },
  cardDesc: { marginTop: 4, fontSize: 13, color: c.sub },
  count: { fontSize: 14, fontWeight: '500', color: c.weak },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line },
  order: { gap: 2 },
  name: { fontSize: 16, fontWeight: '600', color: c.textStrong },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', backgroundColor: c.primaryWeak, color: c.primary, fontSize: 12, fontWeight: '600' },
  action: { fontSize: 15, color: c.sub, paddingHorizontal: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: c.text },
  addBox: { gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: c.line },
}));
