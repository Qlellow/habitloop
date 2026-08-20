import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

export async function POST(req: NextRequest) {
  const { mode, email, password, nickname } = await req.json();
  const path = mode === 'signup' ? '/auth/signup' : '/auth/login';
  const body = mode === 'signup' ? { email, password, nickname } : { email, password };

  try {
    const data = await apiFetch(path, undefined, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const res = NextResponse.json({ ok: true, user: data.user });
    res.cookies.set('token', data.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
  }
}
