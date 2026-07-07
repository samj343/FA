import { prisma } from './db';
import { runAgent } from './agents/run';
import { getResearchService } from './research';
import { getWeights, getSettings, weightedScore, tierFor } from './scoring';
import { generateReportMarkdown } from './report';
import { getProvider } from './llm';

// Pipeline step definitions (order matters — this is the workflow).
export const PIPELINE_STEPS = [
  { key: 'deck_intake', label: 'Parsing deck & materials' },
  { key: 'company_profile', label: 'Extracting company profile' },
  { key: 'financial_analysis', label: 'Analyzing financials' },
  { key: 'market_map', label: 'Mapping market' },
  { key: 'competitive_landscape', label: 'Mapping competitive landscape' },
  { key: 'buyer_discovery', label: 'Finding buyers' },
  { key: 'buyer_research', label: 'Researching buyers' },
  { key: 'strategic_fit_scoring', label: 'Scoring buyers' },
  { key: 'valuation', label: 'Valuation & deal logic' },
  { key: 'synergy_thesis', label: 'Writing acquisition theses' },
  { key: 'outreach', label: 'Drafting outreach' },
  { key: 'report', label: 'Building report' },
] as const;

type StepState = { key: string; label: string; status: 'pending' | 'running' | 'done' | 'error' };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }
}

async function saveArtifact(companyId: string, kind: string, data: unknown) {
  const json = JSON.stringify(data);
  await prisma.analysisArtifact.upsert({
    where: { companyId_kind: { companyId, kind } },
    create: { companyId, kind, json },
    update: { json },
  });
}

export async function startAnalysisRun(companyId: string): Promise<string> {
  const steps: StepState[] = PIPELINE_STEPS.map((s) => ({ ...s, status: 'pending' }));
  const run = await prisma.analysisRun.create({
    data: {
      companyId,
      status: 'running',
      steps: JSON.stringify(steps),
      provider: getProvider().name,
    },
  });
  // Fire and forget — the route returns immediately; the UI polls run status.
  runFullAnalysis(companyId, run.id).catch(async (err) => {
    console.error('Analysis run failed:', err);
    await prisma.analysisRun.update({
      where: { id: run.id },
      data: { status: 'error', error: err instanceof Error ? err.message : String(err) },
    });
  });
  return run.id;
}

async function setStep(runId: string, key: string, status: StepState['status']) {
  const run = await prisma.analysisRun.findUniqueOrThrow({ where: { id: runId } });
  const steps: StepState[] = JSON.parse(run.steps);
  const step = steps.find((s) => s.key === key);
  if (step) step.status = status;
  await prisma.analysisRun.update({
    where: { id: runId },
    data: { steps: JSON.stringify(steps), currentStep: status === 'running' ? key : run.currentStep },
  });
}

/**
 * The full agentic workflow. Each stage feeds the next; structured outputs
 * are validated by zod before persistence. Human review happens after the
 * run — nothing here contacts a buyer.
 */
export async function runFullAnalysis(companyId: string, runId: string): Promise<void> {
  const company = await prisma.targetCompany.findUniqueOrThrow({
    where: { id: companyId },
    include: { decks: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const settings = await getSettings();
  const excluded = [
    ...parseJsonArray(company.excludedBuyers),
    ...parseJsonArray(settings.globalExcludedBuyers),
  ];

  const step = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    await setStep(runId, key, 'running');
    try {
      const out = await fn();
      await setStep(runId, key, 'done');
      return out;
    } catch (err) {
      await setStep(runId, key, 'error');
      throw err;
    }
  };

  // -------------------------------------------------- 1. Deck Intake
  const deckText = company.decks[0]?.extractedText ?? '';
  const intake = await step('deck_intake', () =>
    runAgent('deck_intake', {
      company_name: company.name,
      website: company.website,
      description: company.description,
      sector_hint: company.sector,
      deck_text: deckText.slice(0, 120_000),
      financial_notes: company.financialNotes,
      customer_notes: company.customerNotes,
      founder_notes: company.founderNotes,
      market_notes: company.marketNotes,
    })
  );
  await saveArtifact(companyId, 'deck_intake', intake);

  // -------------------------------------------------- 2. Company Profile
  const profile = await step('company_profile', () =>
    runAgent('company_profile', { deck_intake: intake })
  );
  await saveArtifact(companyId, 'company_profile', profile);
  await prisma.targetCompany.update({
    where: { id: companyId },
    data: {
      sector: intake.sector !== 'Not provided' ? intake.sector : company.sector,
      subsector: intake.subsector !== 'Not provided' ? intake.subsector : company.subsector,
      businessModel: profile.business_model,
      productDescription: intake.product_description,
      customerSegments: JSON.stringify(intake.customer_segments),
      revenueModel: intake.revenue_model,
      strategicAssets: JSON.stringify(profile.strategic_value_drivers),
      risks: JSON.stringify(profile.key_risks),
    },
  });

  // -------------------------------------------------- 3. Financial Analysis
  const financial = await step('financial_analysis', () =>
    runAgent('financial_analysis', { deck_intake: intake })
  );
  await saveArtifact(companyId, 'financial_analysis', financial);

  // -------------------------------------------------- 4. Market Map
  const market = await step('market_map', () =>
    runAgent('market_map', { company_profile: profile, deck_intake: intake })
  );
  await saveArtifact(companyId, 'market_map', market);

  // -------------------------------------------------- 5. Competitive Landscape
  const landscape = await step('competitive_landscape', () =>
    runAgent('competitive_landscape', { company_profile: profile, market_map: market })
  );
  await saveArtifact(companyId, 'competitive_landscape', landscape);

  // -------------------------------------------------- 6. Buyer Discovery
  const discovery = await step('buyer_discovery', () =>
    runAgent('buyer_discovery', {
      company_profile: profile,
      market_map: market,
      competitive_landscape: landscape,
      preferred_buyer_types: company.preferredBuyerTypes,
      excluded_buyers: excluded,
    }, { maxTokens: 32000 })
  );
  await saveArtifact(companyId, 'buyer_discovery_meta', {
    facts: discovery.facts,
    assumptions: discovery.assumptions,
    missing_data: discovery.missing_data,
    confidence_score: discovery.confidence_score,
  });

  // Replace prior buyer set for a clean re-run.
  await prisma.buyer.deleteMany({ where: { companyId } });
  const exLower = excluded.map((e) => e.toLowerCase());
  const universe = discovery.buyer_universe.filter(
    (b) => !exLower.some((e) => e && b.buyer_name.toLowerCase().includes(e))
  );
  const buyers = [] as { id: string; name: string; buyerType: string; industry: string | null; initialRationale: string | null; estimatedFit: string | null }[];
  for (const b of universe) {
    const row = await prisma.buyer.create({
      data: {
        companyId,
        name: b.buyer_name,
        buyerType: b.buyer_type,
        industry: b.industry,
        initialRationale: b.initial_rationale,
        buyerCategory: b.buyer_category,
        estimatedFit: b.estimated_fit,
        researchNeeded: JSON.stringify(b.research_needed),
      },
    });
    buyers.push({ id: row.id, name: row.name, buyerType: row.buyerType, industry: row.industry, initialRationale: row.initialRationale, estimatedFit: row.estimatedFit });
  }

  // -------------------------------------------------- 7. Buyer Research
  // Research the most promising buyers first (High > Medium > Low), capped to
  // keep token spend bounded; batched so a single response never truncates.
  const fitRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  const toResearch = [...buyers]
    .sort((a, b) => (fitRank[a.estimatedFit ?? 'Low'] ?? 2) - (fitRank[b.estimatedFit ?? 'Low'] ?? 2))
    .slice(0, 25);

  await step('buyer_research', async () => {
    const researchSvc = getResearchService();
    const webNotes = await researchSvc.research(
      toResearch.map((b) => b.name),
      { sector: profile.industry_category }
    );
    for (const batch of chunk(toResearch, 8)) {
      const out = await runAgent('buyer_research', {
        company_profile: profile,
        buyers: batch.map((b) => ({
          buyer_name: b.name,
          buyer_type: b.buyerType,
          industry: b.industry,
          initial_rationale: b.initialRationale,
          estimated_fit: b.estimatedFit,
          web_research_notes: webNotes[b.name],
        })),
      }, { maxTokens: 32000 });
      for (const r of out.buyer_research) {
        const buyer = batch.find((b) => b.name === r.buyer_name) ??
          buyers.find((b) => b.name === r.buyer_name);
        if (!buyer) continue;
        await prisma.buyerResearch.upsert({
          where: { buyerId: buyer.id },
          create: {
            buyerId: buyer.id,
            companyOverview: r.company_overview,
            relevantBusinessUnits: JSON.stringify(r.relevant_business_units),
            strategicPriorities: JSON.stringify(r.strategic_priorities),
            mAndAHistory: JSON.stringify(r.m_and_a_history),
            recentRelevantNews: JSON.stringify(r.recent_relevant_news),
            financialCapacity: r.financial_capacity,
            productGap: r.product_gap,
            customerOverlap: r.customer_overlap,
            strategicFitSummary: r.strategic_fit_summary,
            reasonsToAcquire: JSON.stringify(r.reasons_to_acquire),
            reasonsNotToAcquire: JSON.stringify(r.reasons_not_to_acquire),
            evidence: JSON.stringify(r.evidence),
            confidenceScore: Math.round(r.confidence_score),
          },
          update: {},
        });
      }
    }
  });

  // -------------------------------------------------- 8. Strategic Fit Scoring
  const weights = await getWeights();
  await step('strategic_fit_scoring', async () => {
    const researched = await prisma.buyer.findMany({
      where: { companyId, research: { isNot: null } },
      include: { research: true },
    });
    for (const batch of chunk(researched, 12)) {
      const out = await runAgent('strategic_fit_scoring', {
        company_profile: profile,
        buyer_research: batch.map((b) => ({
          buyer_name: b.name,
          buyer_type: b.buyerType,
          estimated_fit: b.estimatedFit,
          strategic_fit_summary: b.research?.strategicFitSummary,
          reasons_to_acquire: parseJsonArray(b.research?.reasonsToAcquire),
          reasons_not_to_acquire: parseJsonArray(b.research?.reasonsNotToAcquire),
          m_and_a_history: parseJsonArray(b.research?.mAndAHistory),
          financial_capacity: b.research?.financialCapacity,
          product_gap: b.research?.productGap,
          customer_overlap: b.research?.customerOverlap,
        })),
      }, { maxTokens: 32000 });
      for (const s of out.ranked_buyers) {
        const buyer = batch.find((b) => b.name === s.buyer_name);
        if (!buyer) continue;
        const inputs = {
          productFit: s.product_fit,
          customerOverlap: s.customer_overlap,
          marketExpansionFit: s.market_expansion_fit,
          mAndAHistory: s.m_and_a_history,
          financialCapacity: s.financial_capacity,
          competitivePressure: s.competitive_pressure,
          integrationFeasibility: s.integration_feasibility,
        };
        const ws = weightedScore(inputs, weights);
        await prisma.buyerScore.upsert({
          where: { buyerId: buyer.id },
          create: {
            buyerId: buyer.id,
            ...inputs,
            weightedScore: ws,
            tier: tierFor(ws),
            rationale: s.summary_rationale,
            keyRisk: s.key_risk,
            confidenceScore: Math.round(s.confidence_score),
          },
          update: {},
        });
      }
    }
  });

  // -------------------------------------------------- 9. Valuation & Deal Logic
  const topScored = await prisma.buyer.findMany({
    where: { companyId, score: { isNot: null } },
    include: { score: true, research: true },
    orderBy: { score: { weightedScore: 'desc' } },
  });
  const valuation = await step('valuation', () =>
    runAgent('valuation', {
      company_profile: profile,
      financial_analysis: financial,
      top_buyers: topScored.slice(0, 10).map((b) => ({
        buyer_name: b.name,
        buyer_type: b.buyerType,
        weighted_score: b.score?.weightedScore,
        financial_capacity: b.research?.financialCapacity,
      })),
    })
  );
  await saveArtifact(companyId, 'valuation', valuation);

  // -------------------------------------------------- 10. Synergy Theses
  const thesisTargets = topScored
    .filter((b) => b.score && (b.score.tier === 'Tier 1' || b.score.tier === 'Tier 2'))
    .slice(0, 10);
  // If tiering is harsh, still produce theses for the top 5 overall.
  const finalThesisTargets = thesisTargets.length >= 3 ? thesisTargets : topScored.slice(0, 5);

  await step('synergy_thesis', async () => {
    for (const batch of chunk(finalThesisTargets, 5)) {
      const out = await runAgent('synergy_thesis', {
        company_profile: profile,
        buyers: batch.map((b) => ({
          buyer_name: b.name,
          buyer_type: b.buyerType,
          tier: b.score?.tier,
          strategic_fit_summary: b.research?.strategicFitSummary,
          product_gap: b.research?.productGap,
          customer_overlap: b.research?.customerOverlap,
          reasons_to_acquire: parseJsonArray(b.research?.reasonsToAcquire),
          reasons_not_to_acquire: parseJsonArray(b.research?.reasonsNotToAcquire),
        })),
      }, { maxTokens: 32000 });
      for (const t of out.buyer_theses) {
        const buyer = batch.find((b) => b.name === t.buyer_name);
        if (!buyer) continue;
        await prisma.buyerThesis.upsert({
          where: { buyerId: buyer.id },
          create: {
            buyerId: buyer.id,
            acquisitionThesis: t.acquisition_thesis,
            productSynergy: t.product_synergy,
            revenueSynergy: t.revenue_synergy,
            customerSynergy: t.customer_synergy,
            technologySynergy: t.technology_synergy,
            dataSynergy: t.data_synergy,
            teamOrTalentRationale: t.team_or_talent_rationale,
            competitiveRationale: t.competitive_rationale,
            integrationPath: t.integration_path,
            potentialObjections: JSON.stringify(t.potential_objections),
            objectionResponses: JSON.stringify(t.objection_responses),
            recommendedOutreachAngle: t.recommended_outreach_angle,
            bestContactType: t.best_contact_type,
            confidenceScore: Math.round(t.confidence_score),
          },
          update: {},
        });
      }
    }
  });

  // -------------------------------------------------- 11. Outreach drafts
  await step('outreach', async () => {
    await generateOutreachDrafts(companyId);
  });

  // -------------------------------------------------- 12. Report
  await step('report', async () => {
    const markdown = await generateReportMarkdown(companyId);
    await prisma.report.create({
      data: {
        companyId,
        title: `${company.name} — Buyer Discovery Packet`,
        markdown,
      },
    });
  });

  await prisma.analysisRun.update({
    where: { id: runId },
    data: { status: 'done', currentStep: null },
  });
}

/**
 * Generate outreach drafts for the top thesis buyers. Standalone so the
 * POST /generate-outreach route can re-run it after edits. Every draft is
 * created with status "Needs Review" — nothing is ever sent automatically.
 */
export async function generateOutreachDrafts(companyId: string): Promise<number> {
  const company = await prisma.targetCompany.findUniqueOrThrow({ where: { id: companyId } });
  const settings = await getSettings();
  const profileArt = await prisma.analysisArtifact.findUnique({
    where: { companyId_kind: { companyId, kind: 'company_profile' } },
  });
  const profile = profileArt ? JSON.parse(profileArt.json) : {};

  const buyersWithTheses = await prisma.buyer.findMany({
    where: { companyId, thesis: { isNot: null } },
    include: { thesis: true, score: true },
    orderBy: { score: { weightedScore: 'desc' } },
    take: 5,
  });

  const out = await runAgent('outreach', {
    sector: profile.industry_category || company.sector || 'the category',
    product_summary: profile.what_the_company_does,
    customer_summary: profile.customer_profile,
    tone: settings.outreachTone,
    confidentiality_level: company.confidentialityLevel,
    buyers: buyersWithTheses.map((b) => ({
      buyer_name: b.name,
      buyer_type: b.buyerType,
      recommended_outreach_angle: b.thesis?.recommendedOutreachAngle,
      best_contact_type: b.thesis?.bestContactType,
      acquisition_thesis: b.thesis?.acquisitionThesis,
    })),
  }, { maxTokens: 32000 });

  // Replace existing unapproved drafts; keep anything the user already acted on.
  await prisma.outreachMessage.deleteMany({
    where: { companyId, status: { in: ['Draft', 'Needs Review'] } },
  });
  let created = 0;
  for (const m of out.messages) {
    const buyer = m.buyer_name
      ? buyersWithTheses.find((b) => b.name === m.buyer_name)
      : undefined;
    await prisma.outreachMessage.create({
      data: {
        companyId,
        buyerId: buyer?.id,
        messageType: m.message_type,
        subject: m.subject === 'Not provided' ? null : m.subject,
        body: m.body,
        status: 'Needs Review',
      },
    });
    created++;
  }
  return created;
}
