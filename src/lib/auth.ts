import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { prisma } from './db';
import type { User } from '@prisma/client';

// Cookie-session auth with scrypt password hashing (no external deps).
// Sessions live in the DB; middleware does a cheap cookie-presence check and
// every handler/page does the real lookup via getSessionUser().

const scrypt = promisify(scryptCb) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export { SESSION_COOKIE } from './auth-edge';
import { SESSION_COOKIE } from './auth-edge';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

// ------------------------------------------------------------- passwords
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const hash = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

// -------------------------------------------------------------- sessions
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await prisma.session.create({
    data: { token, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return token;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  };
}

/** Current user from the session cookie, or null. */
export async function getSessionUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
}

// ------------------------------------------------------------ API guards
export function unauthorized() {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
export function forbidden(msg = 'You do not have permission to do this') {
  return NextResponse.json({ error: msg }, { status: 403 });
}

const ROLE_RANK: Record<string, number> = { viewer: 0, editor: 1, owner: 2 };

/**
 * Membership check for a deal. Returns the member's role or null.
 * minRole: viewer (read) | editor (edit/approve) | owner (manage members).
 */
export async function memberRole(companyId: string, userId: string): Promise<string | null> {
  const m = await prisma.dealMember.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  return m?.role ?? null;
}

export async function requireMember(
  companyId: string,
  userId: string,
  minRole: 'viewer' | 'editor' | 'owner' = 'viewer'
): Promise<{ ok: true; role: string } | { ok: false; res: NextResponse }> {
  const role = await memberRole(companyId, userId);
  if (!role) return { ok: false, res: forbidden('You are not a member of this deal') };
  if ((ROLE_RANK[role] ?? -1) < ROLE_RANK[minRole]) {
    return { ok: false, res: forbidden(`This action requires the ${minRole} role`) };
  }
  return { ok: true, role };
}

/**
 * One-call guard for company-scoped routes: authenticated + member with at
 * least minRole. Returns a NextResponse (401/403) on failure.
 */
export async function guardCompany(
  companyId: string,
  minRole: 'viewer' | 'editor' | 'owner' = 'viewer'
): Promise<{ user: User; role: string } | NextResponse> {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const check = await requireMember(companyId, user.id, minRole);
  if (!check.ok) return check.res;
  return { user, role: check.role };
}

// -------------------------------------------------------------- audit log
export async function audit(entry: {
  action: string;
  userId?: string | null;
  companyId?: string | null;
  targetType?: string;
  targetId?: string;
  detail?: unknown;
}): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        action: entry.action,
        userId: entry.userId ?? null,
        companyId: entry.companyId ?? null,
        targetType: entry.targetType,
        targetId: entry.targetId,
        detail: entry.detail === undefined ? null : JSON.stringify(entry.detail),
      },
    })
    .catch((err) => console.error('audit log write failed:', err));
}
