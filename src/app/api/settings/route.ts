import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSettings, weightedScore, tierFor } from '@/lib/scoring';
import { audit, getSessionUser, unauthorized } from '@/lib/auth';

const w = z.number().min(0).max(1);
const PatchSchema = z.object({
  weightProductFit: w.optional(),
  weightCustomerOverlap: w.optional(),
  weightMarketExpansion: w.optional(),
  weightMAndAHistory: w.optional(),
  weightFinancialCapacity: w.optional(),
  weightCompetitivePressure: w.optional(),
  weightIntegration: w.optional(),
  outreachTone: z.enum(['banker', 'warm', 'direct']).optional(),
  confidentialityLevel: z.enum(['high', 'medium', 'low']).optional(),
  defaultReportFormat: z.enum(['markdown', 'csv']).optional(),
  globalExcludedBuyers: z.array(z.string()).optional(),
  minScoreThreshold: z.number().min(0).max(10).optional(),
});

export async function GET() {
  if (!(await getSessionUser())) return unauthorized();
  return NextResponse.json(await getSettings());
}

// PATCH /api/settings — update weights etc. Recomputes every stored weighted
// score so the ranked list stays consistent with the new weights.
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { globalExcludedBuyers, ...rest } = parsed.data;
  await getSettings(); // ensure row exists
  const settings = await prisma.settings.update({
    where: { id: 'default' },
    data: {
      ...rest,
      ...(globalExcludedBuyers !== undefined
        ? { globalExcludedBuyers: JSON.stringify(globalExcludedBuyers) }
        : {}),
    },
  });

  const weights = {
    productFit: settings.weightProductFit,
    customerOverlap: settings.weightCustomerOverlap,
    marketExpansionFit: settings.weightMarketExpansion,
    mAndAHistory: settings.weightMAndAHistory,
    financialCapacity: settings.weightFinancialCapacity,
    competitivePressure: settings.weightCompetitivePressure,
    integrationFeasibility: settings.weightIntegration,
  };
  const scores = await prisma.buyerScore.findMany();
  for (const s of scores) {
    const ws = weightedScore(
      {
        productFit: s.productFit,
        customerOverlap: s.customerOverlap,
        marketExpansionFit: s.marketExpansionFit,
        mAndAHistory: s.mAndAHistory,
        financialCapacity: s.financialCapacity,
        competitivePressure: s.competitivePressure,
        integrationFeasibility: s.integrationFeasibility,
      },
      weights
    );
    await prisma.buyerScore.update({
      where: { id: s.id },
      data: { weightedScore: ws, tier: tierFor(ws) },
    });
  }
  await audit({ action: 'settings.updated', userId: user.id, detail: parsed.data });
  return NextResponse.json(settings);
}
