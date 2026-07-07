import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { audit, guardCompany } from '@/lib/auth';
import { resumeAnalysisRun } from '@/lib/orchestrator';

// POST /api/runs/:runId/retry — resume a failed run from its failed step.
// Completed steps are skipped; only the failed/pending agents re-run.
export async function POST(_req: Request, { params }: { params: { runId: string } }) {
  const run = await prisma.analysisRun.findUnique({ where: { id: params.runId } });
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  const guard = await guardCompany(run.companyId, 'editor');
  if (guard instanceof Response) return guard;

  if (run.status === 'running' || run.status === 'queued') {
    return NextResponse.json({ runId: run.id, alreadyRunning: true });
  }
  if (run.status === 'done') {
    return NextResponse.json({ error: 'Run already completed — start a new analysis instead' }, { status: 409 });
  }

  await resumeAnalysisRun(run.id);
  await audit({
    action: 'analysis.retried',
    userId: guard.user.id,
    companyId: run.companyId,
    targetType: 'run',
    targetId: run.id,
  });
  return NextResponse.json({ runId: run.id }, { status: 202 });
}
