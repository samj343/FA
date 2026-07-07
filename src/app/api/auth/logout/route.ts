import { NextResponse } from 'next/server';
import { destroySession, SESSION_COOKIE } from '@/lib/auth';

// POST /api/auth/logout
export async function POST() {
  await destroySession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
