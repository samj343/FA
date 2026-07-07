import { redirect, notFound } from 'next/navigation';
import { getSessionUser, memberRole } from './auth';
import type { User } from '@prisma/client';

/** Server-component guard: redirects to /login when unauthenticated. */
export async function requireUserPage(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/** Server-component guard for company pages: must be a deal member. */
export async function requireMemberPage(companyId: string): Promise<{ user: User; role: string }> {
  const user = await requireUserPage();
  const role = await memberRole(companyId, user.id);
  if (!role) notFound();
  return { user, role };
}
