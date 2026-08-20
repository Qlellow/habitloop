'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function createHabit(formData: FormData) {
  const token = cookies().get('token')?.value;
  const title = String(formData.get('title') ?? '').trim();
  const emoji = String(formData.get('emoji') ?? '').trim();
  if (!token || !title) return;

  await apiFetch('/habits', token, {
    method: 'POST',
    body: JSON.stringify({ title, emoji: emoji || undefined }),
  });
  revalidatePath('/habits');
}

export async function checkIn(habitId: number) {
  const token = cookies().get('token')?.value;
  if (!token) return;
  await apiFetch(`/habits/${habitId}/checkins`, token, { method: 'POST', body: JSON.stringify({}) });
  revalidatePath('/habits');
}
