import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { compact, useAuth, useChannels } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { Page } from '../components/Layout';
import { preload } from '../lib/preload';
import ui from '../components/ui.module.css';
import s from './pages.module.css';

export default function ChannelsPage() {
  const { isLoggedIn } = useAuth();
  const [input, setInput] = useState('');
  // 입력은 즉시 반영하고, 검색 요청은 렌더가 한가할 때 보낸다
  const q = useDeferredValue(input);
  const { data, isPending } = useChannels(q);
  const createTo = isLoggedIn ? '/channels/new' : '/login?next=/channels/new';

  return (
    <Page variant="single">
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>채널</h1>
          <p className={s.pageDesc}>관심 있는 주제의 채널을 찾아보세요.</p>
        </div>
        <Link to={createTo} className={`${ui.button} ${ui.primary}`} onPointerEnter={preload.channelForm}>
          채널 만들기
        </Link>
      </div>
      <input
        type="search"
        className={ui.input}
        placeholder="채널 이름이나 주소로 찾기"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label="채널 검색"
      />
      {isPending ? (
        <div className={ui.spinner} />
      ) : data && data.length > 0 ? (
        <div className={s.channelGrid}>
          {data.map((c) => (
            <Link key={c.slug} to={`/c/${c.slug}`} className={s.channelCard} onPointerEnter={preload.channel}>
              <ChannelIcon slug={c.slug} name={c.name} size={44} />
              <div>
                <div className={s.channelCardName}>{c.name}</div>
                <div className={s.channelCardMeta}>c/{c.slug}</div>
              </div>
              <div className={s.channelCardDesc}>{c.description || '소개가 아직 없어요'}</div>
              <div className={s.channelCardMeta}>글 {compact(c.postCount)}개</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className={`${ui.card} ${ui.empty}`}>
          찾는 채널이 없어요
          <div style={{ marginTop: 16 }}>
            <Link to={createTo} className={`${ui.button} ${ui.secondary} ${ui.small}`}>
              새 채널 만들기
            </Link>
          </div>
        </div>
      )}
    </Page>
  );
}
