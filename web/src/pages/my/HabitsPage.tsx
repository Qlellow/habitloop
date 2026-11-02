import { HabitList } from '../../components/Habits';
import s from './my.styles';

/** 마이페이지 > 습관: 만들고 매일 체크하면 연속 일수 · 잔디가 쌓이고 펫이 자란다 */
export default function HabitsPage() {
  return (
    <>
      <div className={s.head}>
        <h1 className={s.title}>습관</h1>
        <p className={s.desc}>매일 체크하면 연속 일수와 잔디가 쌓이고, 체크할 때마다 펫이 경험치를 받아요. 깜빡한 날은 이틀 전까지 채울 수 있어요.</p>
      </div>
      <HabitList />
    </>
  );
}
