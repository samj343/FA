import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { guardCompany } from '@/lib/auth';

// GET /api/companies/:id/audit — activity trail for a deal (most recent first).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'viewer');
  if (guard instanceof Response) return guard;
  const logs = await prisma.auditLog.findMany({
    where: { companyId: params.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json(logs);
}
