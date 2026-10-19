import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PET_SPECIES, PET_STAGES, useAdoptPet, useMyPet, usePatPet, useUpdatePet, type Pet, type PetSpecies } from '@loop/shared';
import { PetActor } from '../../components/Pet';
import { toast } from '../../components/Toast';
import { updateSettings, useSettings } from '../../lib/settings';
import { ui } from '../../components/ui';
import s from './my.styles';
import { cn } from '../../lib/cn';

const MOOD = { happy: '신나요', calm: '느긋해요', sleepy: '졸려요' } as const;

/** 경험치 얻는 법 (api/src/pets/pets.service.ts 와 같게) */
const HOW = [
  ['글 쓰기', '+30', '하루 5개까지'],
  ['댓글 쓰기', '+10', '하루 20개까지'],
  ['내 글이 받은 좋아요', '+3', ''],
  ['내 글이 받은 감정 반응', '+2', ''],
  ['쓰다듬기', '+5', '하루 한 번'],
] as const;

/** 다음 단계 */
function nextStage(level: number) {
  if (level < 1) return { label: PET_STAGES.baby.label, at: 1 };
  if (level < 5) return { label: PET_STAGES.junior.label, at: 5 };
  if (level < 10) return { label: PET_STAGES.adult.label, at: 10 };
  if (level < 15) return { label: '리본', at: 15 };
  if (level < 20) return { label: '왕관', at: 20 };
  return undefined;
}

/** 펫 데려오기: 종 고르고 이름 짓기 */
function Adopt() {
  const [species, setSpecies] = useState<PetSpecies>('slime');
  const [name, setName] = useState('');
  const adopt = useAdoptPet();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    adopt.mutate(
      { species, name: name.trim() },
      { onSuccess: () => toast('알을 받았어요! 활동하면 곧 깨어나요'), onError: (err) => toast(err.message) },
    );
  };
  return (
    <form className={cn(ui.card, s.section)} onSubmit={submit}>
      <h2 className={s.sectionTitle}>함께할 펫을 골라 주세요</h2>
      <p className={s.sectionDesc}>글과 댓글을 쓰면 경험치를 얻어 알에서 깨어나고, 자라면서 모습과 행동이 바뀌어요.</p>
      <div role="radiogroup" aria-label="펫 종류" className="grid grid-cols-3 gap-3 max-[520px]:gap-2">
        {PET_SPECIES.map((p) => (
          <button
            key={p.species}
            type="button"
            role="radio"
            aria-checked={species === p.species}
            onClick={() => setSpecies(p.species)}
            className={cn(
              'flex flex-col items-center gap-1 pt-4 pb-3 px-1 rounded-lg border-2 text-center transition-colors max-[520px]:pt-3 max-[520px]:pb-2.5',
              species === p.species ? 'border-primary bg-primary-weak' : 'border-border hover:border-fg-weak',
            )}
          >
            <PetActor pet={{ species: p.species, name: p.label, level: 3, stage: 'baby', mood: 'happy' }} size={5} />
            <span className="mt-1 font-bold text-fg-strong">{p.label}</span>
            <span className="text-[13px] text-fg-sub max-[520px]:text-[12px] max-[520px]:leading-snug">{p.desc}</span>
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2 mt-5 max-[520px]:flex-col max-[520px]:items-stretch">
        <label className="flex-1">
          <span className="block mb-1 text-sm font-semibold text-fg-strong">이름</span>
          <input className={ui.input} value={name} maxLength={12} placeholder="1~12자" onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className={cn(ui.button, ui.primary)} disabled={!name.trim() || adopt.isPending}>
          {adopt.isPending ? '데려오는 중…' : '알 받기'}
        </button>
      </div>
    </form>
  );
}

function PetHome({ pet }: { pet: Pet }) {
  const pat = usePatPet();
  const update = useUpdatePet();
  const { petRoam } = useSettings();
  const [pats, setPats] = useState(0);
  const [name, setName] = useState(pet.name);
  const prevLevel = useRef(pet.level);
  const next = nextStage(pet.level);
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
    pat.mutate(undefined, {
      onSuccess: (res) => res.gained && toast(`쓰다듬었어요 · 경험치 +${res.xp}`),
      onError: (e) => toast(e.message),
    });
  };

  return (
    <>
      <section className={cn(ui.card, s.section)}>
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="m-0 text-[19px] font-bold text-fg-strong">{pet.name}</h2>
          <span className="text-sm font-bold text-primary">Lv.{pet.level}</span>
          <span className="text-sm text-fg-sub">
            {PET_STAGES[pet.stage].label} · {MOOD[pet.mood]}
          </span>
        </div>
        <div className="pet-room">
          <PetActor pet={pet} room size={6} progress={pet.stage === 'egg' ? pet.xp / 10 : 0} pats={pats} onPet={doPat} />
        </div>
        <div className="mt-4">
          <div className="flex justify-between mb-1.5 text-[13px] text-fg-sub">
            <span>
              경험치 {pet.xp - pet.levelXp} / {span}
            </span>
            <span>{next ? `Lv.${next.at}에 ${next.label}` : '다 자랐어요'}</span>
          </div>
          <div className="pet-xp" role="progressbar" aria-valuemin={0} aria-valuemax={span} aria-valuenow={pet.xp - pet.levelXp} aria-label="다음 레벨까지">
            <i style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button type="button" className={cn(ui.button, ui.primary)} onClick={doPat}>
            쓰다듬기
          </button>
          <span className="text-[13px] text-fg-weak">{pet.pettedToday ? '오늘 경험치는 받았어요 · 그래도 좋아해요' : '하루 한 번 경험치 +5'}</span>
        </div>
      </section>

      <section className={cn(ui.card, s.section)}>
        <h2 className={s.sectionTitle}>키우는 법</h2>
        <p className={s.sectionDesc}>
          {pet.name}을(를) 데려온 뒤의 활동만 쳐요. 글 · 댓글을 지우면 그만큼 빠져요. 최근에 활동할수록 신나고, 오래 쉬면 졸려해요.
        </p>
        <ul className="list-none m-0 p-0 grid gap-1.5">
          {HOW.map(([what, xp, note]) => (
            <li key={what} className="flex items-center gap-3 px-3 py-2 rounded-md bg-field text-sm">
              <span className="flex-1 text-fg">{what}</span>
              {note && <span className="text-[12px] text-fg-weak">{note}</span>}
              <b className="w-10 text-right text-primary">{xp}</b>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-4 gap-2 mt-4 max-[520px]:grid-cols-2">
          {[
            ['글', pet.stats.posts],
            ['댓글', pet.stats.comments],
            ['받은 좋아요', pet.stats.likes],
            ['받은 반응', pet.stats.reactions],
          ].map(([label, n]) => (
            <div key={label} className="px-3 py-2.5 rounded-md border border-border text-center">
              <div className="text-[18px] font-bold text-fg-strong">{n}</div>
              <div className="text-[12px] text-fg-weak">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={cn(ui.card, s.section)}>
        <h2 className={s.sectionTitle}>펫 설정</h2>
        <form
          className="flex items-end gap-2 mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ name: name.trim() }, { onSuccess: () => toast('이름을 바꿨어요'), onError: (err) => toast(err.message) });
          }}
        >
          <label className="flex-1">
            <span className="block mb-1 text-sm font-semibold text-fg-strong">이름</span>
            <input className={ui.input} value={name} maxLength={12} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit" className={cn(ui.button, ui.secondary)} disabled={!name.trim() || name.trim() === pet.name || update.isPending}>
            바꾸기
          </button>
        </form>
        <div className={cn(s.option, 'mt-2')}>
          <div>
            <div className={s.optionLabel}>화면에 데리고 다니기</div>
            <div className={s.optionDesc}>
              {pet.name}이(가) 다른 화면에서도 돌아다녀요. 끌어서 옮기거나 던질 수 있고, 눌러서 쓰다듬어요. (이 브라우저에만 저장 · 마우스가 있는 기기)
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={petRoam}
            aria-label="화면에 데리고 다니기"
            className={s.switch}
            onClick={() => updateSettings({ petRoam: !petRoam })}
          />
        </div>
        <div className={s.option}>
          <div>
            <div className={s.optionLabel}>프로필에 전시하기</div>
            <div className={s.optionDesc}>다른 사람이 내 프로필에서 {pet.name}을(를) 볼 수 있어요.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pet.shown}
            aria-label="프로필에 전시하기"
            className={s.switch}
            onClick={() => update.mutate({ shown: !pet.shown }, { onError: (err) => toast(err.message) })}
          />
        </div>
      </section>
    </>
  );
}

/** 마이페이지 › 펫 */
export default function PetPage() {
  const { data: pet, isLoading } = useMyPet();
  return (
    <>
      <div className={s.head}>
        <h1 className={s.title}>펫</h1>
        <p className={s.desc}>글과 댓글로 함께 자라는 나만의 도트 펫이에요. 눌러서 쓰다듬어 보세요.</p>
      </div>
      {isLoading ? <div className={ui.spinner} /> : pet ? <PetHome pet={pet} /> : <Adopt />}
    </>
  );
}
