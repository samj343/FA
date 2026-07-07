import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { guardCompany } from '@/lib/auth';

// GET /api/companies/:id/buyers — buyer universe with research/score/thesis.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'viewer');
  if (guard instanceof Response) return guard;
  const buyers = await prisma.buyer.findMany({
    where: { companyId: params.id },
    include: { research: true, score: true, thesis: true, contacts: true },
  });
  const sorted = buyers.sort(
    (a, b) => (b.score?.weightedScore ?? -1) - (a.score?.weightedScore ?? -1)
  );
  return NextResponse.json(sorted);
}
