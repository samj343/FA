import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// PATCH /api/outreach/:id/approve — human approval gate.
// Approval marks the draft usable; it still does NOT send anything.
export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const message = await prisma.outreachMessage.findUnique({ where: { id: params.id } });
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const updated = await prisma.outreachMessage.update({
    where: { id: params.id },
    data: { status: 'Approved', approvedByUser: true },
  });
  return NextResponse.json(updated);
}
