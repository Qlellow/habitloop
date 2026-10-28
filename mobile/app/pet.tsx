import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import {
  PET_MOOD_LABEL,
  PET_SPECIES,
  PET_STAGES,
  PET_XP_RULES,
  nextPetStage,
  useAdoptPet,
  useAuth,
  useMyPet,
  usePatPet,
  useUpdatePet,
  type Pet,
  type PetSpecies,
} from '@loop/shared';
import { PetView } from '../src/Pixel';
import { Button, Card, Empty, Input, Loading } from '../src/ui';
import { cn } from '../src/cn';
import { useColors } from '../src/theme';
import { toast } from '../src/Toast';


/** 펫 데려오기: 종 고르고 이름 짓기 */
function Adopt() {
  const [species, setSpecies] = useState<PetSpecies>('slime');
  const [name, setName] = useState('');
  const adopt = useAdoptPet();
  return (
    <Card className="m-4 p-5">
      <Text className="text-lg font-bold text-fg-strong">함께할 펫을 골라 주세요</Text>
      <Text className="mt-1 mb-4 text-sm leading-5 text-fg-sub">글과 댓글을 쓰면 경험치를 얻어 알에서 깨어나고, 자라면서 모습과 행동이 바뀌어요.</Text>
      <View className="flex-row gap-2" accessibilityRole="radiogroup">
        {PET_SPECIES.map((p) => (
          <Pressable
            key={p.species}
            accessibilityRole="radio"
            accessibilityState={{ checked: species === p.species }}
            onPress={() => setSpecies(p.species)}
            className={cn('flex-1 items-center gap-1 pt-3 pb-2.5 px-1 rounded-lg border-2', species === p.species ? 'border-primary bg-primary-weak' : 'border-border')}
          >
            <PetView pet={{ species: p.species, name: p.label, level: 3, stage: 'baby', mood: 'happy' }} size={4} />
            <Text className="mt-1 font-bold text-fg-strong">{p.label}</Text>
            <Text className="text-xs text-center text-fg-sub">{p.desc}</Text>
          </Pressable>
        ))}
      </View>
      <Text className="mt-5 mb-1.5 text-sm font-semibold text-fg-strong">이름</Text>
      <Input value={name} onChangeText={setName} maxLength={12} placeholder="1~12자" />
      <Button
        className="mt-3"
        full
        title="알 받기"
        loading={adopt.isPending}
        disabled={!name.trim()}
        onPress={() => adopt.mutate({ species, name: name.trim() }, { onSuccess: () => toast('알을 받았어요! 활동하면 곧 깨어나요'), onError: (e) => toast(e.message) })}
      />
    </Card>
  );
}

function PetHome({ pet }: { pet: Pet }) {
  const c = useColors();
  const pat = usePatPet();
  const update = useUpdatePet();
  const [pats, setPats] = useState(0);
  const [name, setName] = useState(pet.name);
  const prevLevel = useRef(pet.level);
  const next = nextPetStage(pet.level);
  const span = pet.nextXp - pet.levelXp;
  const ratio = span ? (pet.xp - pet.levelXp) / span : 1;

  // 레벨이 오르거나 자라면 축하
  useEffect(() => {
    const before = prevLevel.current;
    prevLevel.current = pet.level;
    if (pet.level <= before) return;
    const grew = Object.values(PET_STAGES).some((st) => st.from > before && st.from <= pet.level);
    toast(grew ? `${pet.name}이(가) ${PET_STAGES[pet.stage].label}(으)로 자랐어요!` : `레벨 업! Lv.${pet.level}`);
  }, [pet.level, pet.name, pet.stage]);

  const doPat = () => {
    setPats((n) => n + 1);
    if (pat.isPending) return;
    pat.mutate(undefined, { onSuccess: (res) => res.gained && toast(`쓰다듬었어요 · 경험치 +${res.xp}`), onError: (e) => toast(e.message) });
  };

  return (
    <ScrollView contentContainerClassName="p-4 gap-3 pb-10">
      <Card className="p-5">
        <View className="flex-row items-baseline gap-2 mb-3">
          <Text className="text-[19px] font-bold text-fg-strong">{pet.name}</Text>
          <Text className="text-sm font-bold text-primary">Lv.{pet.level}</Text>
          <Text className="text-sm text-fg-sub">
            {PET_STAGES[pet.stage].label} · {PET_MOOD_LABEL[pet.mood]}
          </Text>
        </View>
        <View className="items-center justify-end h-[150px] rounded-lg bg-field pb-3">
          <PetView pet={pet} size={6} progress={pet.stage === 'egg' ? pet.xp / 10 : 0} pats={pats} onPress={doPat} />
        </View>
        <View className="flex-row justify-between mt-4 mb-1.5">
          <Text className="text-[13px] text-fg-sub">
            경험치 {pet.xp - pet.levelXp} / {span}
          </Text>
          <Text className="text-[13px] text-fg-sub">{next ? `Lv.${next.at}에 ${next.label}` : '다 자랐어요'}</Text>
        </View>
        <View className="h-2 rounded-full bg-field overflow-hidden">
          <View className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%` }} />
        </View>
        <View className="flex-row items-center gap-3 mt-4">
          <Button title="쓰다듬기" onPress={doPat} />
          <Text className="flex-1 text-[13px] text-fg-weak">{pet.pettedToday ? '오늘 경험치는 받았어요 · 그래도 좋아해요' : '하루 한 번 경험치 +5'}</Text>
        </View>
      </Card>

      <Card className="p-5">
        <Text className="text-base font-bold text-fg-strong">키우는 법</Text>
        <Text className="mt-1 mb-3 text-[13px] leading-[19px] text-fg-weak">
          {pet.name}을(를) 데려온 뒤의 활동만 쳐요. 글 · 댓글을 지우면 그만큼 빠져요. 최근에 활동할수록 신나고, 오래 쉬면 졸려해요.
        </Text>
        <View className="gap-1.5">
          {PET_XP_RULES.map(([what, xp, note]) => (
            <View key={what} className="flex-row items-center gap-3 px-3 py-2 rounded-md bg-field">
              <Text className="flex-1 text-sm text-fg">{what}</Text>
              {note ? <Text className="text-xs text-fg-weak">{note}</Text> : null}
              <Text className="w-10 text-right font-bold text-primary">{xp}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap gap-2 mt-4">
          {(
            [
              ['글', pet.stats.posts],
              ['댓글', pet.stats.comments],
              ['받은 좋아요', pet.stats.likes],
              ['받은 반응', pet.stats.reactions],
            ] as const
          ).map(([label, n]) => (
            <View key={label} className="w-[48%] py-2.5 rounded-md border border-border items-center">
              <Text className="text-lg font-bold text-fg-strong">{n}</Text>
              <Text className="text-xs text-fg-weak">{label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card className="p-5">
        <Text className="text-base font-bold text-fg-strong mb-2">펫 설정</Text>
        <Text className="mb-1.5 text-sm font-semibold text-fg-strong">이름</Text>
        <View className="flex-row gap-2">
          <Input className="flex-1" value={name} onChangeText={setName} maxLength={12} />
          <Button
            title="바꾸기"
            variant="secondary"
            className="h-auto"
            disabled={!name.trim() || name.trim() === pet.name}
            loading={update.isPending}
            onPress={() => update.mutate({ name: name.trim() }, { onSuccess: () => toast('이름을 바꿨어요'), onError: (e) => toast(e.message) })}
          />
        </View>
        <View className="flex-row items-center gap-3 mt-5">
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-fg-strong">프로필에 전시하기</Text>
            <Text className="mt-0.5 text-[13px] text-fg-weak">다른 사람이 내 프로필에서 {pet.name}을(를) 볼 수 있어요.</Text>
          </View>
          <Switch
            value={pet.shown}
            onValueChange={(shown) => update.mutate({ shown }, { onError: (e) => toast(e.message) })}
            trackColor={{ true: c.primary, false: c.border }}
            accessibilityLabel="프로필에 전시하기"
          />
        </View>
      </Card>
    </ScrollView>
  );
}

/** 내 펫: 없으면 데려오기, 있으면 키우기 */
export default function PetScreen() {
  const { isLoggedIn } = useAuth();
  const { data: pet, isPending } = useMyPet(isLoggedIn);
  if (!isLoggedIn) return <Empty>로그인하면 펫을 키울 수 있어요</Empty>;
  if (isPending) return <Loading />;
  return pet ? <PetHome pet={pet} /> : <Adopt />;
}
