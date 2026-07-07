import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/companies/:id/outreach-list — all outreach drafts for a company.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const messages = await prisma.outreachMessage.findMany({
    where: { companyId: params.id },
    orderBy: [{ messageType: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json(messages);
}
