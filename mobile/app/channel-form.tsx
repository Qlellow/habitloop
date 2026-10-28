import { useLayoutEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { KeyboardArea } from '../src/Keyboard';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { CHANNEL_COLORS, uploadChannelIcon, useChannel, useSaveChannel, type ChannelDetail } from '@loop/shared';
import { Button, ChannelIcon, Input, Loading } from '../src/ui';
import { useColors } from '../src/theme';
import { toast } from '../src/Toast';
import { pickImage } from '../src/pickImage';
import { auth as s } from '../src/authStyles';
import { cn } from '../src/cn';

const SLUG = /^[a-z0-9][a-z0-9_-]{1,29}$/;

/** 채널 아이콘: 올린 이미지 미리보기 (아직 안 올린 새 채널은 고른 이미지를 기억해 두었다가 만든 뒤에 올린다) */
function IconPicker({ slug, name, color, iconVersion, picked, onPick }: { slug: string; name: string; color: number | null; iconVersion: number; picked?: string; onPick: (image: { blob: Blob; uri: string } | null) => void }) {
  return (
    <View className="flex-row items-center gap-3.5">
      {picked ? (
        <Image source={{ uri: picked }} style={{ width: 64, height: 64, borderRadius: 19 }} />
      ) : (
        <ChannelIcon slug={slug || 'new'} name={name || '채'} color={color} iconVersion={iconVersion} size={64} />
      )}
      <View className="flex-row gap-2">
        <Button
          title="이미지 고르기"
          variant="secondary"
          size="sm"
          onPress={() => pickImage({ square: true, maxSide: 512 }).then((b) => b && onPick(b), (e: Error) => toast(e.message))}
        />
        {picked || iconVersion > 0 ? <Button title="지우기" variant="ghost" size="sm" onPress={() => onPick(null)} /> : null}
      </View>
    </View>
  );
}

function Form({ initial }: { initial?: ChannelDetail }) {
  const save = useSaveChannel(initial?.slug);
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState<number | null>(initial?.color ?? null);
  const [isPrivate, setPrivate] = useState(initial?.visibility === 'private');
  const [adult, setAdult] = useState(!!initial?.adult);
  // 고른 아이콘: undefined 는 그대로, null 은 지우기
  const [icon, setIcon] = useState<Blob | null>();
  const [iconPreview, setIconPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const c = useColors();
  const slugOk = !!initial || SLUG.test(slug);
  const valid = slugOk && name.trim().length >= 2;

  const pick = (image: { blob: Blob; uri: string } | null) => {
    setIcon(image?.blob ?? null);
    setIconPreview(image?.uri);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const saved = await save.mutateAsync({
        slug,
        name: name.trim(),
        description: description.trim(),
        color: color ?? undefined,
        visibility: isPrivate ? 'private' : 'public',
        adult,
      });
      const target = initial?.slug ?? saved.slug;
      // 아이콘은 채널이 생긴 뒤에 올린다
      if (icon !== undefined) await uploadChannelIcon(target, icon);
      router.back();
      if (!initial) router.push(`/c/${saved.slug}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardArea className={s.flex}>
      <ScrollView contentContainerClassName={s.wrap} keyboardShouldPersistTaps="handled">
        <Text className={cn(s.label, 'mt-0')}>아이콘</Text>
        <IconPicker
          slug={slug}
          name={name}
          color={color}
          iconVersion={icon === null ? 0 : (initial?.iconVersion ?? 0)}
          picked={iconPreview}
          onPick={pick}
        />
        {!iconPreview && !(icon === undefined && initial?.iconVersion) ? (
          <View className="flex-row flex-wrap gap-2.5 mt-3" accessibilityRole="radiogroup" accessibilityLabel="채널 색">
            {CHANNEL_COLORS.map((hex, i) => (
              <Pressable
                key={hex}
                accessibilityRole="radio"
                accessibilityState={{ checked: color === i }}
                accessibilityLabel={`색 ${i + 1}`}
                onPress={() => setColor(i)}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: hex, borderWidth: color === i ? 3 : 0, borderColor: c.textStrong }}
              />
            ))}
          </View>
        ) : null}
        <Text className={s.label}>채널 이름</Text>
        <Input value={name} onChangeText={setName} maxLength={20} placeholder="예) 고양이" />
        <Text className={s.label}>채널 주소{initial ? ' (바꿀 수 없어요)' : ''}</Text>
        <Input
          value={slug}
          onChangeText={(v) => setSlug(v.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
          maxLength={30}
          placeholder="예) cats"
          editable={!initial}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!initial ? (
          <Text className={cn(s.switch, 'text-left mt-2 text-[13px]')}>
            {slug ? `c/${slug}${slugOk ? '' : ' · 2자 이상, 영문이나 숫자로 시작'}` : '영문 소문자·숫자·-·_ 로 2~30자'}
          </Text>
        ) : null}
        <Text className={s.label}>소개 (선택 · 마크다운)</Text>
        <Input
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
          multiline
          placeholder={'어떤 이야기를 나누는 곳인지 알려 주세요\n## 제목, - 목록, **굵게** 를 쓸 수 있어요'}
          textAlignVertical="top"
          className="min-h-[120px]"
        />
        <Text className="mt-1 text-right text-xs text-fg-weak">{description.length}/2000</Text>
        <View className="flex-row items-center gap-3 mt-4">
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-fg-strong">비공개 채널</Text>
            <Text className="mt-0.5 text-[13px] text-fg-sub">초대 코드를 받은 사람만 팔로우하고 볼 수 있어요</Text>
          </View>
          <Switch value={isPrivate} onValueChange={setPrivate} trackColor={{ true: c.primary, false: c.border }} accessibilityLabel="비공개 채널" />
        </View>
        <View className="flex-row items-center gap-3 mt-4">
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-fg-strong">만 19세 이상</Text>
            <Text className="mt-0.5 text-[13px] text-fg-sub">나이를 확인한 성인만 볼 수 있어요</Text>
          </View>
          <Switch value={adult} onValueChange={setAdult} trackColor={{ true: c.primary, false: c.border }} accessibilityLabel="만 19세 이상" />
        </View>
        <Button title={initial ? '저장하기' : '채널 만들기'} size="lg" full className="mt-7" disabled={!valid} loading={busy} onPress={submit} />
      </ScrollView>
    </KeyboardArea>
  );
}

export default function ChannelFormScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const navigation = useNavigation();
  const { data, isPlaceholderData } = useChannel(slug);
  useLayoutEffect(() => {
    if (slug) navigation.setOptions({ title: '채널 정보 수정' });
  }, [navigation, slug]);
  if (!slug) return <Form />;
  if (!data || isPlaceholderData) return <Loading />;
  return <Form initial={data} />;
}
