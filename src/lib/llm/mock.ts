import type { LlmProvider } from './types';

// Deterministic mock analyst. Produces schema-valid, internally consistent
// output for every agent so the full workflow runs offline. All company names
// it emits for buyers are FICTIONAL and every research entry is flagged as
// illustrative — swap in the Anthropic provider for real analysis.

const MOCK_FLAG =
  'MOCK DATA — illustrative only. Configure ANTHROPIC_API_KEY to run real analysis.';

function parseInput(user: string): any {
  try {
    return JSON.parse(user);
  } catch {
    return { raw: user };
  }
}

// Small deterministic hash so scores are stable per buyer name.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
const pick = (n: number, lo: number, hi: number) => lo + (n % (hi - lo + 1));

function sectorOf(input: any): string {
  return (
    input?.company_profile?.industry_category ||
    input?.deck_intake?.sector ||
    input?.sector ||
    'B2B software'
  );
}
function nameOf(input: any): string {
  return (
    input?.company_profile?.company_name ||
    input?.deck_intake?.company_name ||
    input?.company_name ||
    'the target company'
  );
}

// ---------------------------------------------------------------- buyers
type MockBuyer = {
  buyer_name: string;
  buyer_type: string;
  industry: string;
  buyer_category: string;
  initial_rationale: string;
  estimated_fit: string;
  research_needed: string[];
};

function buildBuyerUniverse(sector: string, excluded: string[]): MockBuyer[] {
  const mk = (
    buyer_name: string,
    buyer_type: string,
    buyer_category: string,
    fitSeed: number,
    rationale: string
  ): MockBuyer => ({
    buyer_name,
    buyer_type,
    industry: sector,
    buyer_category,
    initial_rationale: `${rationale} (${MOCK_FLAG})`,
    estimated_fit: ['High', 'Medium', 'Low'][fitSeed % 3],
    research_needed: [
      'Confirm current product roadmap priorities',
      'Verify recent M&A activity and integration outcomes',
      'Identify corp dev / strategy contact',
    ],
  });

  const T = (n: string) => n; // fictional names
  const universe: MockBuyer[] = [
    mk(T('Meridian Systems Group'), 'Strategic', 'Large platform vendor', 0, `Portfolio gap in ${sector}; could integrate the target as a product module and cross-sell into its installed base`),
    mk(T('Northgate Software Holdings'), 'Strategic', 'Suite consolidator', 1, `Acquires point solutions in adjacent ${sector} categories to defend suite positioning`),
    mk(T('Vantage Cloud Corp'), 'Strategic', 'Cloud platform', 0, `Public statements emphasize expansion into ${sector} workflows; target would accelerate roadmap`),
    mk(T('Helios Enterprise Software'), 'Strategic', 'Enterprise incumbent', 1, `Ageing internal product in this category; buy-vs-build calculus may favor acquisition`),
    mk(T('Crestline Technologies'), 'Adjacent Strategic', 'Adjacent workflow vendor', 0, `Sells to the same buyer persona; the target extends its offering into ${sector}`),
    mk(T('BlueRiver Analytics'), 'Adjacent Strategic', 'Data/analytics vendor', 1, `Customer overlap and complementary data assets in ${sector}`),
    mk(T('Summit Operations Software'), 'Adjacent Strategic', 'Vertical operations suite', 2, `Could bundle the target's capability into vertical workflows`),
    mk(T('Harborline Digital'), 'Adjacent Strategic', 'Digital experience platform', 1, `Product gap where the target's capability is increasingly table-stakes`),
    mk(T('Silverbrook Competitor Co'), 'Competitor', 'Scaled direct competitor', 1, `Consolidation play: absorb customer base and talent, remove a rival from the market`),
    mk(T('Foxglove Labs'), 'Competitor', 'Venture-backed rival', 2, `Defensive interest if a strategic moves on the target`),
    mk(T('Atlas Capital Platform (Kestrel Software)'), 'PE-backed Platform', 'PE roll-up platform', 0, `Sponsor-backed platform executing a buy-and-build in ${sector}; target fits bolt-on criteria`),
    mk(T('Granite Peak Partners portfolio — OrchidWorks'), 'PE-backed Platform', 'PE bolt-on', 1, `Platform seeking product breadth and ARR accretion in the category`),
    mk(T('Lakeshore Equity — Corvid Suite'), 'PE-backed Platform', 'PE consolidator', 1, `Active acquirer of sub-$50M ARR software assets in adjacent categories`),
    mk(T('Pinewood Holdings — Ledgerline'), 'PE-backed Platform', 'Vertical SaaS platform', 2, `Vertical fit if customer bases overlap; diligence needed on segment mix`),
    mk(T('Argent Global Industries'), 'Customer-Buyer', 'Large enterprise customer', 1, `Category enterprises increasingly internalize ${sector} capability; a large customer could acquire to secure roadmap`),
    mk(T('Beacon Financial Group'), 'Customer-Buyer', 'Enterprise customer', 2, `Potential existing-customer acquirer if the target is operationally critical to it`),
    mk(T('Trellis Consulting Partners'), 'Channel Partner', 'SI / services firm', 2, `Services firms acquire software to productize delivery in ${sector}`),
    mk(T('Ironbridge BPO Services'), 'Channel Partner', 'BPO / outsourcer', 2, `Could embed the target's product in managed-service offerings`),
    mk(T('Osaka Digital KK'), 'International Buyer', 'APAC strategic', 1, `Seeking a beachhead product to enter Western ${sector} markets`),
    mk(T('Rhein Software AG'), 'International Buyer', 'European strategic', 1, `European consolidator with a stated ambition to expand in this category`),
    mk(T('Aurora Bay Technologies'), 'Strategic', 'Mid-market strategic', 0, `Mid-market vendor whose customers request the target's capability; realistic cheque size`),
    mk(T('Copperfield Networks'), 'Strategic', 'Infrastructure vendor', 2, `Speculative: moving up-stack; the target would add an application-layer entry point`),
    mk(T('Willowmere Group'), 'Adjacent Strategic', 'Marketing/CX suite', 1, `Adjacent budget owner; cross-sell into existing accounts`),
    mk(T('Stonebridge Insurance Software'), 'Adjacent Strategic', 'Vertical incumbent', 2, `Vertical strategic if the target's customer mix skews to this vertical`),
    mk(T('Falconer Data Systems'), 'Strategic', 'Data platform', 1, `The target's data assets would enrich its platform; technology synergy`),
    mk(T('Quayside Ventures Platform — HarborSuite'), 'PE-backed Platform', 'PE platform', 0, `Recently raised continuation fund earmarked for acquisitions in ${sector}`),
  ];

  const ex = excluded.map((e) => e.toLowerCase().trim()).filter(Boolean);
  return universe.filter((b) => !ex.some((e) => b.buyer_name.toLowerCase().includes(e)));
}

// ------------------------------------------------------------ per-agent
function deckIntake(input: any) {
  const name = input.company_name || 'Unknown Company';
  const hasDeck = Boolean(input.deck_text && String(input.deck_text).trim().length > 40);
  const desc = input.description || 'Not provided';
  return {
    company_name: name,
    website: input.website || 'Not provided',
    headquarters: 'Not provided',
    founded_year: 'Not provided',
    sector: input.sector_hint || 'B2B software',
    subsector: 'Not provided',
    business_model: 'B2B SaaS (assumed from materials)',
    product_description: desc,
    core_value_proposition: desc === 'Not provided' ? 'Not provided' : `Helps customers with: ${desc}`,
    target_customers: input.customer_notes ? [String(input.customer_notes).slice(0, 200)] : [],
    customer_segments: ['Mid-market', 'Enterprise (assumed)'],
    revenue_model: 'Subscription (assumed)',
    pricing_model: 'Not provided',
    traction_metrics: hasDeck ? ['Deck text ingested; traction claims require verification'] : [],
    financial_metrics: {
      revenue: 'Not provided',
      arr: input.financial_notes ? `See advisor notes: ${String(input.financial_notes).slice(0, 120)}` : 'Not provided',
      growth_rate: 'Not provided',
      gross_margin: 'Not provided',
      ebitda: 'Not provided',
      burn_rate: 'Not provided',
      runway: 'Not provided',
      cash_balance: 'Not provided',
    },
    market_size_claims: [],
    competitors_mentioned: [],
    customer_logos: [],
    partnerships: [],
    team_highlights: [],
    strategic_assets: ['Product/technology (per description)', 'Customer relationships (assumed)'],
    risks_or_gaps: ['Financial metrics largely unverified', MOCK_FLAG],
    missing_information: ['Audited financials', 'Customer concentration', 'Churn / retention metrics', 'Cap table and valuation expectations'],
    facts: [desc !== 'Not provided' ? `Company description provided: ${desc}` : 'No description provided', hasDeck ? 'Pitch deck text was ingested' : 'No pitch deck uploaded'],
    assumptions: ['Business model assumed to be subscription software absent contrary evidence'],
    confidence_score: hasDeck ? 62 : 45,
  };
}

function companyProfile(input: any) {
  const d = input.deck_intake || {};
  const name = d.company_name || 'The company';
  const sector = d.sector || 'B2B software';
  return {
    executive_summary: `${name} is a ${sector} company providing ${d.product_description || 'its core product'} to ${(d.customer_segments || ['mid-market customers']).join(' and ')}. Based on the materials provided, the company appears strategically relevant to buyers seeking exposure to ${sector}, particularly acquirers with existing distribution into the same customer base. Potential acquirers may value the company for its product capability, customer relationships, and team, though further diligence is needed around financial performance, customer concentration, and retention. The business model appears to be ${d.business_model || 'subscription software'}, which supports recurring-revenue valuation frameworks if retention metrics hold up under diligence. This profile is directional: several core data points (financials, traction detail, competitive win rates) were not provided and should be gathered before buyer conversations advance beyond initial interest. (${MOCK_FLAG})`,
    what_the_company_does: d.product_description || 'Not provided',
    industry_category: sector,
    business_model: d.business_model || 'Not provided',
    customer_profile: (d.customer_segments || []).join('; ') || 'Not provided',
    why_the_company_may_be_acquirable: `Category consolidation, product-gap fills at larger vendors, and PE buy-and-build activity make ${sector} assets of this profile actionable in the current market.`,
    strategic_value_drivers: ['Product / technology', 'Customer base and relationships', 'Team and domain expertise', 'Recurring revenue base (to be verified)'],
    potential_buyer_categories: ['Large platform strategics', 'Adjacent workflow vendors', 'PE-backed platforms', 'Customer-buyers', 'International strategics'],
    key_risks: ['Unverified financials', 'Possible customer concentration', 'Competitive intensity in the category'],
    diligence_questions: ['What are ARR, growth, gross margin, and net retention?', 'What is customer concentration (top 5 customers as % of revenue)?', 'What are the founders\' transaction objectives and timeline?'],
    facts: d.facts || [],
    assumptions: ['Strategic value drivers inferred from category norms'],
    missing_data: d.missing_information || [],
    confidence_score: 58,
  };
}

function financialAnalysis(input: any) {
  const d = input.deck_intake || {};
  const fm = d.financial_metrics || {};
  const hasAny = Object.values(fm).some((v) => v && v !== 'Not provided');
  return {
    financial_summary: hasAny
      ? `Partial financial information was provided (${Object.entries(fm).filter(([, v]) => v && v !== 'Not provided').map(([k]) => k).join(', ')}). Figures are unaudited and require verification. (${MOCK_FLAG})`
      : `No reliable financial metrics were provided. The analysis below is structural only. (${MOCK_FLAG})`,
    company_stage: hasAny ? 'revenue-stage' : 'unknown — assumed early revenue-stage',
    likely_valuation_method: 'ARR / revenue multiple (if recurring revenue verifies); otherwise strategic value or team value',
    rough_valuation_logic: 'For recurring-revenue software, buyers typically anchor on a multiple of ARR adjusted for growth, retention, and gross margin. Without verified ARR, growth, and NRR, no responsible range can be produced. This is not a formal valuation.',
    financial_strengths: hasAny ? ['Some financial visibility provided by the advisor'] : [],
    financial_risks: ['Unverified metrics', 'Unknown burn / runway', 'Unknown customer concentration'],
    missing_financial_data: ['ARR and revenue by year', 'Growth rate', 'Gross margin', 'Net revenue retention', 'EBITDA / burn', 'Cash balance and runway'],
    key_diligence_questions: ['Are revenue figures GAAP or bookings?', 'What portion of revenue is recurring vs services?', 'What is the churn profile of the top 10 accounts?'],
    facts: hasAny ? ['Advisor-provided financial notes were ingested'] : ['No financial data provided'],
    assumptions: ['Stage classification assumed pending verified metrics'],
    confidence_score: hasAny ? 55 : 40,
  };
}

function marketMap(input: any) {
  const sector = sectorOf(input);
  return {
    market_category: sector,
    market_description: `${sector} serving mid-market and enterprise customers; spend is shifting toward integrated platforms, and AI capability is becoming a purchase criterion. (${MOCK_FLAG})`,
    market_tailwinds: ['AI-driven replatforming budgets', 'Consolidation of point solutions into suites', 'Efficiency mandates favoring automation'],
    market_headwinds: ['Crowded vendor landscape', 'Elongated enterprise sales cycles', 'Platform vendors bundling adjacent capability "for free"'],
    adjacent_markets: ['Workflow automation', 'Analytics / BI', 'Vertical operations software'],
    major_incumbents: ['Meridian Systems Group', 'Helios Enterprise Software', 'Vantage Cloud Corp'],
    emerging_competitors: ['Foxglove Labs', 'Silverbrook Competitor Co'],
    strategic_buyer_categories: ['Platform suites', 'Adjacent workflow vendors', 'Enterprise AI companies', 'IT services / SIs'],
    financial_buyer_categories: ['PE-backed software platforms', 'Growth-equity-backed consolidators'],
    customer_buyer_categories: ['Large enterprises with in-house operations in this category'],
    consolidation_rationale: 'Buyers are assembling end-to-end suites; point solutions with real customer bases are being absorbed for product completeness and ARR.',
    market_risks: ['Category commoditization', 'Incumbent bundling', 'Funding environment for smaller rivals'],
    facts: ['Derived from the company profile provided'],
    assumptions: ['Named incumbents/competitors are illustrative fictional placeholders in mock mode'],
    missing_data: ['Third-party market sizing', 'Win/loss data against named competitors'],
    confidence_score: 50,
  };
}

function competitiveLandscape(input: any) {
  const sector = sectorOf(input);
  const entry = (company_name: string, relationship_to_target: string, why: string) => ({
    company_name,
    description: `${relationship_to_target} in ${sector} (${MOCK_FLAG})`,
    why_relevant: why,
    relationship_to_target,
    potential_acquirer_or_competing_asset:
      relationship_to_target === 'direct competitor' ? 'competing asset — could be acquired instead of the target' : 'potential acquirer',
  });
  return {
    direct_competitors: [
      entry('Silverbrook Competitor Co', 'direct competitor', 'Scaled rival with overlapping product'),
      entry('Foxglove Labs', 'direct competitor', 'Venture-backed rival; alternative asset for buyers'),
    ],
    adjacent_competitors: [
      entry('Crestline Technologies', 'adjacent', 'Sells adjacent workflow to same buyer persona'),
      entry('Willowmere Group', 'adjacent', 'Suite vendor expanding toward the category'),
    ],
    large_incumbents: [
      entry('Meridian Systems Group', 'incumbent', 'Owns distribution; internal product ageing'),
      entry('Helios Enterprise Software', 'incumbent', 'Incumbent with build-vs-buy decision pending'),
    ],
    substitutes: [entry('In-house tooling / spreadsheets', 'substitute', 'Default alternative in cost-sensitive accounts')],
    defensive_acquirer_candidates: ['Meridian Systems Group', 'Vantage Cloud Corp'],
    competitive_risks: ['A strategic acquiring a direct competitor first', 'Incumbent bundling eroding standalone pricing'],
    differentiation_analysis: `The market is moderately crowded but fragmented below the incumbent tier; differentiation rests on product depth and customer proof points, both of which require diligence. (${MOCK_FLAG})`,
    facts: [],
    assumptions: ['All named companies in mock mode are fictional placeholders'],
    missing_data: ['Win/loss records', 'Feature-level comparison'],
    confidence_score: 48,
  };
}

function buyerDiscovery(input: any) {
  const sector = sectorOf(input);
  const excluded: string[] = input.excluded_buyers || [];
  return {
    buyer_universe: buildBuyerUniverse(sector, excluded),
    facts: ['Universe generated from market map and competitive landscape'],
    assumptions: ['Buyer names are fictional placeholders in mock mode'],
    missing_data: ['Live corp-dev activity signals', 'Buyer financial capacity verification'],
    confidence_score: 45,
  };
}

function buyerResearch(input: any) {
  const buyers: any[] = input.buyers || [];
  const name = nameOf(input);
  return {
    buyer_research: buyers.map((b) => {
      const h = hash(b.buyer_name);
      return {
        buyer_name: b.buyer_name,
        company_overview: `${b.buyer_name} is a ${b.industry || 'software'} ${String(b.buyer_type || '').toLowerCase()} organization. ${MOCK_FLAG}`,
        relevant_business_units: ['Core platform', 'Adjacent product line'],
        strategic_priorities: ['Suite completeness', 'AI capability', 'Net revenue retention'],
        m_and_a_history: pick(h, 0, 2) === 0 ? ['Multiple tuck-in acquisitions in the last 5 years (requires external verification)'] : ['Limited disclosed M&A history (requires external verification)'],
        recent_relevant_news: ['Requires external verification — no live web research in mock mode'],
        financial_capacity: pick(h, 0, 1) === 0 ? 'Likely able to fund a mid-market acquisition from balance sheet or sponsor capital (unverified)' : 'Capacity uncertain; would likely need sponsor support (unverified)',
        product_gap: `Does not currently offer the target's capability natively; ${b.initial_rationale || ''}`,
        customer_overlap: 'Assumed meaningful overlap with the target\'s customer segments; verify with customer-list mapping',
        strategic_fit_summary: `${b.buyer_name} may be a relevant acquirer for ${name}: ${b.initial_rationale || 'category fit'}.`,
        reasons_to_acquire: ['Fill product gap', 'Cross-sell into existing base', 'Pre-empt competitors'],
        reasons_not_to_acquire: ['Could build internally', 'Integration cost', 'Valuation discipline'],
        evidence: [MOCK_FLAG, 'External verification required for all factual claims'],
        confidence_score: pick(h, 35, 60),
      };
    }),
  };
}

function scoring(input: any) {
  const research: any[] = input.buyer_research || [];
  const fitBoost: Record<string, number> = { High: 2, Medium: 0, Low: -2 };
  return {
    ranked_buyers: research.map((r) => {
      const h = hash(r.buyer_name);
      const boost = fitBoost[r.estimated_fit as string] ?? 0;
      const s = (seed: number, lo: number, hi: number) =>
        Math.max(1, Math.min(10, pick(hash(r.buyer_name + seed), lo, hi) + boost));
      return {
        buyer_name: r.buyer_name,
        buyer_type: r.buyer_type || 'Strategic',
        product_fit: s(1, 4, 9),
        customer_overlap: s(2, 3, 8),
        market_expansion_fit: s(3, 3, 8),
        m_and_a_history: s(4, 2, 9),
        financial_capacity: s(5, 3, 9),
        competitive_pressure: s(6, 2, 8),
        integration_feasibility: s(7, 3, 8),
        summary_rationale: `${r.buyer_name}: ${r.strategic_fit_summary || 'category fit'} Scores reflect mock heuristics. (${MOCK_FLAG})`,
        key_risk: (r.reasons_not_to_acquire || ['Build-vs-buy risk'])[0],
        confidence_score: pick(h, 35, 60),
      };
    }),
  };
}

function valuation(input: any) {
  return {
    valuation_approach: 'ARR multiple framework, contingent on verified recurring revenue; strategic-value framing for buyers with acute product gaps',
    possible_deal_type: 'Tuck-in acquisition or PE bolt-on, depending on scale',
    valuation_drivers: ['Verified ARR and growth', 'Net revenue retention', 'Strategic scarcity of the asset', 'Competitive tension in the process'],
    valuation_risks: ['Unverified financials', 'Customer concentration', 'Buyer ability to build internally'],
    rough_range_if_possible: 'Insufficient verified data to produce a responsible range. Directional only once ARR/growth/NRR are confirmed. This is not a formal valuation.',
    buyer_affordability_notes: ['Tier 1 strategics: likely balance-sheet funded', 'PE platforms: sponsor capital available for bolt-ons', 'Smaller strategics: may require structure (earn-out / stock)'],
    data_needed_for_better_valuation: ['3 years of P&L', 'ARR waterfall and cohort retention', 'Pipeline and bookings', 'Cap table and preference stack'],
    disclaimer: 'Directional analysis only. This is not a formal valuation.',
    facts: [],
    assumptions: [MOCK_FLAG],
    confidence_score: 40,
  };
}

function synergyThesis(input: any) {
  const buyers: any[] = input.buyers || [];
  const name = nameOf(input);
  return {
    buyer_theses: buyers.map((b) => ({
      buyer_name: b.buyer_name,
      acquisition_thesis: `${b.buyer_name} could view ${name} as a way to fill a product gap and accelerate its roadmap in the category, integrating the target's capability into its core platform while cross-selling into its existing customer base. (${MOCK_FLAG})`,
      product_synergy: 'Target capability slots into the buyer\'s platform as a native module',
      revenue_synergy: 'Cross-sell into the buyer\'s installed base; pricing uplift from bundling',
      customer_synergy: 'Overlapping buyer personas reduce go-to-market friction',
      technology_synergy: 'Shared modern stack assumed; integration diligence required',
      data_synergy: 'Potential enrichment of the buyer\'s data assets — verify data rights',
      team_or_talent_rationale: 'Domain-expert team adds category credibility',
      competitive_rationale: 'Pre-empts rivals acquiring the target or a competing asset',
      integration_path: 'Phase 1: standalone product under buyer brand; Phase 2: native platform integration over 12-18 months',
      potential_objections: ['We can build this internally', 'The company is too small to matter'],
      objection_responses: ['Build takes 18-24 months and forfeits the customer base; acquisition delivers both immediately', 'Value is in the wedge: customer relationships and domain depth, not current scale'],
      recommended_outreach_angle: 'Lead with the product-gap fill and installed-base cross-sell math',
      best_contact_type: hash(b.buyer_name) % 2 === 0 ? 'Corp dev' : 'Product leader',
      confidence_score: 45,
    })),
  };
}

function outreach(input: any) {
  const sector = input.sector || 'the category';
  const buyers: any[] = input.buyers || [];
  const messages: any[] = [];

  messages.push({
    buyer_name: '',
    message_type: 'anonymous_teaser',
    subject: `Confidential opportunity — ${sector}`,
    body: `CONFIDENTIAL — ANONYMOUS TEASER\n\nOpportunity: A ${sector} company serving mid-market and enterprise customers.\n\nProduct: ${input.product_summary || 'A focused software product addressing a defined operational workflow.'}\n\nCustomers: Established base in its core segment (details under NDA).\n\nTraction: Available under NDA.\n\nStrategic relevance: Fills a product gap for platform vendors and suite consolidators; credible bolt-on for sponsor-backed platforms in the category.\n\nProcess: The company is evaluating strategic options with the assistance of an advisor. A short call and NDA precede any further disclosure.\n\n(${MOCK_FLAG})`,
  });

  for (const b of buyers) {
    messages.push({
      buyer_name: b.buyer_name,
      message_type: 'buyer_email',
      subject: `Strategic opportunity in ${sector}`,
      body: `Hi [Name],\n\nI'm reaching out because I'm advising a ${sector} company that may be relevant to ${b.buyer_name}'s strategy in this category.\n\nThe company provides ${input.product_summary || 'a focused product'} for ${input.customer_summary || 'mid-market customers'}. Given ${b.buyer_name}'s position in the market, there may be a strategic fit around ${b.recommended_outreach_angle || 'product and customer synergies'}.\n\nHappy to share a short anonymous teaser if this is an area your team is actively evaluating.\n\nBest,\n[Advisor Name]`,
    });
    messages.push({
      buyer_name: b.buyer_name,
      message_type: 'linkedin_message',
      subject: '',
      body: `Hi [Name], I'm advising a ${sector} company that may be relevant to ${b.buyer_name}'s strategy. Given your work in corp dev/strategy, I thought it could be worth a brief conversation. Happy to send a short anonymous teaser if relevant.`,
    });
    messages.push({
      buyer_name: b.buyer_name,
      message_type: 'corp_dev_email',
      subject: `Confidential — ${sector} acquisition opportunity`,
      body: `Hi [Name],\n\nI advise a ${sector} company exploring strategic options. Based on ${b.buyer_name}'s recent moves in the category, this may warrant a quick look by your team.\n\nKey points (anonymous): established product, real customer base, credible strategic fit with your platform.\n\nIf useful, I can send a one-page anonymous teaser and coordinate an NDA for further detail.\n\nBest,\n[Advisor Name]`,
    });
  }

  messages.push({
    buyer_name: '',
    message_type: 'first_call_script',
    subject: 'First-call script',
    body: `FIRST CALL SCRIPT\n\n1. OPENING (2 min): Thank them; confirm confidentiality; explain you advise a ${sector} company evaluating strategic options.\n2. TARGET OVERVIEW (3 min): Anonymous description only — category, customer type, business model. No name, no financials.\n3. WHY THEM (2 min): Reference their product gap / category strategy; ask whether the space is on their roadmap.\n4. QUALIFYING QUESTIONS: Is M&A an active tool for you this year? Who owns decisions in this space? What would make an asset like this compelling? What is your typical process and timeline?\n5. NEXT STEP: Offer the anonymous teaser; propose NDA if interest is real.\n6. GUARDRAILS: Do not disclose company name, exact financials, customer names, or valuation expectations on a first call.`,
  });
  messages.push({
    buyer_name: '',
    message_type: 'objection_handling',
    subject: 'Objection-handling guide',
    body: `OBJECTION HANDLING\n\n"We're not looking at acquisitions right now." — Understood; many of the best transactions start as relationship conversations. May I send the anonymous teaser so it's on file if priorities shift?\n\n"We can build this internally." — Teams usually can, in 18-24 months. The question is whether the customer base, domain team, and time-to-market are worth more than the build cost.\n\n"The company is too small." — Size is the point: it's a wedge asset. The value is the capability and customer proof, not current scale.\n\n"The market is too crowded." — Agreed on noise; that's why consolidators are winning. Owning a proven asset beats competing with twenty vendors.\n\n"We'd need more financial information." — Of course. That's what the NDA step is for; happy to coordinate.\n\n"Not a priority this year." — Noted. Would a light-touch update each quarter be useful so you're current if it becomes one?\n\n"Send us more information." — I'll send the anonymous teaser now; anything deeper follows an NDA.`,
  });
  messages.push({
    buyer_name: '',
    message_type: 'follow_up_email',
    subject: `Following up — ${sector} opportunity`,
    body: `Hi [Name],\n\nFollowing up on my note last week about the ${sector} company I'm advising. If the space is relevant to your roadmap, I'd welcome 20 minutes to walk through the anonymous profile.\n\nIf it's not a fit right now, a quick "not for us" is equally helpful.\n\nBest,\n[Advisor Name]`,
  });

  return { messages };
}

const HANDLERS: Record<string, (input: any) => unknown> = {
  deck_intake: deckIntake,
  company_profile: companyProfile,
  financial_analysis: financialAnalysis,
  market_map: marketMap,
  competitive_landscape: competitiveLandscape,
  buyer_discovery: buyerDiscovery,
  buyer_research: buyerResearch,
  strategic_fit_scoring: scoring,
  valuation,
  synergy_thesis: synergyThesis,
  outreach,
};

export const mockProvider: LlmProvider = {
  name: 'mock',
  async complete({ user, agent }) {
    const handler = agent ? HANDLERS[agent] : undefined;
    if (!handler) throw new Error(`Mock provider has no handler for agent "${agent}"`);
    // Tiny delay so the progress UI is visible in demos.
    await new Promise((r) => setTimeout(r, 150));
    return JSON.stringify(handler(parseInput(user)));
  },
};
