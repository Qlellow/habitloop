'use client';

import { toggleLike } from './actions';

export default function LikeButton({ checkInId, likeCount }: { checkInId: number; likeCount: number }) {
  return (
    <form action={toggleLike.bind(null, checkInId)}>
      <button type="submit">👏 {likeCount}</button>
    </form>
  );
}
