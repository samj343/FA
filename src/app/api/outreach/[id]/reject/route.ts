import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { audit, guardCompany } from '@/lib/auth';

// PATCH /api/outreach/:id/reject
export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const message = await prisma.outreachMessage.findUnique({ where: { id: params.id } });
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const guard = await guardCompany(message.companyId, 'editor');
  if (guard instanceof Response) return guard;

  const updated = await prisma.outreachMessage.update({
    where: { id: params.id },
    data: { status: 'Rejected', approvedByUser: false },
  });
  await audit({
    action: 'outreach.rejected',
    userId: guard.user.id,
    companyId: message.companyId,
    targetType: 'outreach',
    targetId: message.id,
    detail: { messageType: message.messageType },
  });
  return NextResponse.json(updated);
}
