import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CHANNEL_COLORS, channelColor, channelIconUrl, useAuth, useChannel, useChannelIcon, useSaveChannel, type ChannelDetail } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { Page } from '../components/Layout';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';
import { toSquareIcon } from '../lib/image';
import { CropModal } from '../components/CropModal';
import s from './pages.styles';
import { cn } from '../lib/cn';

const SLUG = /^[a-z0-9][a-z0-9_-]{1,29}$/;
const MAX_DESCRIPTION = 2000;

/** 프로필 이미지: 새로 고른 사진(blob) · 지우기(null) · 그대로(undefined) */
type IconChange = { blob: Blob; url: string } | null | undefined;

function IconPicker({
  name,
  slug,
  color,
  onColor,
  current,
  change,
  onChange,
}: {
  name: string;
  slug: string;
  /** 사진이 없을 때의 프로필 색 번호 */
  color: number;
  onColor: (c: number) => void;
  current?: string;
  change: IconChange;
  onChange: (c: IconChange) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // 고른 사진은 먼저 자르기 창(1:1)에서 영역을 고른 뒤 정사각형으로 만든다
  const [cropping, setCropping] = useState<{ file: File; url: string }>();
  const preview = change === null ? undefined : (change?.url ?? current);

  const pick = (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('이미지 파일을 골라 주세요');
    setCropping({ file, url: URL.createObjectURL(file) });
  };

  const closeCrop = () => {
    if (cropping) URL.revokeObjectURL(cropping.url);
    setCropping(undefined);
  };

  const applyCrop = async (crop: { x: number; y: number; w: number; h: number }) => {
    if (!cropping) return;
    setBusy(true);
    try {
      const blob = await toSquareIcon(cropping.file, crop);
      onChange({ blob, url: URL.createObjectURL(blob) });
      closeCrop();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={ui.field}>
      <span className={ui.label}>채널 프로필</span>
      <div className={s.iconPicker}>
        {/* 색은 고리가 아니라 고른 번호로 정한다 (고리를 입력해도 색이 바뀌지 않게) */}
        <ChannelIcon channel={{ slug: slug || 'loop', name: name.trim() || '루', color }} src={preview} size={72} />
        <div className={s.iconPickerBody}>
          <div className={s.iconPickerActions}>
            <button type="button" className={cn(ui.button, ui.secondary, ui.small)} disabled={busy} onClick={() => input.current?.click()}>
              {busy ? '준비 중…' : preview ? '사진 바꾸기' : '사진 올리기'}
            </button>
            {preview && (
              <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={() => onChange(current ? null : undefined)}>
                기본으로
              </button>
            )}
          </div>
          {!preview && (
            <div className="flex flex-wrap gap-1.5 mt-2.5" role="radiogroup" aria-label="기본 프로필 색">
              {CHANNEL_COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === i}
                  aria-label={`색 ${i + 1}`}
                  onClick={() => onColor(i)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110 aria-checked:ring-2 aria-checked:ring-offset-2 aria-checked:ring-offset-surface aria-checked:ring-[var(--text-sub)]"
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
          <p className={cn(ui.help, 'mt-2')}>
            사진을 고르면 정사각형으로 자를 영역을 정할 수 있어요. 사진이 없으면 고른 색 위에 채널 이름 첫 글자로 보여요.
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-label="채널 프로필 사진"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      {cropping && (
        <CropModal
          src={cropping.url}
          title="채널 프로필 자르기"
          shapes={false}
          aspect={1}
          applyLabel={busy ? '만드는 중…' : '이 영역으로 설정'}
          onApply={({ crop }) => void applyCrop(crop)}
          onClose={closeCrop}
        />
      )}
    </div>
  );
}

function ChannelForm({ initial }: { initial?: ChannelDetail }) {
  const navigate = useNavigate();
  const save = useSaveChannel(initial?.slug);
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState<IconChange>();
  const { user } = useAuth();
  const [visibility, setVisibility] = useState<'public' | 'private'>(initial?.visibility ?? 'public');
  const [adult, setAdult] = useState(!!initial?.adult);
  // 기본 프로필 색: 수정이면 지금 색(예전 채널은 고리로 정해진 색), 새 채널이면 무작위로 하나
  const [color, setColor] = useState(() =>
    initial
      ? (initial.color ?? Math.max(0, CHANNEL_COLORS.indexOf(channelColor(initial.slug))))
      : Math.floor(Math.random() * CHANNEL_COLORS.length),
  );
  const iconMutation = useChannelIcon(initial?.slug ?? slug);

  // 미리보기용으로 만든 blob 주소는 바뀌거나 화면을 떠날 때 풀어 준다
  useEffect(() => () => void (icon && URL.revokeObjectURL(icon.url)), [icon]);

  const slugOk = !!initial || SLUG.test(slug);
  const valid = slugOk && name.trim().length >= 2 && description.length <= MAX_DESCRIPTION;
  const pending = save.isPending || iconMutation.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || pending) return;
    save.mutate(
      { slug, name: name.trim(), description: description.trim(), color, visibility, adult },
      {
        onSuccess: async (c) => {
          if (icon !== undefined) {
            try {
              await iconMutation.mutateAsync(icon?.blob ?? null);
            } catch (err) {
              // 채널은 만들어졌으니 이동은 하고, 사진만 실패했다고 알려 준다
              toast(`프로필 사진을 올리지 못했어요: ${(err as Error).message}`);
            }
          }
          toast(initial ? '채널 정보를 바꿨어요' : `${c.name} 채널을 만들었어요`);
          navigate(initial ? `/c/${c.slug}/manage` : `/c/${c.slug}`, { replace: true });
        },
      },
    );
  };

  return (
    <form className={cn(ui.card, s.formCard)} onSubmit={submit} noValidate>
      <IconPicker name={name} slug={slug} color={color} onColor={setColor} current={initial && channelIconUrl(initial)} change={icon} onChange={setIcon} />
      <label className={ui.field}>
        <span className={ui.label}>채널 이름</span>
        <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="예) 고양이" autoFocus />
      </label>
      <label className={ui.field}>
        <span className={ui.label}>고리</span>
        <input
          className={ui.input}
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
          maxLength={30}
          placeholder="예) cats"
          disabled={!!initial}
          autoCapitalize="off"
          spellCheck={false}
        />
        <p className={ui.help}>
          {initial
            ? '고리는 바꿀 수 없어요'
            : slug
              ? `${location.host}/c/${slug}${slugOk ? '' : ' · 2자 이상, 영문이나 숫자로 시작해야 해요'}`
              : '고리는 루프에서 채널로 이어지는 짧은 이름이에요. 주소(/c/고리)에 쓰이고, 만든 뒤에는 바꿀 수 없어요. 영문 소문자·숫자·-·_ 로 2~30자'}
        </p>
      </label>
      <div className={ui.field}>
        <span className={ui.label}>공개 설정</span>
        <div className="grid grid-cols-2 gap-2 max-[520px]:grid-cols-1" role="radiogroup" aria-label="공개 설정">
          {(
            [
              ['public', '🌐 공개', '누구나 채널을 찾고 글을 볼 수 있어요'],
              ['private', '🔒 비공개', '초대 링크 · 코드 · QR 로 팔로우한 사람만 볼 수 있어요'],
            ] as const
          ).map(([v, label, desc]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={visibility === v}
              onClick={() => setVisibility(v)}
              className="flex flex-col items-start gap-0.5 p-3.5 rounded-md border border-border text-left transition-colors hover:bg-pressed aria-checked:border-primary aria-checked:bg-primary-weak"
            >
              <span className="font-semibold text-fg-strong">{label}</span>
              <span className="text-[13px] text-fg-sub">{desc}</span>
            </button>
          ))}
        </div>
        {visibility === 'private' && (
          <p className={ui.help}>초대 링크와 코드는 채널을 만든 뒤 채널 관리 화면에서 확인할 수 있어요.</p>
        )}
      </div>
      <div className={ui.field}>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={adult}
            disabled={!user?.adult && !initial?.adult}
            onChange={(e) => setAdult(e.target.checked)}
            className="w-[18px] h-[18px] accent-[var(--danger)]"
          />
          <span className="font-semibold text-fg-strong">만 19세 이상만 볼 수 있는 채널</span>
        </label>
        <p className={ui.help}>
          {user?.adult || initial?.adult
            ? '켜면 설정에서 나이를 확인한 만 19세 이상만 채널을 찾고 볼 수 있어요.'
            : '19세 이상 채널은 설정에서 나이를 확인한 만 19세 이상만 만들 수 있어요.'}
        </p>
      </div>
      <div className={ui.field}>
        <span className={ui.label}>소개 (선택)</span>
        <MarkdownEditor
          compact
          value={description}
          onChange={setDescription}
          maxLength={MAX_DESCRIPTION}
          label="채널 소개"
          placeholder={'어떤 이야기를 나누는 곳인지 알려 주세요\n\n마크다운으로 규칙이나 운영진 소개도 적을 수 있어요'}
        />
        <p className={ui.help}>
          {description.length.toLocaleString()} / {MAX_DESCRIPTION.toLocaleString()}자 · 길면 채널 화면에서 '더 보기'로 접혀요
        </p>
      </div>
      {save.error && <p className={ui.error}>{save.error.message}</p>}
      <div className={s.formFoot}>
        <button type="button" className={cn(ui.button, ui.ghost)} onClick={() => navigate(-1)}>
          취소
        </button>
        <button type="submit" className={cn(ui.button, ui.primary)} disabled={!valid || pending}>
          {pending ? '저장 중…' : initial ? '저장하기' : '채널 만들기'}
        </button>
      </div>
    </form>
  );
}

function EditChannel({ slug }: { slug: string }) {
  const { data, isPending, isPlaceholderData, isError } = useChannel(slug);
  if (isPending || isPlaceholderData) return <div className={ui.spinner} />;
  if (isError || !data.canManage) return <Navigate to={`/c/${slug}`} replace />;
  return <ChannelForm initial={data} />;
}

export default function ChannelFormPage() {
  const { slug } = useParams();
  return (
    <Page variant="single">
      <div>
        <h1 className={s.pageTitle}>{slug ? '채널 정보 수정' : '새 채널 만들기'}</h1>
        {!slug && <p className={s.pageDesc}>좋아하는 주제로 사람들이 모이는 공간을 만들어 보세요.</p>}
      </div>
      {slug ? <EditChannel slug={slug} /> : <ChannelForm />}
    </Page>
  );
}
