import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useChannel, useSaveChannel } from '../api/queries';
import type { ChannelDetail } from '../api/types';
import { SubHeader } from '../components/Layout';
import { toast } from '../components/Toast';
import ui from '../components/ui.module.css';
import s from './Auth.module.css';

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
          navigate(`/c/${c.slug}`, { replace: true });
        },
      },
    );
  };

  return (
    <form className={s.wrap} onSubmit={submit} noValidate>
      <h1 className={s.heading}>{initial ? '채널 정보를\n바꿀게요' : '어떤 채널을\n만들까요?'}</h1>
      <label className={ui.field}>
        <span className={ui.label}>채널 이름</span>
        <input
          className={ui.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="예) 고양이"
          autoFocus
        />
      </label>
      <label className={ui.field}>
        <span className={ui.label}>채널 주소 {initial && '(바꿀 수 없어요)'}</span>
        <input
          className={ui.input}
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
          maxLength={30}
          placeholder="예) cats"
          disabled={!!initial}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      {!initial && (
        <p className={ui.label} style={{ margin: '-12px 0 20px' }}>
          {slug ? `loop/c/${slug}` : '영문 소문자·숫자·-·_ 로 2~30자'}
          {slug && !slugOk && ' · 2자 이상, 영문이나 숫자로 시작해야 해요'}
        </p>
      )}
      <label className={ui.field}>
        <span className={ui.label}>소개 (선택)</span>
        <textarea
          className={ui.textarea}
          style={{ minHeight: 110 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="어떤 이야기를 나누는 곳인지 알려 주세요"
        />
      </label>
      {save.error && <p className={ui.error}>{save.error.message}</p>}
      <div className={ui.bottomCta}>
        <div>
          <button type="submit" className={`${ui.button} ${ui.primary} ${ui.block}`} disabled={!valid || save.isPending}>
            {save.isPending ? '저장 중…' : initial ? '저장하기' : '채널 만들기'}
          </button>
        </div>
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
    <div className={ui.sheet}>
      <SubHeader />
      {slug ? <EditChannel slug={slug} /> : <ChannelForm />}
    </div>
  );
}
