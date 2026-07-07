import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startAnalysisRun } from '@/lib/orchestrator';

// POST /api/companies/:id/run-analysis — kicks off the full agent pipeline.
// Returns the run id immediately; progress is polled via analysis-status.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const company = await prisma.targetCompany.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  const existing = await prisma.analysisRun.findFirst({
    where: { companyId: params.id, status: 'running' },
  });
  if (existing) {
    return NextResponse.json({ runId: existing.id, alreadyRunning: true });
  }

  const runId = await startAnalysisRun(params.id);
  return NextResponse.json({ runId }, { status: 202 });
}
