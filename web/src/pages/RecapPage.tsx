import { useParams, useSearchParams } from 'react-router-dom';
import { isUserId, useWeeklyRecap } from '@loop/shared';
import { Page } from '../components/Layout';
import { WeeklyRecapView } from '../components/WeeklyRecap';
import { useNoIndex, usePageTitle } from '../lib/title';
import NotFoundPage from './NotFoundPage';

/** 주간 회고 (누구나: 공유 링크로 받은 사람도). 공개 채널 활동만 담긴다 */
export default function RecapPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  // 제목용 (카드와 같은 요청이라 한 번만 받는다)
  const { data } = useWeeklyRecap(id, params.get('week') ?? undefined, params.get('s') ?? undefined);
  usePageTitle(data && `${data.user.nickname}님의 주간 회고`);
  useNoIndex();
  if (!isUserId(id)) return <NotFoundPage />;
  return (
    <Page variant="narrow">
      <WeeklyRecapView userId={id} />
    </Page>
  );
}
