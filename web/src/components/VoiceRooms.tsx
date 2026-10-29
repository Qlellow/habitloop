import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useChannelVoice, useVoiceRoomMutation, type VoiceMember, type VoiceRoom } from '@loop/shared';
import { ChevronDownIcon, ChevronUpIcon, MicOffIcon, PlusIcon, ScreenShareIcon, SpeakerIcon } from './Icons';
import { VoiceControlBar } from './VoiceControls';
import { CallTimer } from './VoiceStage';
import { openVoiceWindow } from '../lib/voiceWindow';
import { useMediaQuery } from '../lib/media';
import { UserAvatar } from './UserAvatar';
import { toast } from './Toast';
import { callSince, voice, useVoice, type VoicePerson } from '../lib/voice';
import { ui } from './ui';
import { cn } from '../lib/cn';
import '../styles/voice.css';
import { ask } from './ConfirmHost';

/**
 * 채널 화면의 음성방 카드: 운영진이 만든 방 목록과 지금 들어와 있는 사람.
 * 방을 더블 클릭하면 들어간다 (키보드는 Enter). 들어가면 카드가 연두색으로 바뀌고 카드 안에서도
 * 마이크 · 듣기 끄기 · 화면 공유 · 설정 · 통화 끊기를 할 수 있다. 화면 위 떠 있는 버튼으로 다른 화면에서도 이어진다.
 * 사람이 많으면 참여자 목록을 '더보기 / 접기'로 줄인다.
 * 운영진은 여기서 방을 만들고 이름 · 인원을 바꾸거나 지운다.
 */

/** 내가 없는 방은 이만큼만 보여 주고 '외 N명' */
const PEEK = 3;
/** 내 방: 접었을 때 보여 줄 사람 수 · 처음부터 접어 둘 기준 */
const FOLDED = 4;
const AUTO_FOLD = 6;

function MemberRow({ m }: { m: VoiceMember | VoicePerson }) {
  const speaking = 'speaking' in m && m.speaking;
  return (
    // 왼쪽에 붙여서 (방 이름의 스피커 아이콘과 같은 줄). 말할 때 테두리가 위아래 줄을 침범하지 않게 위아래 여백
    <li className="flex items-center gap-2 min-w-0 py-[3px] px-2">
      <span className={cn('voice-avatar', speaking && 'is-speaking')}>
        <UserAvatar nickname={m.nickname} avatarUrl={m.avatarUrl} size={22} />
      </span>
      <span className="flex-1 min-w-0 truncate text-[13px] text-fg">{m.nickname}</span>
      {m.sharing && (
        <span className="flex-none inline-flex items-center gap-0.5 px-1.5 h-[18px] rounded-sm bg-danger text-white text-[10px] font-bold" title="화면 공유 중">
          <ScreenShareIcon width={11} height={11} /> 라이브
        </span>
      )}
      {m.muted && <MicOffIcon width={14} height={14} className="flex-none text-fg-weak" aria-label="마이크 꺼짐" />}
    </li>
  );
}

function RoomForm({ initial, onSubmit, onCancel, busy }: { initial?: VoiceRoom; onSubmit: (name: string, max: number) => void; onCancel: () => void; busy: boolean }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [max, setMax] = useState(initial?.maxParticipants ?? 25);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSubmit(name.trim(), max);
  };
  return (
    <form onSubmit={submit} className="grid gap-2 mx-1 my-1.5 p-2.5 rounded-md bg-field">
      <input className={cn(ui.input, 'h-9 text-sm bg-transparent')} value={name} maxLength={30} autoFocus placeholder="방 이름 (예: 수다방)" aria-label="방 이름" onChange={(e) => setName(e.target.value)} />
      <label className="flex items-center justify-between gap-2 text-[13px] text-fg-sub">
        최대 인원
        <select className="h-8 px-2 rounded-sm border border-border bg-surface text-[13px]" value={max} onChange={(e) => setMax(Number(e.target.value))}>
          {[2, 4, 6, 8, 10, 15, 25, 50].map((n) => (
            <option key={n} value={n}>
              {n}명
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-1.5">
        <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={onCancel}>
          취소
        </button>
        <button type="submit" className={cn(ui.button, ui.primary, ui.small)} disabled={!name.trim() || busy}>
          {initial ? '저장' : '만들기'}
        </button>
      </div>
    </form>
  );
}

/** 내 방 참여자: 많으면 접고 펼친다. 버튼은 통화 조작 바로 위 */
function HereMembers({ members }: { members: VoicePerson[] }) {
  // 직접 펼치거나 접기 전에는 사람 수로 정한다 (들어간 직후 사람이 하나씩 늘어나도 많아지면 접힌다)
  const [manual, setManual] = useState<boolean>();
  const open = manual ?? members.length <= AUTO_FOLD;
  const list = open ? members : members.slice(0, FOLDED);
  const rest = members.length - list.length;
  return (
    <>
      <ul className={cn('list-none m-0 p-0', open && members.length > 10 && 'voice-members-scroll')}>
        {list.map((m) => (
          <MemberRow key={m.id} m={m} />
        ))}
      </ul>
      {members.length > FOLDED && (
        <button type="button" className="voice-more" aria-expanded={open} onClick={() => setManual(!open)}>
          {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
          {open ? '접기' : `더보기 · ${rest}명 더`}
        </button>
      )}
    </>
  );
}

export function VoiceRooms({ slug }: { slug: string }) {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const { data } = useChannelVoice(slug);
  const mutate = useVoiceRoomMutation(slug);
  const live = useVoice();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number>();
  const [joining, setJoining] = useState<number>();
  const lastTap = useRef<{ id: number; at: number }>(undefined);
  const touch = useMediaQuery('(pointer: coarse)');

  if (!data) return null;
  // 방이 없고 운영진도 아니면 카드를 띄우지 않는다
  if (!data.canManage && (data.rooms.length === 0 || !data.enabled)) return null;

  const inCall = live.status !== 'idle';
  const hereRoom = inCall && live.join?.channel.slug === slug ? live.join.room.id : undefined;

  const join = async (room: VoiceRoom) => {
    if (!isLoggedIn) return navigate('/login', { state: { from: `/c/${slug}` } });
    // 방 화면(새 창)은 더블 클릭한 그 순간에 열어야 브라우저가 막지 않는다 → 들어가기 전에 먼저 연다
    openVoiceWindow();
    if (inCall && live.join?.room.id === room.id) return;
    setJoining(room.id);
    try {
      await voice.join(room.id);
      if (voice.get().listenOnly) toast('마이크를 쓸 수 없어 듣기만 해요. 브라우저의 마이크 권한을 확인해 주세요');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setJoining(undefined);
    }
  };

  const run = (op: Parameters<typeof mutate.mutate>[0], done?: string) =>
    mutate.mutate(op, {
      onSuccess: () => {
        setAdding(false);
        setEditing(undefined);
        if (done) toast(done);
      },
      onError: (e) => toast(e.message),
    });

  return (
    <section className={cn(ui.card, 'voice-card', hereRoom != null && 'is-live')} aria-label="음성 채팅">
      <div className={ui.cardHead}>
        <div className="min-w-0">
          <h2 className={cn(ui.sectionTitle, 'text-base')}>음성 채팅</h2>
          {data.enabled && data.rooms.length > 0 && hereRoom == null && <p className="m-0 mt-0.5 text-[12px] text-fg-weak">방을 {touch ? '두 번 탭' : '더블 클릭'}하면 들어가요</p>}
        </div>
        {data.canManage && data.enabled && !adding && data.rooms.length < 10 && (
          <button type="button" className={cn(ui.button, ui.text, ui.small, 'px-2 gap-1 [&>svg]:w-4 [&>svg]:h-4')} onClick={() => setAdding(true)}>
            <PlusIcon /> 방 만들기
          </button>
        )}
      </div>
      <div className="px-2.5 pb-3">
        {!data.enabled ? (
          <p className="m-0 px-2.5 pb-1 text-[13px] text-fg-weak">
            서버에 음성채팅(LiveKit)을 설정하면 운영진이 음성방을 만들 수 있어요.
          </p>
        ) : (
          <>
            {adding && <RoomForm busy={mutate.isPending} onCancel={() => setAdding(false)} onSubmit={(name, maxParticipants) => run({ kind: 'create', name, maxParticipants }, '음성방을 만들었어요')} />}
            {data.rooms.length === 0 && !adding && <p className="m-0 px-2.5 pb-1 text-[13px] text-fg-weak">아직 음성방이 없어요. 방을 만들어 보세요.</p>}
            <ul className="list-none m-0 p-0">
              {data.rooms.map((room) => {
                const here = hereRoom === room.id;
                // 내가 있는 방은 실시간 상태로, 아니면 서버가 알려 준 사람들.
                // 이 화면이 연결돼 있지 않은데 서버 목록에 내가 있으면 (새로고침 직후 남은 이전 연결) 빼고 보여 준다
                const members: (VoiceMember | VoicePerson)[] = here ? live.people : room.members.filter((m) => !(user && m.id === user.id && !inCall));
                const full = members.length >= room.maxParticipants && !here;
                if (editing === room.id)
                  return (
                    <li key={room.id}>
                      <RoomForm
                        initial={room}
                        busy={mutate.isPending}
                        onCancel={() => setEditing(undefined)}
                        onSubmit={(name, maxParticipants) => run({ kind: 'update', id: room.id, name, maxParticipants })}
                      />
                    </li>
                  );
                return (
                  <li key={room.id} className="group/room">
                    <div className={cn('voice-room', here && 'is-here', data.canManage && 'has-tools')}>
                      <button
                        type="button"
                        className="voice-room-join flex-1 min-w-0 flex items-center gap-2 h-9 px-2 text-left disabled:opacity-60"
                        disabled={full || joining != null}
                        // 마우스 · 터치는 더블 클릭(두 번 탭)으로 들어간다. 키보드(Enter · Space)는 한 번에 (detail 0).
                        // 폰 브라우저는 두 번 탭에 dblclick 을 안 주기도 해서 눌린 간격을 직접 잰다
                        onClick={(e) => {
                          if (e.detail === 0) return void join(room);
                          const prev = lastTap.current;
                          lastTap.current = { id: room.id, at: e.timeStamp };
                          if (prev?.id === room.id && e.timeStamp - prev.at < 450) {
                            lastTap.current = undefined;
                            void join(room);
                          }
                        }}
                        aria-label={`${room.name} 음성방 ${here ? '(참여 중)' : '들어가기'}`}
                        title={here ? '참여 중' : '더블 클릭해서 들어가기'}
                      >
                        <SpeakerIcon width={18} height={18} className="flex-none voice-room-icon" />
                        <span className="voice-room-name min-w-0 truncate text-[14px] font-semibold">{room.name}</span>
                        {/* 통화 시간: 지금 있는 사람 중 가장 먼저 들어온 때부터 */}
                        {members.length > 0 && <CallTimer since={here ? callSince(live.people) : room.since} />}
                        {/* 정원: 왼쪽 스피커 아이콘과 마주 보게 오른쪽 끝에 (운영진은 마우스를 올리면 그 자리에 고치기 · 지우기) */}
                        <span className="voice-room-count ml-auto flex-none text-[12px] text-fg-weak tabular-nums">
                          {joining === room.id ? '연결 중…' : full ? '가득 참' : `${members.length}/${room.maxParticipants}`}
                        </span>
                      </button>
                      {data.canManage && (
                        <span className="voice-room-tools">
                          <button type="button" onClick={() => setEditing(room.id)} aria-label={`${room.name} 고치기`} title="고치기">
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={async () => (await ask(`'${room.name}' 방을 지울까요?`, { message: '들어와 있는 사람도 모두 나가게 돼요.', confirmLabel: '지우기', danger: true })) && run({ kind: 'delete', id: room.id }, '음성방을 지웠어요')}
                            aria-label={`${room.name} 지우기`}
                            title="지우기"
                          >
                            ✕
                          </button>
                        </span>
                      )}
                    </div>
                    {here ? (
                      <div className="pb-1">
                        <HereMembers members={live.people} />
                        <div className="px-1 pt-2">
                          <VoiceControlBar />
                        </div>
                      </div>
                    ) : (
                      members.length > 0 && (
                        <ul className="list-none m-0 p-0 pb-1">
                          {members.slice(0, PEEK).map((m) => (
                            <MemberRow key={m.id} m={m} />
                          ))}
                          {members.length > PEEK && <li className="pl-2 py-1 text-[12px] text-fg-weak">외 {members.length - PEEK}명</li>}
                        </ul>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
