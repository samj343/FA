// Seed: default settings + an example target company ready to analyze.
// Run with: npm run db:seed
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });

  const existing = await prisma.targetCompany.findFirst({ where: { name: 'ExampleAI' } });
  if (!existing) {
    await prisma.targetCompany.create({
      data: {
        name: 'ExampleAI',
        website: 'https://exampleai.com',
        description:
          'ExampleAI provides AI customer support automation for mid-market SaaS companies. ' +
          'Its platform resolves Tier-1 support tickets autonomously and drafts responses for complex cases, ' +
          'integrating with major helpdesk and CRM systems.',
        sector: 'AI customer support software',
        financialNotes: '$2.1M ARR, ~80% YoY growth, 78% gross margin, ~$90k monthly net burn, 14 months runway.',
        customerNotes: '65 customers, mostly 100-1000 employee SaaS companies; top 5 customers ≈ 30% of ARR.',
        founderNotes: 'Founders open to strategic exit; prefer buyers who will keep the team together.',
        marketNotes: 'Sees increasing competition from helpdesk incumbents adding native AI features.',
        preferredBuyerTypes: 'Strategic acquirers and PE-backed platforms',
        excludedBuyers: JSON.stringify(['Foxglove Labs']),
        confidentialityLevel: 'high',
      },
    });
    console.log('Seeded example company "ExampleAI".');
  } else {
    console.log('Example company already present — skipping.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
