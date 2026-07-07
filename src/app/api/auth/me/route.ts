import { NextResponse } from 'next/server';
import { getSessionUser, unauthorized } from '@/lib/auth';

// GET /api/auth/me
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
