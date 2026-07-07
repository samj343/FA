// End-to-end smoke test: seeds the demo company if needed, runs the full
// pipeline synchronously, and prints a summary. Uses whatever LLM provider is
// configured (mock by default). Run with: npm run analyze:demo
import { PrismaClient } from '@prisma/client';
import { runFullAnalysis, PIPELINE_STEPS } from '../src/lib/orchestrator';

const prisma = new PrismaClient();

async function main() {
  let company = await prisma.targetCompany.findFirst({ where: { name: 'ExampleAI' } });
  if (!company) {
    console.log('Demo company missing — run `npm run db:seed` first.');
    process.exit(1);
  }

  const run = await prisma.analysisRun.create({
    data: {
      companyId: company.id,
      status: 'running',
      steps: JSON.stringify(PIPELINE_STEPS.map((s) => ({ ...s, status: 'pending' }))),
      provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'mock',
    },
  });

  console.log(`Running full analysis for ${company.name} (run ${run.id})...`);
  const started = Date.now();
  await runFullAnalysis(company.id, run.id);
  console.log(`Pipeline finished in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);

  const buyers = await prisma.buyer.count({ where: { companyId: company.id } });
  const scored = await prisma.buyerScore.count();
  const tier1 = await prisma.buyerScore.count({ where: { tier: 'Tier 1' } });
  const theses = await prisma.buyerThesis.count();
  const outreach = await prisma.outreachMessage.count({ where: { companyId: company.id } });
  const report = await prisma.report.findFirst({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
  });

  console.log('Results:');
  console.log(`  Buyers identified:   ${buyers}`);
  console.log(`  Buyers scored:       ${scored} (Tier 1: ${tier1})`);
  console.log(`  Theses written:      ${theses}`);
  console.log(`  Outreach drafts:     ${outreach}`);
  console.log(`  Report:              ${report ? `${report.markdown.length} chars of markdown` : 'MISSING'}`);

  const top = await prisma.buyer.findMany({
    where: { companyId: company.id, score: { isNot: null } },
    include: { score: true },
    orderBy: { score: { weightedScore: 'desc' } },
    take: 5,
  });
  console.log('\nTop 5 buyers:');
  for (const b of top) {
    console.log(`  ${b.score!.weightedScore.toFixed(2)}  ${b.score!.tier}  ${b.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
