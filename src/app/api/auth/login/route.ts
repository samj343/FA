import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { audit, createSession, sessionCookieOptions, SESSION_COOKIE, verifyPassword } from '@/lib/auth';

const Schema = z.object({ email: z.string().email(), password: z.string() });

// POST /api/auth/login
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  await audit({ action: 'user.login', userId: user.id });

  const token = await createSession(user.id);
  const res = NextResponse.json({ id: user.id, email: user.email, name: user.name });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
