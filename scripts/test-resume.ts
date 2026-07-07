// Smoke test for resumable runs: simulates a run that crashed during buyer
// research (first 6 steps done), resumes it, and verifies completed steps are
// skipped (existing buyer rows survive because discovery is not re-run).
// Run with: npx tsx scripts/test-resume.ts   (after analyze:demo or a UI run)
import { PrismaClient } from '@prisma/client';
import { PIPELINE_STEPS, resumeAnalysisRun } from '../src/lib/orchestrator';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.targetCompany.findFirstOrThrow({
    where: { buyers: { some: {} } },
    orderBy: { createdAt: 'desc' },
  });
  const buyersBefore = await prisma.buyer.findMany({
    where: { companyId: company.id },
    select: { id: true },
  });

  const doneKeys = new Set([
    'deck_intake', 'company_profile', 'financial_analysis',
    'market_map', 'competitive_landscape', 'buyer_discovery',
  ]);
  const steps = PIPELINE_STEPS.map((s) => ({
    ...s,
    status: doneKeys.has(s.key) ? 'done' : s.key === 'buyer_research' ? 'error' : 'pending',
  }));
  const run = await prisma.analysisRun.create({
    data: {
      companyId: company.id,
      status: 'error',
      error: 'simulated crash',
      steps: JSON.stringify(steps),
      provider: 'mock',
    },
  });

  console.log(`Resuming simulated failed run for ${company.name}...`);
  await resumeAnalysisRun(run.id);
  for (let i = 0; i < 240; i++) {
    const r = await prisma.analysisRun.findUniqueOrThrow({ where: { id: run.id } });
    if (r.status === 'done' || r.status === 'error') {
      console.log('resume result:', r.status, r.error ?? '');
      const parsed = JSON.parse(r.steps) as { key: string; status: string }[];
      console.log('steps:', parsed.map((s) => `${s.key}=${s.status}`).join(' '));
      break;
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  const buyersAfter = await prisma.buyer.findMany({
    where: { companyId: company.id },
    select: { id: true },
  });
  const preserved =
    buyersBefore.length > 0 && buyersBefore.every((b) => buyersAfter.some((a) => a.id === b.id));
  console.log(
    'buyer rows preserved across resume (discovery skipped):',
    preserved,
    `(${buyersBefore.length} -> ${buyersAfter.length})`
  );
  if (!preserved) process.exit(1);
}
main().finally(() => prisma.$disconnect());
