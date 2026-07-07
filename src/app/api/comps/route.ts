import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { audit, getSessionUser, unauthorized } from '@/lib/auth';

const CreateSchema = z.object({
  acquirer: z.string().min(1),
  target: z.string().min(1),
  sector: z.string().min(1),
  announcedYear: z.number().int().min(1990).max(2100).optional(),
  enterpriseValue: z.string().optional(),
  revenueOrArr: z.string().optional(),
  multiple: z.string().optional(),
  dealType: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  illustrative: z.boolean().default(false),
});

// GET /api/comps — the workspace comparable-transactions library.
export async function GET() {
  if (!(await getSessionUser())) return unauthorized();
  const comps = await prisma.comparableTransaction.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(comps);
}

// POST /api/comps — add a comparable transaction.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const comp = await prisma.comparableTransaction.create({ data: parsed.data });
  await audit({
    action: 'comp.created',
    userId: user.id,
    targetType: 'comp',
    targetId: comp.id,
    detail: { acquirer: comp.acquirer, target: comp.target },
  });
  return NextResponse.json(comp, { status: 201 });
}

const DeleteSchema = z.object({ id: z.string() });

// DELETE /api/comps — remove a comp by id.
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const comp = await prisma.comparableTransaction.findUnique({ where: { id: parsed.data.id } });
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.comparableTransaction.delete({ where: { id: comp.id } });
  await audit({
    action: 'comp.deleted',
    userId: user.id,
    targetType: 'comp',
    targetId: comp.id,
    detail: { acquirer: comp.acquirer, target: comp.target },
  });
  return NextResponse.json({ ok: true });
}
