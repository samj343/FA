import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/companies/:id — full company profile incl. artifacts
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const company = await prisma.targetCompany.findUnique({
    where: { id: params.id },
    include: {
      decks: { select: { id: true, filename: true, pageCount: true, createdAt: true } },
      artifacts: true,
      runs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const artifacts: Record<string, unknown> = {};
  for (const a of company.artifacts) artifacts[a.kind] = JSON.parse(a.json);
  return NextResponse.json({ ...company, artifacts });
}
