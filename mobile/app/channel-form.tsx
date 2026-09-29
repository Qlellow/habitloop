import { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useChannel, useSaveChannel, type ChannelDetail } from '@loop/shared';
import { Button, Input, Loading } from '../src/ui';
import { auth as s } from '../src/authStyles';
import { cn } from '../src/cn';

const SLUG = /^[a-z0-9][a-z0-9_-]{1,29}$/;

function Form({ initial }: { initial?: ChannelDetail }) {
  const save = useSaveChannel(initial?.slug);
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const slugOk = !!initial || SLUG.test(slug);
  const valid = slugOk && name.trim().length >= 2;

  return (
    <KeyboardAvoidingView className={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName={s.wrap} keyboardShouldPersistTaps="handled">
        <Text className={s.label}>채널 이름</Text>
        <Input value={name} onChangeText={setName} maxLength={20} placeholder="예) 고양이" autoFocus />
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
        <Text className={s.label}>소개 (선택)</Text>
        <Input
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          multiline
          placeholder="어떤 이야기를 나누는 곳인지 알려 주세요"
          textAlignVertical="top"
          className="min-h-[100px]"
        />
        {save.error ? <Text className={s.error}>{save.error.message}</Text> : null}
        <Button
          title={initial ? '저장하기' : '채널 만들기'}
          size="lg"
          full
          className="mt-7"
          disabled={!valid}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              { slug, name: name.trim(), description: description.trim() },
              {
                onSuccess: (c) => {
                  router.back();
                  if (!initial) router.push(`/c/${c.slug}`);
                },
              },
            )
          }
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
