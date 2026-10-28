import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import { KeyboardArea } from '../../../src/Keyboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { plainText, useRegenerateInvite, useChangeRole, useMemberSearch, useStaff, type StaffMember, useCategoryMutation, useCategoryPostCounts, useChannel, useDeleteChannel, type ChannelDetail, type ChannelCategory } from '@loop/shared';
import { Button, Input, Loading, RoleTag, Sheet } from '../../../src/ui';
import { useColors } from '../../../src/theme';
import { toast } from '../../../src/Toast';

const MAX = 20;

function Row({
  slug,
  category,
  index,
  count,
  onMove,
  others,
  posts,
}: {
  slug: string;
  category: ChannelCategory;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  /** 이 카테고리의 글을 옮길 수 있는 다른 카테고리 */
  others: ChannelCategory[];
  /** 이 카테고리의 글 수 */
  posts: number;
}) {
  const c = useColors();
  const mutation = useCategoryMutation(slug);
  const [moving, setMoving] = useState(false);
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
          // 카테고리가 있는 채널의 글은 카테고리가 꼭 있어야 해서, 글이 있으면 옮길 카테고리를 고른다 (마지막 카테고리면 비워진다)
          posts > 0 && others.length > 0
            ? setMoving(true)
            : Alert.alert(
                `'${category.name}' 카테고리를 삭제할까요?`,
                posts > 0 ? `글 ${posts}개는 지워지지 않고 카테고리 없는 글이 돼요.` : '이 카테고리에는 글이 없어요.',
                [
                  { text: '취소', style: 'cancel' },
                  { text: '삭제', style: 'destructive', onPress: () => mutation.mutate({ type: 'delete', id: category.id }, { onError }) },
                ],
              )
        }
      >
        삭제
      </Text>
      <Sheet
        visible={moving}
        title={`'${category.name}'의 글 ${posts}개를 옮길 카테고리를 골라 주세요 (글은 지워지지 않아요)`}
        options={others.map((o) => ({
          label: `${o.name}(으)로 옮기고 삭제`,
          destructive: true,
          onPress: () =>
            mutation.mutate(
              { type: 'delete', id: category.id, moveTo: o.id },
              { onSuccess: () => toast(`글을 '${o.name}'(으)로 옮기고 '${category.name}'을 지웠어요`), onError },
            ),
        }))}
        onClose={() => setMoving(false)}
      />
    </View>
  );
}

/** 비공개 채널의 초대 코드: 받은 사람만 팔로우할 수 있다 */
function InviteSection({ channel }: { channel: ChannelDetail }) {
  const regen = useRegenerateInvite(channel.slug);
  if (channel.visibility !== 'private' || !channel.inviteCode) return null;
  return (
    <View className="mb-3 p-5 bg-surface gap-3">
      <Text className="text-[17px] font-bold text-fg-strong">초대 코드</Text>
      <Text className="-mt-1.5 text-[13px] text-fg-sub">비공개 채널이라 이 코드를 받은 사람만 팔로우할 수 있어요.</Text>
      <View className="flex-row items-center gap-2">
        <Text selectable className="flex-1 px-4 py-3 rounded-md bg-field text-base font-bold tracking-widest text-fg-strong">
          {channel.inviteCode}
        </Text>
        <Button title="공유" onPress={() => Share.share({ message: `루프의 비공개 채널 '${channel.name}' 초대 코드: ${channel.inviteCode}` })} />
      </View>
      <Button
        title="새 코드 만들기 (이전 코드는 못 써요)"
        variant="ghost"
        size="sm"
        loading={regen.isPending}
        onPress={() => regen.mutate(undefined, { onSuccess: () => toast('새 초대 코드를 만들었어요'), onError: (e) => toast(e.message) })}
      />
    </View>
  );
}

const ROLE_LABEL = { OWNER: '소유자', ADMIN: '관리자', MANAGER: '매니저', MEMBER: '일반 멤버' } as const;

/** 운영진 (소유자만 바꿀 수 있다): 관리자는 채널 관리까지, 매니저는 공지 쓰기 · 신고 처리 */
function StaffSection({ slug, owner }: { slug: string; owner: boolean }) {
  const staff = useStaff(slug);
  const change = useChangeRole(slug);
  const [q, setQ] = useState('');
  const search = useMemberSearch(slug, owner ? q : '');
  const [target, setTarget] = useState<StaffMember>();
  const roles: StaffMember['role'][] = ['ADMIN', 'MANAGER', 'MEMBER'];
  return (
    <View className="mb-3 p-5 bg-surface gap-3">
      <Text className="text-[17px] font-bold text-fg-strong">운영진</Text>
      <Text className="-mt-1.5 text-[13px] leading-[19px] text-fg-sub">관리자는 채널 관리까지, 매니저는 공지 쓰기 · 신고 처리를 할 수 있어요.</Text>
      {staff.data?.map((m) => (
        <View key={m.userId} className="flex-row items-center gap-3">
          <Text className="flex-1 text-[15px] text-fg-strong" numberOfLines={1}>
            {m.nickname}
          </Text>
          <RoleTag role={m.role === 'MEMBER' ? undefined : m.role} />
          {owner && m.role !== 'OWNER' ? <Button title="변경" variant="ghost" size="sm" onPress={() => setTarget(m)} /> : null}
        </View>
      ))}
      {owner ? (
        <>
          <Input value={q} onChangeText={setQ} placeholder="팔로워 닉네임으로 찾아서 운영진 지정" autoCapitalize="none" autoCorrect={false} />
          {q.trim()
            ? search.data
                ?.filter((m) => m.role === 'MEMBER')
                .slice(0, 6)
                .map((m) => (
                  <View key={m.userId} className="flex-row items-center gap-3">
                    <Text className="flex-1 text-[15px] text-fg" numberOfLines={1}>
                      {m.nickname}
                    </Text>
                    <Button title="지정" variant="secondary" size="sm" onPress={() => setTarget(m)} />
                  </View>
                ))
            : null}
        </>
      ) : null}
      <Sheet
        visible={!!target}
        title={target ? `${target.nickname}님의 역할` : undefined}
        options={roles
          .filter((r) => r !== target?.role)
          .map((r) => ({
            label: r === 'MEMBER' ? '운영진에서 빼기' : `${ROLE_LABEL[r]}(으)로 지정`,
            destructive: r === 'MEMBER',
            onPress: () =>
              target &&
              change.mutate(
                { userId: target.userId, role: r },
                { onSuccess: () => (toast(`${target.nickname}님을 ${ROLE_LABEL[r]}(으)로 바꿨어요`), setQ('')), onError: (e) => toast(e.message) },
              ),
          }))}
        onClose={() => setTarget(undefined)}
      />
    </View>
  );
}

/** 위험 구역: 채널 삭제 (소유자만). 채널 이름을 그대로 입력해야 삭제 버튼이 켜진다 */
function DeleteChannel({ channel }: { channel: ChannelDetail }) {
  const remove = useDeleteChannel(channel.slug);
  const [typed, setTyped] = useState('');
  return (
    <View className="mb-3 p-5 bg-surface gap-3">
      <Text className="text-[17px] font-bold text-danger">채널 삭제</Text>
      <Text className="text-[13px] leading-[19px] text-fg-sub">
        삭제하면 되돌릴 수 없어요. 글 {channel.postCount.toLocaleString()}개와 그 댓글 · 공감 · 반응, 팔로워 {channel.memberCount.toLocaleString()}명 · 운영진 · 카테고리 ·
        음성방 · 신고함이 모두 함께 지워져요.
      </Text>
      <Text className="text-[13px] text-fg-sub">
        확인을 위해 채널 이름 <Text className="font-bold text-fg-strong">{channel.name}</Text> 을(를) 입력해 주세요
      </Text>
      <Input value={typed} onChangeText={setTyped} placeholder={channel.name} autoCorrect={false} autoCapitalize="none" />
      <Button
        title="채널 삭제"
        variant="danger"
        disabled={typed !== channel.name}
        loading={remove.isPending}
        onPress={() =>
          remove.mutate(typed, {
            onSuccess: () => {
              toast(`'${channel.name}' 채널을 삭제했어요`);
              router.dismissTo('/channels');
            },
            onError: (e) => Alert.alert(e.message),
          })
        }
      />
    </View>
  );
}

export default function ManageScreen() {
  const c = useColors();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: channel, isPlaceholderData, isPending } = useChannel(slug);
  const mutation = useCategoryMutation(slug);
  const postCounts = useCategoryPostCounts(slug, !!channel?.canManage);
  const [name, setName] = useState('');
  const [ownerOnly, setOwnerOnly] = useState(false);

  if (isPending || isPlaceholderData || !channel) return <Loading />;
  if (!channel.canManage) return <Redirect href={`/c/${slug}`} />;

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
    <KeyboardArea className="flex-1">
      <ScrollView contentContainerClassName="py-3" keyboardShouldPersistTaps="handled">
        <Pressable
          className="flex-row items-center gap-3 p-5 mb-3 bg-surface active:bg-pressed"
          onPress={() => router.push(`/channel-form?slug=${slug}`)}
        >
          <View className="flex-1">
            <Text className="text-[17px] font-bold text-fg-strong">채널 정보 수정</Text>
            <Text className="mt-1 text-[13px] text-fg-sub" numberOfLines={1}>
              {channel.name} · {plainText(channel.description ?? '') || '소개 없음'}
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
            <Row
              key={cat.id}
              slug={slug}
              category={cat}
              index={i}
              count={categories.length}
              onMove={move}
              others={categories.filter((o) => o.id !== cat.id)}
              posts={postCounts.data?.[cat.id] ?? 0}
            />
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
        <InviteSection channel={channel} />
        <StaffSection slug={slug} owner={channel.mine} />
        {channel.mine ? <DeleteChannel channel={channel} /> : null}
      </ScrollView>
    </KeyboardArea>
  );
}
