'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function toggleLike(checkInId: number) {
  const token = cookies().get('token')?.value;
  if (!token) return;
  await apiFetch(`/checkins/${checkInId}/like`, token, { method: 'POST' });
  revalidatePath('/feed');
}
