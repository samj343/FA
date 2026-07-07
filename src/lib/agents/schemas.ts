import { z } from 'zod';

// Zod schemas for every agent's output. These are the contract between the
// LLM (or mock) and the rest of the system — everything is validated before
// it touches the database.

const str = z.string().catch('Not provided');
const strArr = z.array(z.string()).catch([]);
const confidence = z.number().min(0).max(100).catch(50);
const score10 = z.number().min(1).max(10).catch(5);

// ---------------------------------------------------------------- Agent 1
export const DeckIntakeSchema = z.object({
  company_name: str,
  website: str,
  headquarters: str,
  founded_year: str,
  sector: str,
  subsector: str,
  business_model: str,
  product_description: str,
  core_value_proposition: str,
  target_customers: strArr,
  customer_segments: strArr,
  revenue_model: str,
  pricing_model: str,
  traction_metrics: strArr,
  financial_metrics: z.object({
    revenue: str,
    arr: str,
    growth_rate: str,
    gross_margin: str,
    ebitda: str,
    burn_rate: str,
    runway: str,
    cash_balance: str,
  }),
  market_size_claims: strArr,
  competitors_mentioned: strArr,
  customer_logos: strArr,
  partnerships: strArr,
  team_highlights: strArr,
  strategic_assets: strArr,
  risks_or_gaps: strArr,
  missing_information: strArr,
  facts: strArr,
  assumptions: strArr,
  confidence_score: confidence,
});
export type DeckIntake = z.infer<typeof DeckIntakeSchema>;

// ---------------------------------------------------------------- Agent 2
export const CompanyProfileSchema = z.object({
  executive_summary: str,
  what_the_company_does: str,
  industry_category: str,
  business_model: str,
  customer_profile: str,
  why_the_company_may_be_acquirable: str,
  strategic_value_drivers: strArr,
  potential_buyer_categories: strArr,
  key_risks: strArr,
  diligence_questions: strArr,
  facts: strArr,
  assumptions: strArr,
  missing_data: strArr,
  confidence_score: confidence,
});
export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

// ---------------------------------------------------------------- Agent 3
export const FinancialAnalysisSchema = z.object({
  financial_summary: str,
  company_stage: str, // pre-revenue | revenue-stage | growth-stage | profitable | distressed
  likely_valuation_method: str,
  rough_valuation_logic: str,
  financial_strengths: strArr,
  financial_risks: strArr,
  missing_financial_data: strArr,
  key_diligence_questions: strArr,
  facts: strArr,
  assumptions: strArr,
  confidence_score: confidence,
});
export type FinancialAnalysis = z.infer<typeof FinancialAnalysisSchema>;

// ---------------------------------------------------------------- Agent 4
export const MarketMapSchema = z.object({
  market_category: str,
  market_description: str,
  market_tailwinds: strArr,
  market_headwinds: strArr,
  adjacent_markets: strArr,
  major_incumbents: strArr,
  emerging_competitors: strArr,
  strategic_buyer_categories: strArr,
  financial_buyer_categories: strArr,
  customer_buyer_categories: strArr,
  consolidation_rationale: str,
  market_risks: strArr,
  facts: strArr,
  assumptions: strArr,
  missing_data: strArr,
  confidence_score: confidence,
});
export type MarketMap = z.infer<typeof MarketMapSchema>;

// ---------------------------------------------------------------- Agent 5
export const CompetitorEntrySchema = z.object({
  company_name: str,
  description: str,
  why_relevant: str,
  relationship_to_target: str, // direct competitor | adjacent | substitute | incumbent
  potential_acquirer_or_competing_asset: str,
});
export const CompetitiveLandscapeSchema = z.object({
  direct_competitors: z.array(CompetitorEntrySchema).catch([]),
  adjacent_competitors: z.array(CompetitorEntrySchema).catch([]),
  large_incumbents: z.array(CompetitorEntrySchema).catch([]),
  substitutes: z.array(CompetitorEntrySchema).catch([]),
  defensive_acquirer_candidates: strArr,
  competitive_risks: strArr,
  differentiation_analysis: str,
  facts: strArr,
  assumptions: strArr,
  missing_data: strArr,
  confidence_score: confidence,
});
export type CompetitiveLandscape = z.infer<typeof CompetitiveLandscapeSchema>;

// ---------------------------------------------------------------- Agent 6
export const BuyerUniverseEntrySchema = z.object({
  buyer_name: z.string(),
  buyer_type: str, // Strategic | Adjacent Strategic | Competitor | PE-backed Platform | Customer-Buyer | Channel Partner | International Buyer
  industry: str,
  initial_rationale: str,
  buyer_category: str,
  estimated_fit: str, // High | Medium | Low
  research_needed: strArr,
});
export const BuyerDiscoverySchema = z.object({
  buyer_universe: z.array(BuyerUniverseEntrySchema),
  facts: strArr,
  assumptions: strArr,
  missing_data: strArr,
  confidence_score: confidence,
});
export type BuyerDiscovery = z.infer<typeof BuyerDiscoverySchema>;

// ---------------------------------------------------------------- Agent 7
export const BuyerResearchEntrySchema = z.object({
  buyer_name: z.string(),
  company_overview: str,
  relevant_business_units: strArr,
  strategic_priorities: strArr,
  m_and_a_history: strArr,
  recent_relevant_news: strArr,
  financial_capacity: str,
  product_gap: str,
  customer_overlap: str,
  strategic_fit_summary: str,
  reasons_to_acquire: strArr,
  reasons_not_to_acquire: strArr,
  evidence: strArr,
  confidence_score: confidence,
});
export const BuyerResearchSchema = z.object({
  buyer_research: z.array(BuyerResearchEntrySchema),
});
export type BuyerResearchOut = z.infer<typeof BuyerResearchSchema>;

// ---------------------------------------------------------------- Agent 8
export const RankedBuyerSchema = z.object({
  buyer_name: z.string(),
  buyer_type: str,
  product_fit: score10,
  customer_overlap: score10,
  market_expansion_fit: score10,
  m_and_a_history: score10,
  financial_capacity: score10,
  competitive_pressure: score10,
  integration_feasibility: score10,
  summary_rationale: str,
  key_risk: str,
  confidence_score: confidence,
});
export const ScoringSchema = z.object({
  ranked_buyers: z.array(RankedBuyerSchema),
});
export type ScoringOut = z.infer<typeof ScoringSchema>;

// ---------------------------------------------------------------- Agent 9
export const ValuationSchema = z.object({
  valuation_approach: str,
  possible_deal_type: str, // tuck-in | platform | acquihire | distressed | strategic premium | PE bolt-on
  valuation_drivers: strArr,
  valuation_risks: strArr,
  rough_range_if_possible: str,
  buyer_affordability_notes: strArr,
  data_needed_for_better_valuation: strArr,
  disclaimer: str.catch(
    'Directional analysis only. This is not a formal valuation.'
  ),
  facts: strArr,
  assumptions: strArr,
  confidence_score: confidence,
});
export type Valuation = z.infer<typeof ValuationSchema>;

// ---------------------------------------------------------------- Agent 10
export const BuyerThesisEntrySchema = z.object({
  buyer_name: z.string(),
  acquisition_thesis: str,
  product_synergy: str,
  revenue_synergy: str,
  customer_synergy: str,
  technology_synergy: str,
  data_synergy: str,
  team_or_talent_rationale: str,
  competitive_rationale: str,
  integration_path: str,
  potential_objections: strArr,
  objection_responses: strArr,
  recommended_outreach_angle: str,
  best_contact_type: str,
  confidence_score: confidence,
});
export const SynergyThesisSchema = z.object({
  buyer_theses: z.array(BuyerThesisEntrySchema),
});
export type SynergyThesisOut = z.infer<typeof SynergyThesisSchema>;

// ---------------------------------------------------------------- Agent 11
export const OutreachMessageEntrySchema = z.object({
  buyer_name: str, // empty/"" for buyer-agnostic materials like the teaser
  message_type: z.string(), // anonymous_teaser | buyer_email | linkedin_message | corp_dev_email | product_leader_email | ceo_email | first_call_script | objection_handling | follow_up_email
  subject: str,
  body: z.string(),
});
export const OutreachSchema = z.object({
  messages: z.array(OutreachMessageEntrySchema),
});
export type OutreachOut = z.infer<typeof OutreachSchema>;

export const AGENT_SCHEMAS = {
  deck_intake: DeckIntakeSchema,
  company_profile: CompanyProfileSchema,
  financial_analysis: FinancialAnalysisSchema,
  market_map: MarketMapSchema,
  competitive_landscape: CompetitiveLandscapeSchema,
  buyer_discovery: BuyerDiscoverySchema,
  buyer_research: BuyerResearchSchema,
  strategic_fit_scoring: ScoringSchema,
  valuation: ValuationSchema,
  synergy_thesis: SynergyThesisSchema,
  outreach: OutreachSchema,
} as const;

export type AgentName = keyof typeof AGENT_SCHEMAS;
