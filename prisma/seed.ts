// Seed: default settings, an admin user, an example target company, and a
// few clearly-labelled illustrative comparable transactions.
// Run with: npm run db:seed
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

async function main() {
  await prisma.settings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });

  // Default admin login (change the password after first sign-in).
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'changeme123';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: { email: adminEmail, name: 'Admin', passwordHash: hashPassword(adminPassword) },
    });
    console.log(`Seeded admin user ${adminEmail} (password: ${adminPassword})`);
  }

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
        members: { create: { userId: admin.id, role: 'owner' } },
      },
    });
    console.log('Seeded example company "ExampleAI".');
  } else {
    // Make sure the admin has access to the existing demo company.
    await prisma.dealMember.upsert({
      where: { companyId_userId: { companyId: existing.id, userId: admin.id } },
      create: { companyId: existing.id, userId: admin.id, role: 'owner' },
      update: {},
    });
    console.log('Example company already present — ensured admin membership.');
  }

  // Illustrative comparable transactions (fictional — labelled as such).
  if ((await prisma.comparableTransaction.count()) === 0) {
    await prisma.comparableTransaction.createMany({
      data: [
        {
          acquirer: 'Meridian Systems Group', target: 'HelpDeskly',
          sector: 'customer support software', announcedYear: 2025,
          enterpriseValue: '$140M', revenueOrArr: '$18M ARR', multiple: '~7.8x ARR',
          dealType: 'tuck-in', source: 'Illustrative example', notes: 'Fictional comp for demo purposes.',
          illustrative: true,
        },
        {
          acquirer: 'Atlas Capital Platform', target: 'TicketFlow AI',
          sector: 'AI customer support', announcedYear: 2024,
          enterpriseValue: '$60M', revenueOrArr: '$9M ARR', multiple: '~6.5x ARR',
          dealType: 'PE bolt-on', source: 'Illustrative example', notes: 'Fictional comp for demo purposes.',
          illustrative: true,
        },
        {
          acquirer: 'Vantage Cloud Corp', target: 'AgentAssist Labs',
          sector: 'enterprise AI workflow', announcedYear: 2025,
          enterpriseValue: 'Undisclosed', revenueOrArr: 'Pre-revenue', multiple: 'Strategic / acquihire',
          dealType: 'acquihire', source: 'Illustrative example', notes: 'Fictional comp for demo purposes.',
          illustrative: true,
        },
      ],
    });
    console.log('Seeded 3 illustrative comparable transactions.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
