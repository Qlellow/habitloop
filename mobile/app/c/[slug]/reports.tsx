import { useLayoutEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { REPORT_REASONS, timeAgo, useChannel, useChannelReports, useReportAction, type ReportAction, type ReportGroup } from '@loop/shared';
import { Button, Chip, Empty, Loading } from '../../../src/ui';
import { toast } from '../../../src/Toast';

const DONE_LABEL: Record<string, string> = { hidden: '숨김', dismissed: '문제 없음' };
const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

/** 신고함 한 줄: 신고된 글 · 댓글, 사유, 처리 버튼 */
function Row({ slug, r }: { slug: string; r: ReportGroup }) {
  const act = useReportAction(slug);
  const what = r.commentId ? '댓글' : '글';
  const run = (a: ReportAction) => {
    const go = () =>
      act.mutate(
        { postId: r.postId, commentId: r.commentId, action: a },
        {
          onSuccess: () =>
            toast({ hide: `${what}을 숨겼어요`, unhide: `${what}을 다시 보이게 했어요`, delete: `${what}을 지웠어요`, dismiss: '문제 없음으로 처리했어요' }[a]),
          onError: (e) => toast(e.message),
        },
      );
    if (a === 'delete') {
      Alert.alert(`이 ${what}을 지울까요?`, '지우면 되돌릴 수 없어요.', [
        { text: '취소', style: 'cancel' },
        { text: '지우기', style: 'destructive', onPress: go },
      ]);
    } else go();
  };
  return (
    <View className="px-5 py-4 gap-1.5">
      <View className="flex-row flex-wrap items-center gap-x-1.5">
        <Text className="text-[13px] font-bold text-danger">신고 {r.count.toLocaleString()}건</Text>
        <Text className="text-[13px] text-fg-sub">· {r.reasons.map(reasonLabel).join(', ')}</Text>
        <Text className="text-[13px] text-fg-weak">· {timeAgo(r.lastReportedAt)}</Text>
        {r.status !== 'open' ? <Text className="text-[13px] font-semibold text-fg-weak">· {DONE_LABEL[r.status]}</Text> : null}
      </View>
      <Pressable onPress={() => router.push(`/post/${r.postId}`)} className="active:opacity-60">
        <Text className="text-[15px] font-semibold text-fg-strong" numberOfLines={1}>
          {r.commentId ? `댓글 · ${r.postTitle}` : r.postTitle}
        </Text>
        {r.excerpt ? (
          <Text className="mt-0.5 text-sm text-fg-sub" numberOfLines={2}>
            {r.commentId ? `“${r.excerpt}”` : r.excerpt}
          </Text>
        ) : null}
      </Pressable>
      <Text className="text-[13px] text-fg-weak">쓴 사람 {r.author.nickname}</Text>
      {r.details.map((d, i) => (
        <Text key={i} className="text-[13px] text-fg-sub">
          · {d}
        </Text>
      ))}
      <View className="flex-row flex-wrap gap-2 mt-1.5">
        {r.hidden ? (
          <Button title="숨김 풀기" variant="ghost" size="sm" disabled={!r.canAct || act.isPending} onPress={() => run('unhide')} />
        ) : r.canAct ? (
          <>
            <Button title="숨기기" variant="secondary" size="sm" disabled={act.isPending} onPress={() => run('hide')} />
            <Button title="지우기" variant="danger" size="sm" disabled={act.isPending} onPress={() => run('delete')} />
          </>
        ) : null}
        {r.status === 'open' ? <Button title="문제 없음" variant="ghost" size="sm" disabled={act.isPending} onPress={() => run('dismiss')} /> : null}
      </View>
      {!r.canAct ? <Text className="text-[13px] text-fg-weak">나보다 높은 운영진의 {what}이라 숨기거나 지울 수 없어요</Text> : null}
    </View>
  );
}

/** 채널 신고함 (운영진만): 처리 전 / 처리함 */
export default function ReportsScreen() {
  const slug = useLocalSearchParams<{ slug: string }>().slug ?? '';
  const navigation = useNavigation();
  const { data: channel, isPending } = useChannel(slug);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const reports = useChannelReports(slug, tab);

  useLayoutEffect(() => {
    navigation.setOptions({ title: channel ? `${channel.name} 신고함` : '신고함' });
  }, [navigation, channel]);

  if (isPending) return <Loading />;
  if (!channel?.staff) return <Redirect href={`/c/${slug}`} />;

  return (
    <FlatList
      data={reports.data ?? []}
      keyExtractor={(r) => `${r.postId}-${r.commentId ?? 0}`}
      renderItem={({ item }) => <Row slug={slug} r={item} />}
      ItemSeparatorComponent={() => <View className="h-px bg-line mx-5" />}
      ListHeaderComponent={
        <View className="gap-3 px-5 pt-4 pb-3 border-b border-line">
          <View className="flex-row gap-2">
            <Chip label={`처리 전${channel.reportCount ? ` ${channel.reportCount}` : ''}`} selected={tab === 'open'} onPress={() => setTab('open')} />
            <Chip label="처리함" selected={tab === 'done'} onPress={() => setTab('done')} />
          </View>
          <Text className="text-[13px] leading-[19px] text-fg-weak">
            숨기면 쓴 사람과 운영진에게만 보여요. 지우면 되돌릴 수 없어요. 숨기기 · 지우기는 나보다 아래 역할의 글 · 댓글만 할 수 있어요.
          </Text>
        </View>
      }
      ListEmptyComponent={reports.isPending ? <Loading /> : <Empty>{tab === 'open' ? '처리할 신고가 없어요' : '처리한 신고가 없어요'}</Empty>}
      className="bg-surface"
    />
  );
}
