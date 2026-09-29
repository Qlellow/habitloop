import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useChannel, useSaveChannel, type ChannelDetail } from '@loop/shared';
import { Page } from '../components/Layout';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';
import s from './pages.styles';
import { cn } from '../lib/cn';

const SLUG = /^[a-z0-9][a-z0-9_-]{1,29}$/;

function ChannelForm({ initial }: { initial?: ChannelDetail }) {
  const navigate = useNavigate();
  const save = useSaveChannel(initial?.slug);
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  const slugOk = !!initial || SLUG.test(slug);
  const valid = slugOk && name.trim().length >= 2;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    save.mutate(
      { slug, name: name.trim(), description: description.trim() },
      {
        onSuccess: (c) => {
          toast(initial ? '채널 정보를 바꿨어요' : `${c.name} 채널을 만들었어요`);
          navigate(initial ? `/c/${c.slug}/manage` : `/c/${c.slug}`, { replace: true });
        },
      },
    );
  };

  return (
    <form className={cn(ui.card, s.formCard)} onSubmit={submit} noValidate>
      <label className={ui.field}>
        <span className={ui.label}>채널 이름</span>
        <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="예) 고양이" autoFocus />
      </label>
      <label className={ui.field}>
        <span className={ui.label}>채널 주소</span>
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
            ? '채널 주소는 바꿀 수 없어요'
            : slug
              ? `${location.host}/c/${slug}${slugOk ? '' : ' · 2자 이상, 영문이나 숫자로 시작해야 해요'}`
              : '영문 소문자·숫자·-·_ 로 2~30자'}
        </p>
      </label>
      <label className={ui.field}>
        <span className={ui.label}>소개 (선택)</span>
        <textarea
          className={ui.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="어떤 이야기를 나누는 곳인지 알려 주세요"
        />
      </label>
      {save.error && <p className={ui.error}>{save.error.message}</p>}
      <div className={s.formFoot}>
        <button type="button" className={cn(ui.button, ui.ghost)} onClick={() => navigate(-1)}>
          취소
        </button>
        <button type="submit" className={cn(ui.button, ui.primary)} disabled={!valid || save.isPending}>
          {save.isPending ? '저장 중…' : initial ? '저장하기' : '채널 만들기'}
        </button>
      </div>
    </form>
  );
}

function EditChannel({ slug }: { slug: string }) {
  const { data, isPending, isPlaceholderData, isError } = useChannel(slug);
  if (isPending || isPlaceholderData) return <div className={ui.spinner} />;
  if (isError || !data.mine) return <Navigate to={`/c/${slug}`} replace />;
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
