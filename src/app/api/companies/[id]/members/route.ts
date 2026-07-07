import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { audit, guardCompany } from '@/lib/auth';

// GET /api/companies/:id/members — deal team (any member can view)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'viewer');
  if (guard instanceof Response) return guard;
  const members = await prisma.dealMember.findMany({
    where: { companyId: params.id },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(members);
}

const AddSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'editor', 'viewer']).default('editor'),
});

// POST /api/companies/:id/members — owner adds a member by email.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'owner');
  if (guard instanceof Response) return guard;

  const body = await req.json().catch(() => null);
  const parsed = AddSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
  });
  if (!target) {
    return NextResponse.json({ error: 'No user with that email — they must register first' }, { status: 404 });
  }
  const member = await prisma.dealMember.upsert({
    where: { companyId_userId: { companyId: params.id, userId: target.id } },
    create: { companyId: params.id, userId: target.id, role: parsed.data.role },
    update: { role: parsed.data.role },
  });
  await audit({
    action: 'member.added_or_updated',
    userId: guard.user.id,
    companyId: params.id,
    targetType: 'member',
    targetId: member.id,
    detail: { email: target.email, role: parsed.data.role },
  });
  return NextResponse.json(member, { status: 201 });
}

const RemoveSchema = z.object({ userId: z.string() });

// DELETE /api/companies/:id/members — owner removes a member (not the last owner).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'owner');
  if (guard instanceof Response) return guard;

  const body = await req.json().catch(() => null);
  const parsed = RemoveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const member = await prisma.dealMember.findUnique({
    where: { companyId_userId: { companyId: params.id, userId: parsed.data.userId } },
  });
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 404 });
  if (member.role === 'owner') {
    const owners = await prisma.dealMember.count({ where: { companyId: params.id, role: 'owner' } });
    if (owners <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last owner' }, { status: 409 });
    }
  }
  await prisma.dealMember.delete({ where: { id: member.id } });
  await audit({
    action: 'member.removed',
    userId: guard.user.id,
    companyId: params.id,
    targetType: 'member',
    targetId: member.id,
    detail: { removedUserId: parsed.data.userId },
  });
  return NextResponse.json({ ok: true });
}
