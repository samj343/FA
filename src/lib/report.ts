import { prisma } from './db';

// Assembles the final buyer-discovery packet as Markdown from persisted
// artifacts + buyer tables. Deterministic (no LLM call) so the report always
// reflects the advisor's edits to scores/theses.

const arr = (s: string | null | undefined): string[] => {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};
const bullets = (items: string[], empty = '_None recorded._') =>
  items.length ? items.map((i) => `- ${i}`).join('\n') : empty;
const val = (s: string | null | undefined) => (s && s !== 'Not provided' ? s : '_Not provided_');

async function artifact(companyId: string, kind: string): Promise<any | null> {
  const a = await prisma.analysisArtifact.findUnique({
    where: { companyId_kind: { companyId, kind } },
  });
  return a ? JSON.parse(a.json) : null;
}

export async function generateReportMarkdown(companyId: string): Promise<string> {
  const company = await prisma.targetCompany.findUniqueOrThrow({ where: { id: companyId } });
  const [profile, financial, market, landscape, valuation] = await Promise.all([
    artifact(companyId, 'company_profile'),
    artifact(companyId, 'financial_analysis'),
    artifact(companyId, 'market_map'),
    artifact(companyId, 'competitive_landscape'),
    artifact(companyId, 'valuation'),
  ]);
  const buyers = await prisma.buyer.findMany({
    where: { companyId, excluded: false },
    include: { score: true, research: true, thesis: true },
  });
  const scored = buyers
    .filter((b) => b.score)
    .sort((a, b) => (b.score!.weightedScore ?? 0) - (a.score!.weightedScore ?? 0));
  const tier1 = scored.filter((b) => b.score!.tier === 'Tier 1');
  const thesisBuyers = scored.filter((b) => b.thesis);

  const lines: string[] = [];
  const push = (...s: string[]) => lines.push(...s, '');

  push(`# ${company.name} — M&A Buyer Discovery Packet`);
  push(
    `_Prepared by BuyerScope. All analysis is preliminary and for advisor review only. ` +
      `Nothing in this packet constitutes a formal valuation or an indication of buyer interest. ` +
      `Generated ${new Date().toISOString().slice(0, 10)}._`
  );

  // 1. Executive Summary
  push('## 1. Executive Summary');
  push(profile?.executive_summary ?? '_Company profile not yet generated._');
  if (profile) push(`**Analysis confidence:** ${profile.confidence_score}/100`);

  // 2. Target Company Profile
  push('## 2. Target Company Profile');
  push(
    `| Field | Value |`,
    `|---|---|`,
    `| Company | ${company.name} |`,
    `| Website | ${val(company.website)} |`,
    `| Sector | ${val(company.sector)} |`,
    `| Business model | ${val(profile?.business_model)} |`,
    `| Customer profile | ${val(profile?.customer_profile)} |`
  );
  push('**What the company does**', val(profile?.what_the_company_does));
  push('**Why it may be acquirable**', val(profile?.why_the_company_may_be_acquirable));
  push('**Strategic value drivers**', bullets(profile?.strategic_value_drivers ?? []));

  // 3. Financial Snapshot
  push('## 3. Financial Snapshot');
  push(financial?.financial_summary ?? '_Not generated._');
  if (financial) {
    push(`**Stage:** ${financial.company_stage}  `, `**Likely valuation method:** ${financial.likely_valuation_method}`);
    push('**Missing financial data**', bullets(financial.missing_financial_data ?? []));
    push('> This is not a formal valuation.');
  }

  // 4. Market Overview
  push('## 4. Market Overview');
  if (market) {
    push(`**Category:** ${market.market_category}`, '', market.market_description);
    push('**Tailwinds**', bullets(market.market_tailwinds ?? []));
    push('**Headwinds**', bullets(market.market_headwinds ?? []));
    push('**Consolidation rationale**', market.consolidation_rationale ?? '');
  } else push('_Not generated._');

  // 5. Competitive Landscape
  push('## 5. Competitive Landscape');
  if (landscape) {
    const rows = [
      ...(landscape.direct_competitors ?? []),
      ...(landscape.adjacent_competitors ?? []),
      ...(landscape.large_incumbents ?? []),
      ...(landscape.substitutes ?? []),
    ];
    push(
      `| Company | Relationship | Why relevant |`,
      `|---|---|---|`,
      ...rows.map((c: any) => `| ${c.company_name} | ${c.relationship_to_target} | ${c.why_relevant} |`)
    );
    push('**Differentiation analysis**', landscape.differentiation_analysis ?? '');
  } else push('_Not generated._');

  // 6. Buyer Universe
  push('## 6. Buyer Universe');
  push(`${buyers.length} potential buyers identified across ${new Set(buyers.map((b) => b.buyerType)).size} categories.`);
  push(
    `| Buyer | Type | Fit estimate | Initial rationale |`,
    `|---|---|---|---|`,
    ...buyers.map((b) => `| ${b.name} | ${b.buyerType} | ${b.estimatedFit ?? '—'} | ${(b.initialRationale ?? '').replace(/\|/g, '/')} |`)
  );

  // 7. Ranked Buyer List
  push('## 7. Ranked Buyer List');
  push(
    `| # | Buyer | Type | Weighted score | Tier | Confidence |`,
    `|---|---|---|---|---|---|`,
    ...scored.map(
      (b, i) =>
        `| ${i + 1} | ${b.name} | ${b.buyerType} | ${b.score!.weightedScore.toFixed(2)} | ${b.score!.tier} | ${b.score!.confidenceScore}/100 |`
    )
  );
  push(`**Tier 1 buyers:** ${tier1.length ? tier1.map((b) => b.name).join(', ') : 'None at current scoring.'}`);

  // 8. Top Buyer Acquisition Theses
  push('## 8. Top Buyer Acquisition Theses');
  for (const b of thesisBuyers.slice(0, 10)) {
    const t = b.thesis!;
    push(`### ${b.name} (${b.score?.tier ?? '—'})`);
    push(t.acquisitionThesis ?? '');
    push(
      `- **Product synergy:** ${t.productSynergy ?? '—'}`,
      `- **Revenue synergy:** ${t.revenueSynergy ?? '—'}`,
      `- **Customer synergy:** ${t.customerSynergy ?? '—'}`,
      `- **Competitive rationale:** ${t.competitiveRationale ?? '—'}`,
      `- **Integration path:** ${t.integrationPath ?? '—'}`,
      `- **Recommended outreach angle:** ${t.recommendedOutreachAngle ?? '—'}`,
      `- **Best contact:** ${t.bestContactType ?? '—'}`
    );
    const objections = arr(t.potentialObjections);
    const responses = arr(t.objectionResponses);
    if (objections.length) {
      push('**Objections & responses**');
      push(...objections.map((o, i) => `- _${o}_ → ${responses[i] ?? 'Response TBD'}`), '');
    }
  }
  if (!thesisBuyers.length) push('_No theses generated yet._');

  // 9. Valuation and Deal Logic
  push('## 9. Valuation & Deal Logic');
  if (valuation) {
    push(`**Approach:** ${valuation.valuation_approach}`);
    push(`**Likely deal type:** ${valuation.possible_deal_type}`);
    push(`**Directional range:** ${valuation.rough_range_if_possible}`);
    push('**Drivers**', bullets(valuation.valuation_drivers ?? []));
    push('**Risks**', bullets(valuation.valuation_risks ?? []));
    push('**Data needed for a better valuation**', bullets(valuation.data_needed_for_better_valuation ?? []));
    push(`> ${valuation.disclaimer ?? 'Directional analysis only. This is not a formal valuation.'}`);
  } else push('_Not generated._');

  // 10. Outreach Strategy
  push('## 10. Outreach Strategy');
  const outreach = await prisma.outreachMessage.findMany({ where: { companyId } });
  push(
    `${outreach.length} outreach drafts prepared (teaser, buyer emails, LinkedIn messages, first-call script, objection handling, follow-up). ` +
      `All drafts carry status **${'`Needs Review`'}** until explicitly approved — no outreach is sent automatically.`
  );

  // 11. Risks and Diligence Questions
  push('## 11. Risks & Diligence Questions');
  push('**Key risks**', bullets(profile?.key_risks ?? []));
  push('**Diligence questions**', bullets(profile?.diligence_questions ?? []));
  push('**Missing information**', bullets([
    ...(profile?.missing_data ?? []),
    ...(financial?.missing_financial_data ?? []),
  ]));

  // 12. Recommended Next Steps
  push('## 12. Recommended Next Steps');
  push(bullets([
    'Verify financial metrics (ARR, growth, gross margin, retention) with the founders.',
    'Review and edit buyer scores; exclude any conflicted or undesirable buyers.',
    'Approve the anonymous teaser and the top 3-5 buyer outreach drafts.',
    'Sequence outreach: Tier 1 strategics first, PE platforms in parallel.',
    'Prepare an NDA and data-room checklist before any buyer conversation advances.',
  ]));

  // 13. Appendix — scoring table
  push('## 13. Appendix — Buyer Scoring Table');
  push(
    `| Rank | Buyer | Type | Product fit | Cust. overlap | Mkt expansion | M&A history | Fin. capacity | Comp. pressure | Integration | Weighted | Tier | Key risk | Confidence |`,
    `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`,
    ...scored.map((b, i) => {
      const s = b.score!;
      return `| ${i + 1} | ${b.name} | ${b.buyerType} | ${s.productFit} | ${s.customerOverlap} | ${s.marketExpansionFit} | ${s.mAndAHistory} | ${s.financialCapacity} | ${s.competitivePressure} | ${s.integrationFeasibility} | ${s.weightedScore.toFixed(2)} | ${s.tier} | ${(s.keyRisk ?? '—').replace(/\|/g, '/')} | ${s.confidenceScore}/100 |`;
    })
  );

  return lines.join('\n');
}
