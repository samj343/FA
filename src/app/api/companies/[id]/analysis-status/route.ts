import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { guardCompany } from '@/lib/auth';

// GET /api/companies/:id/analysis-status — latest run + step states.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'viewer');
  if (guard instanceof Response) return guard;
  const run = await prisma.analysisRun.findFirst({
    where: { companyId: params.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!run) return NextResponse.json({ status: 'none' });
  return NextResponse.json({
    runId: run.id,
    status: run.status,
    currentStep: run.currentStep,
    provider: run.provider,
    error: run.error,
    steps: JSON.parse(run.steps),
  });
}
