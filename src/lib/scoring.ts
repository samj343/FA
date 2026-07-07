import { prisma } from './db';

// Weighted scoring per the product spec. Weights are user-editable in
// Settings; tiers are fixed policy.

export interface ScoreWeights {
  productFit: number;
  customerOverlap: number;
  marketExpansionFit: number;
  mAndAHistory: number;
  financialCapacity: number;
  competitivePressure: number;
  integrationFeasibility: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  productFit: 0.25,
  customerOverlap: 0.15,
  marketExpansionFit: 0.15,
  mAndAHistory: 0.15,
  financialCapacity: 0.1,
  competitivePressure: 0.1,
  integrationFeasibility: 0.1,
};

export interface ScoreInputs {
  productFit: number;
  customerOverlap: number;
  marketExpansionFit: number;
  mAndAHistory: number;
  financialCapacity: number;
  competitivePressure: number;
  integrationFeasibility: number;
}

export function weightedScore(s: ScoreInputs, w: ScoreWeights = DEFAULT_WEIGHTS): number {
  const total =
    s.productFit * w.productFit +
    s.customerOverlap * w.customerOverlap +
    s.marketExpansionFit * w.marketExpansionFit +
    s.mAndAHistory * w.mAndAHistory +
    s.financialCapacity * w.financialCapacity +
    s.competitivePressure * w.competitivePressure +
    s.integrationFeasibility * w.integrationFeasibility;
  return Math.round(total * 100) / 100;
}

// Tier 1: >= 8.0 | Tier 2: 6.5-8.0 | Tier 3: < 6.5
export function tierFor(score: number): string {
  if (score >= 8.0) return 'Tier 1';
  if (score >= 6.5) return 'Tier 2';
  return 'Tier 3';
}

export async function getWeights(): Promise<ScoreWeights> {
  const s = await prisma.settings.findUnique({ where: { id: 'default' } });
  if (!s) return DEFAULT_WEIGHTS;
  return {
    productFit: s.weightProductFit,
    customerOverlap: s.weightCustomerOverlap,
    marketExpansionFit: s.weightMarketExpansion,
    mAndAHistory: s.weightMAndAHistory,
    financialCapacity: s.weightFinancialCapacity,
    competitivePressure: s.weightCompetitivePressure,
    integrationFeasibility: s.weightIntegration,
  };
}

export async function getSettings() {
  return (
    (await prisma.settings.findUnique({ where: { id: 'default' } })) ??
    (await prisma.settings.create({ data: { id: 'default' } }))
  );
}
