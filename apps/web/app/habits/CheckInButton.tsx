'use client';

import { checkIn } from './actions';

export default function CheckInButton({ habitId }: { habitId: number }) {
  return (
    <form action={checkIn.bind(null, habitId)}>
      <button type="submit">오늘 체크인 ✅</button>
    </form>
  );
}
