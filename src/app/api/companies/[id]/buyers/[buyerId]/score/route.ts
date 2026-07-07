import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getWeights, weightedScore, tierFor } from '@/lib/scoring';

const s10 = z.number().min(1).max(10);
const PatchSchema = z.object({
  productFit: s10.optional(),
  customerOverlap: s10.optional(),
  marketExpansionFit: s10.optional(),
  mAndAHistory: s10.optional(),
  financialCapacity: s10.optional(),
  competitivePressure: s10.optional(),
  integrationFeasibility: s10.optional(),
  rationale: z.string().optional(),
  keyRisk: z.string().optional(),
});

// PATCH /api/companies/:id/buyers/:buyerId/score — manual score edits.
// The weighted score and tier are always recomputed server-side.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; buyerId: string } }
) {
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const buyer = await prisma.buyer.findFirst({
    where: { id: params.buyerId, companyId: params.id },
    include: { score: true },
  });
  if (!buyer) return NextResponse.json({ error: 'Buyer not found' }, { status: 404 });

  const current = buyer.score ?? {
    productFit: 5, customerOverlap: 5, marketExpansionFit: 5, mAndAHistory: 5,
    financialCapacity: 5, competitivePressure: 5, integrationFeasibility: 5,
    rationale: null, keyRisk: null, confidenceScore: 0,
  };
  const merged = {
    productFit: parsed.data.productFit ?? current.productFit,
    customerOverlap: parsed.data.customerOverlap ?? current.customerOverlap,
    marketExpansionFit: parsed.data.marketExpansionFit ?? current.marketExpansionFit,
    mAndAHistory: parsed.data.mAndAHistory ?? current.mAndAHistory,
    financialCapacity: parsed.data.financialCapacity ?? current.financialCapacity,
    competitivePressure: parsed.data.competitivePressure ?? current.competitivePressure,
    integrationFeasibility: parsed.data.integrationFeasibility ?? current.integrationFeasibility,
  };
  const weights = await getWeights();
  const ws = weightedScore(merged, weights);

  const score = await prisma.buyerScore.upsert({
    where: { buyerId: buyer.id },
    create: {
      buyerId: buyer.id,
      ...merged,
      weightedScore: ws,
      tier: tierFor(ws),
      rationale: parsed.data.rationale,
      keyRisk: parsed.data.keyRisk,
      manuallyEdited: true,
    },
    update: {
      ...merged,
      weightedScore: ws,
      tier: tierFor(ws),
      ...(parsed.data.rationale !== undefined ? { rationale: parsed.data.rationale } : {}),
      ...(parsed.data.keyRisk !== undefined ? { keyRisk: parsed.data.keyRisk } : {}),
      manuallyEdited: true,
    },
  });
  return NextResponse.json(score);
}
