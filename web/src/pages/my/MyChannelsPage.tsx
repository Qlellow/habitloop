import { Link, useSearchParams } from 'react-router-dom';
import {
  compact,
  useBookmark,
  useBookmarkedChannels,
  useMembership,
  useMyChannels,
  plainText,
  type ChannelSummary,
} from '@loop/shared';
import { ChannelIcon } from '../../components/ChannelIcon';
import { toast } from '../../components/Toast';
import { preload } from '../../lib/preload';
import { ui } from '../../components/ui';
import s from './my.styles';
import { cn } from '../../lib/cn';

function ChannelRow({ channel, action }: { channel: ChannelSummary; action: React.ReactNode }) {
  return (
    <li className={s.channelItem}>
      <div className={s.channel}>
        <Link to={`/c/${channel.slug}`} className={s.channelLink} onPointerEnter={preload.channel}>
          <ChannelIcon channel={channel} size={40} />
          <span className={s.channelBody}>
            <span className={s.channelName}>{channel.name}</span>
            <span className={s.channelMeta}>
              c/{channel.slug} · 멤버 {compact(channel.memberCount)} · 글 {compact(channel.postCount)}
              {channel.description && ` · ${plainText(channel.description)}`}
            </span>
          </span>
        </Link>
        {action}
      </div>
    </li>
  );
}

function LeaveButton({ channel }: { channel: ChannelSummary }) {
  const membership = useMembership(channel.slug);
  return (
    <button
      type="button"
      className={cn(ui.button, ui.ghost, ui.small)}
      disabled={membership.isPending}
      onClick={() => {
        if (!confirm(`'${channel.name}' 채널 팔로우를 취소할까요?\n팔로우를 취소하면 이 채널에 글을 쓸 수 없어요.`)) return;
        membership.mutate(false, { onSuccess: () => toast('채널 팔로우를 취소했어요'), onError: (e) => toast(e.message) });
      }}
    >
      팔로우 취소
    </button>
  );
}

function UnbookmarkButton({ channel }: { channel: ChannelSummary }) {
  const bookmark = useBookmark(channel.slug);
  return (
    <button
      type="button"
      className={cn(ui.button, ui.ghost, ui.small)}
      disabled={bookmark.isPending}
      onClick={() => bookmark.mutate(false, { onSuccess: () => toast('북마크를 해제했어요') })}
    >
      북마크 해제
    </button>
  );
}

export default function MyChannelsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'bookmarks' ? 'bookmarks' : 'joined';
  const joined = useMyChannels(true);
  const bookmarks = useBookmarkedChannels(true);
  const query = tab === 'joined' ? joined : bookmarks;

  return (
    <>
      <div className={s.head}>
        <h1 className={s.title}>팔로우 · 북마크 채널</h1>
        <p className={s.desc}>팔로우한 채널에는 글을 쓸 수 있고, 북마크한 채널은 여기서 빠르게 찾아갈 수 있어요.</p>
      </div>
      <section className={ui.card}>
        <div className={ui.tabs} role="tablist" style={{ padding: '0 14px' }}>
          <button
            type="button"
            role="tab"
            className={ui.tab}
            aria-selected={tab === 'joined'}
            onClick={() => setParams({}, { replace: true })}
          >
            팔로우한 채널 {joined.data ? joined.data.length : ''}
          </button>
          <button
            type="button"
            role="tab"
            className={ui.tab}
            aria-selected={tab === 'bookmarks'}
            onClick={() => setParams({ tab: 'bookmarks' }, { replace: true })}
          >
            북마크 {bookmarks.data ? bookmarks.data.length : ''}
          </button>
        </div>
        {query.isPending ? (
          <div className={ui.spinner} />
        ) : query.data && query.data.length > 0 ? (
          <ul className={s.channelList}>
            {query.data.map((c) => (
              <ChannelRow
                key={c.slug}
                channel={c}
                action={
                  tab === 'bookmarks' ? (
                    <UnbookmarkButton channel={c} />
                  ) : 'owner' in c && c.owner ? (
                    // 만든 채널은 팔로우를 취소할 수 없으니 관리로 보낸다
                    <Link to={`/c/${c.slug}/manage`} className={cn(ui.button, ui.ghost, ui.small)}>
                      채널 관리
                    </Link>
                  ) : (
                    <LeaveButton channel={c} />
                  )
                }
              />
            ))}
          </ul>
        ) : (
          <div className={ui.empty}>
            {tab === 'joined' ? '아직 팔로우한 채널이 없어요' : '북마크한 채널이 없어요. 채널 페이지의 ☆ 버튼으로 추가할 수 있어요'}
            <div style={{ marginTop: 16 }}>
              <Link to="/channels" className={cn(ui.button, ui.secondary, ui.small)}>
                채널 둘러보기
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
