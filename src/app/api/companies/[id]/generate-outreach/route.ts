import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateOutreachDrafts } from '@/lib/orchestrator';
import { audit, guardCompany } from '@/lib/auth';

// POST /api/companies/:id/generate-outreach — (re)draft outreach materials.
// Drafts land as "Needs Review"; approved/sent messages are never touched.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'editor');
  if (guard instanceof Response) return guard;
  const company = await prisma.targetCompany.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  try {
    const created = await generateOutreachDrafts(params.id);
    await audit({
      action: 'outreach.regenerated',
      userId: guard.user.id,
      companyId: params.id,
      detail: { created },
    });
    return NextResponse.json({ created });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
