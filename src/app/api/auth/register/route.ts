import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { audit, createSession, hashPassword, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';

const Schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/auth/register — open registration (single-team MVP; lock down
// behind an invite flow before exposing beyond your team).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

  const user = await prisma.user.create({
    data: { email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) },
  });
  await audit({ action: 'user.registered', userId: user.id });

  const token = await createSession(user.id);
  const res = NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
