import { useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  CODE_LENGTH,
  cleanCode,
  passwordProblem,
  timeAgo,
  useAuth,
  useBlockUser,
  useChangePassword,
  useLoginSessions,
  useMyBlocks,
  useRevokeSession,
  useTwoFactor,
  useUpdateProfile,
  useWithdraw,
} from '@loop/shared';
import { Avatar, Button, Chip, Empty, Input, Loading } from '../src/ui';
import { setThemePref, useThemePref, type ThemePref } from '../src/theme';
import { toast } from '../src/Toast';

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <View className="bg-surface mb-3 p-5">
      <Text className="text-[17px] font-bold text-fg-strong">{title}</Text>
      {desc ? <Text className="mt-1 text-[13px] leading-[19px] text-fg-sub">{desc}</Text> : null}
      <View className="mt-3.5 gap-2.5">{children}</View>
    </View>
  );
}

const THEMES: [ThemePref, string][] = [
  ['system', '기기 설정'],
  ['light', '밝게'],
  ['dark', '어둡게'],
];

function ThemeSection() {
  const pref = useThemePref();
  return (
    <Section title="화면" desc="기기 설정을 따르거나 밝게 · 어둡게 고정할 수 있어요. (이 기기에만 저장)">
      <View className="flex-row gap-2" accessibilityRole="radiogroup">
        {THEMES.map(([v, label]) => (
          <Chip key={v} label={label} selected={pref === v} onPress={() => setThemePref(v)} />
        ))}
      </View>
    </Section>
  );
}

function NicknameSection() {
  const { user } = useAuth();
  const update = useUpdateProfile();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const next = nickname.trim();
  return (
    <Section title="닉네임" desc="글과 댓글에 보이는 이름이에요. 바꾸면 이전 글에도 새 닉네임이 보여요.">
      <Input value={nickname} onChangeText={setNickname} maxLength={20} placeholder="2~20자" />
      <Button
        title="저장"
        variant="secondary"
        disabled={next.length < 2 || next === user?.nickname}
        loading={update.isPending}
        onPress={() => update.mutate({ nickname: next }, { onSuccess: () => toast('닉네임을 바꿨어요'), onError: (e) => toast(e.message) })}
      />
    </Section>
  );
}

function PasswordSection() {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const problem = next ? passwordProblem(next) : undefined;
  return (
    <Section title="비밀번호" desc="지금 비밀번호를 확인한 뒤에 바꿀 수 있어요. 바꾸면 다른 기기는 모두 로그아웃돼요.">
      <Input value={current} onChangeText={setCurrent} secureTextEntry placeholder="지금 비밀번호" textContentType="password" />
      <Input value={next} onChangeText={setNext} secureTextEntry placeholder="새 비밀번호 (8자 이상, 숫자·특수문자 포함)" textContentType="newPassword" />
      {problem ? <Text className="text-[13px] text-danger">{problem}</Text> : null}
      <Button
        title="비밀번호 바꾸기"
        variant="secondary"
        disabled={!current || !next || !!problem}
        loading={change.isPending}
        onPress={() =>
          change.mutate(
            { currentPassword: current, newPassword: next },
            {
              onSuccess: () => {
                setCurrent('');
                setNext('');
                toast('비밀번호를 바꿨어요');
              },
              onError: (e) => toast(e.message),
            },
          )
        }
      />
    </Section>
  );
}

/** 2단계 인증: 켜기는 메일로 받은 번호 확인, 끄기는 비밀번호 확인 */
function TwoFactorSection() {
  const { user } = useAuth();
  const { sendCode, enable, disable } = useTwoFactor();
  const [step, setStep] = useState<'idle' | 'code' | 'password'>('idle');
  const [value, setValue] = useState('');
  const on = !!user?.twoFactorEnabled;
  const reset = () => {
    setStep('idle');
    setValue('');
  };
  return (
    <Section
      title={`2단계 인증${on ? ' · 사용 중' : ''}`}
      desc="로그인할 때 비밀번호와 함께 가입한 이메일로 받은 인증번호를 입력해요. 비밀번호가 새어 나가도 계정을 지킬 수 있어요."
    >
      {step === 'idle' ? (
        on ? (
          <Button title="끄기" variant="ghost" onPress={() => setStep('password')} />
        ) : (
          <Button
            title="켜기"
            variant="secondary"
            loading={sendCode.isPending}
            onPress={() => sendCode.mutate(undefined, { onSuccess: () => (setStep('code'), toast('이메일로 인증번호를 보냈어요')), onError: (e) => toast(e.message) })}
          />
        )
      ) : step === 'code' ? (
        <>
          <Text className="text-[13px] text-fg-sub">메일로 받은 인증번호 {CODE_LENGTH}자리를 입력하면 2단계 인증이 켜져요.</Text>
          <Input value={value} onChangeText={(t) => setValue(cleanCode(t))} autoCapitalize="characters" autoCorrect={false} placeholder={`${CODE_LENGTH}자리 (영문·숫자)`} />
          <View className="flex-row gap-2">
            <Button title="취소" variant="ghost" className="flex-1" onPress={reset} />
            <Button
              title="확인"
              className="flex-1"
              disabled={value.length !== CODE_LENGTH}
              loading={enable.isPending}
              onPress={() => enable.mutate(value, { onSuccess: () => (reset(), toast('2단계 인증을 켰어요')), onError: (e) => toast(e.message) })}
            />
          </View>
        </>
      ) : (
        <>
          <Text className="text-[13px] text-fg-sub">본인 확인을 위해 비밀번호를 입력해 주세요.</Text>
          <Input value={value} onChangeText={setValue} secureTextEntry placeholder="비밀번호" />
          <View className="flex-row gap-2">
            <Button title="취소" variant="ghost" className="flex-1" onPress={reset} />
            <Button
              title="끄기"
              variant="danger"
              className="flex-1"
              disabled={!value}
              loading={disable.isPending}
              onPress={() => disable.mutate(value, { onSuccess: () => (reset(), toast('2단계 인증을 껐어요')), onError: (e) => toast(e.message) })}
            />
          </View>
        </>
      )}
    </Section>
  );
}

function SessionsSection() {
  const { data } = useLoginSessions();
  const revoke = useRevokeSession();
  const run = (id?: string) => revoke.mutate(id, { onSuccess: () => toast(id ? '그 기기에서 로그아웃했어요' : '다른 기기에서 모두 로그아웃했어요'), onError: (e) => toast(e.message) });
  return (
    <Section title="로그인한 기기" desc="모르는 기기가 있으면 로그아웃하고 비밀번호를 바꿔 주세요. 로그아웃한 기기는 다시 로그인해야 해요.">
      {!data ? (
        <Loading />
      ) : (
        data.map((d) => (
          <View key={d.id} className="flex-row items-center gap-3 px-3.5 py-3 rounded-md bg-field">
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-fg-strong">
                {d.device}
                {d.current ? <Text className="text-primary"> · 이 기기</Text> : null}
              </Text>
              <Text className="mt-0.5 text-xs text-fg-weak">마지막 사용 {timeAgo(d.lastUsedAt)}</Text>
            </View>
            {!d.current ? <Button title="로그아웃" variant="ghost" size="sm" onPress={() => run(d.id)} /> : null}
          </View>
        ))
      )}
      {data && data.length > 1 ? <Button title="다른 기기 모두 로그아웃" variant="ghost" onPress={() => run()} /> : null}
    </Section>
  );
}

function BlocksSection() {
  const { data } = useMyBlocks();
  const block = useBlockUser();
  return (
    <Section title="차단한 사용자" desc="차단한 사람의 글은 목록에서 빠지고, 댓글은 가려지고, 그 사람 때문에 오는 알림도 받지 않아요. 프로필에서 차단할 수 있어요.">
      {!data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Text className="text-sm text-fg-weak">차단한 사용자가 없어요</Text>
      ) : (
        data.map((u) => (
          <View key={u.id} className="flex-row items-center gap-3">
            <Avatar name={u.nickname} uri={u.avatarUrl} size={32} />
            <Text className="flex-1 text-[15px] text-fg-strong" numberOfLines={1}>
              {u.nickname}
            </Text>
            <Button
              title="차단 해제"
              variant="ghost"
              size="sm"
              onPress={() => block.mutate({ userId: u.id, block: false }, { onSuccess: () => toast(`${u.nickname}님 차단을 풀었어요`), onError: (e) => toast(e.message) })}
            />
          </View>
        ))
      )}
    </Section>
  );
}

const WITHDRAW_NOTES = [
  "작성한 글과 댓글은 지워지지 않고, 작성자는 '탈퇴한 사용자'로 보여요. 지우고 싶은 글은 탈퇴 전에 직접 지워 주세요.",
  '이메일 · 프로필 사진 · 배너 · 생년월일 · 소셜 로그인 연동 · 포인트 · 배지 · 팔로우한 채널은 모두 지워지고 되돌릴 수 없어요.',
  '내가 만든 채널은 관리자 → 매니저 → 팔로워 순으로 다음 사람에게 넘어가요.',
  '같은 이메일로 다시 가입할 수 있지만, 지금 계정은 되살릴 수 없어요.',
];

/** 회원 탈퇴: 안내 확인 → 가입한 이메일로 받은 인증번호 → 탈퇴 */
function WithdrawSection() {
  const { sendCode, withdraw, finish } = useWithdraw();
  const [sentTo, setSentTo] = useState<string>();
  const [code, setCode] = useState('');
  const start = () =>
    Alert.alert('정말 탈퇴할까요?', WITHDRAW_NOTES.map((n) => `• ${n}`).join('\n\n'), [
      { text: '취소', style: 'cancel' },
      {
        text: '인증번호 받기',
        style: 'destructive',
        onPress: () => sendCode.mutate(undefined, { onSuccess: (r) => setSentTo(r.maskedEmail ?? '가입한 이메일'), onError: (e) => toast(e.message) }),
      },
    ]);
  return (
    <Section title="회원 탈퇴" desc="탈퇴하면 계정을 되살릴 수 없어요.">
      {sentTo ? (
        <>
          <Text className="text-[13px] text-fg-sub">
            {sentTo}(으)로 보낸 인증번호 {CODE_LENGTH}자리를 입력해 주세요.
          </Text>
          <Input value={code} onChangeText={(t) => setCode(cleanCode(t))} autoCapitalize="characters" autoCorrect={false} placeholder={`${CODE_LENGTH}자리 (영문·숫자)`} />
          <Button
            title="탈퇴하기"
            variant="danger"
            disabled={code.length !== CODE_LENGTH}
            loading={withdraw.isPending}
            onPress={() =>
              withdraw.mutate(code, {
                onSuccess: () => {
                  // 로그인이 필요한 화면을 먼저 떠난 뒤에 로그아웃한다
                  router.dismissAll();
                  finish();
                  toast('탈퇴했어요. 그동안 루프와 함께해 주셔서 고마워요');
                },
                onError: (e) => toast(e.message),
              })
            }
          />
        </>
      ) : (
        <Button title="회원 탈퇴" variant="text" loading={sendCode.isPending} onPress={start} />
      )}
    </Section>
  );
}

/** 설정: 화면 테마 · 닉네임 · 비밀번호 · 2단계 인증 · 로그인한 기기 · 차단 · 탈퇴 */
export default function SettingsScreen() {
  const { user } = useAuth();
  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerClassName="pt-3 pb-10" keyboardShouldPersistTaps="handled">
        <ThemeSection />
        {user ? (
          <>
            <NicknameSection />
            <PasswordSection />
            <TwoFactorSection />
            <SessionsSection />
            <BlocksSection />
            <WithdrawSection />
          </>
        ) : (
          <Empty>로그인하면 계정 설정을 바꿀 수 있어요</Empty>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
