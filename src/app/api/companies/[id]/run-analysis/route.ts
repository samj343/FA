import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startAnalysisRun } from '@/lib/orchestrator';
import { audit, guardCompany } from '@/lib/auth';

// POST /api/companies/:id/run-analysis — queue the full agent pipeline.
// Returns the run id immediately; progress is polled via analysis-status.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'editor');
  if (guard instanceof Response) return guard;
  const company = await prisma.targetCompany.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  const existing = await prisma.analysisRun.findFirst({
    where: { companyId: params.id, status: { in: ['running', 'queued'] } },
  });
  if (existing) {
    return NextResponse.json({ runId: existing.id, alreadyRunning: true });
  }

  const runId = await startAnalysisRun(params.id);
  await audit({
    action: 'analysis.started',
    userId: guard.user.id,
    companyId: params.id,
    targetType: 'run',
    targetId: runId,
  });
  return NextResponse.json({ runId }, { status: 202 });
}
