import { useAuth } from '@loop/shared';
import { WeeklyRecapView } from '../../components/WeeklyRecap';

/** 마이페이지 > 주간 회고: 내 한 주를 카드로 보고 공유한다 */
export default function MyRecapPage() {
  const { user } = useAuth();
  return user ? <WeeklyRecapView userId={user.id} /> : null;
}
