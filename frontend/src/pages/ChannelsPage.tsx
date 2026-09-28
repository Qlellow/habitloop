import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { useChannels } from '../api/queries';
import { useAuth } from '../auth/authStore';
import { ChannelIcon } from '../components/ChannelIcon';
import { Main, SubHeader } from '../components/Layout';
import { compact } from '../lib/format';
import { preload } from '../lib/preload';
import ch from '../components/Channel.module.css';
import ui from '../components/ui.module.css';
import d from './PostDetail.module.css';

export default function ChannelsPage() {
  const { isLoggedIn } = useAuth();
  const [input, setInput] = useState('');
  // 입력은 즉시 반영하고, 검색 요청은 렌더가 한가할 때 보낸다
  const q = useDeferredValue(input);
  const { data, isPending } = useChannels(q);

  const createTo = isLoggedIn ? '/channels/new' : '/login?next=/channels/new';

  return (
    <>
      <SubHeader
        title="채널"
        right={
          <Link to={createTo} className={d.headerAction} style={{ lineHeight: '36px', color: 'var(--primary)' }}
            onPointerEnter={isLoggedIn ? preload.channelForm : preload.login}>
            만들기
          </Link>
        }
      />
      <Main>
        <div style={{ padding: '4px 8px 12px' }}>
          <input
            type="search"
            className={ui.input}
            placeholder="채널 이름이나 주소로 찾기"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="채널 검색"
            enterKeyHint="search"
          />
        </div>
        <section className={ui.card}>
          {!q.trim() && <h2 className={ui.sectionTitle}>인기 채널</h2>}
          {isPending ? (
            <div className={ui.spinner} />
          ) : data && data.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0 8px' }}>
              {data.map((c) => (
                <li key={c.slug}>
                  <Link to={`/c/${c.slug}`} className={ch.row} onPointerEnter={preload.channel}>
                    <ChannelIcon slug={c.slug} name={c.name} />
                    <div className={ch.rowBody}>
                      <div className={ch.rowName}>{c.name}</div>
                      <div className={ch.rowDesc}>{c.description || `c/${c.slug}`}</div>
                    </div>
                    <span className={ch.rowCount}>글 {compact(c.postCount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className={ui.empty}>
              찾는 채널이 없어요
              <div style={{ marginTop: 16 }}>
                <Link to={createTo} className={`${ui.button} ${ui.secondary} ${ui.small}`}>
                  새 채널 만들기
                </Link>
              </div>
            </div>
          )}
        </section>
      </Main>
    </>
  );
}
