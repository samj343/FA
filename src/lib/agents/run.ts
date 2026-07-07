import { z } from 'zod';
import { AGENT_SCHEMAS, type AgentName } from './schemas';
import { buildSystemPrompt } from './prompts';
import { getProvider } from '../llm';

// Human-readable schema shapes appended to each system prompt. Kept as prose
// (not raw zod) so the model sees exactly the JSON we expect.
const SCHEMA_HINTS: Record<AgentName, string> = {
  deck_intake: `{
  "company_name": string, "website": string, "headquarters": string, "founded_year": string,
  "sector": string, "subsector": string, "business_model": string, "product_description": string,
  "core_value_proposition": string, "target_customers": string[], "customer_segments": string[],
  "revenue_model": string, "pricing_model": string, "traction_metrics": string[],
  "financial_metrics": {"revenue": string, "arr": string, "growth_rate": string, "gross_margin": string, "ebitda": string, "burn_rate": string, "runway": string, "cash_balance": string},
  "market_size_claims": string[], "competitors_mentioned": string[], "customer_logos": string[],
  "partnerships": string[], "team_highlights": string[], "strategic_assets": string[],
  "risks_or_gaps": string[], "missing_information": string[],
  "facts": string[], "assumptions": string[], "confidence_score": number (0-100)
}`,
  company_profile: `{
  "executive_summary": string (150-250 words), "what_the_company_does": string, "industry_category": string,
  "business_model": string, "customer_profile": string, "why_the_company_may_be_acquirable": string,
  "strategic_value_drivers": string[], "potential_buyer_categories": string[], "key_risks": string[],
  "diligence_questions": string[], "facts": string[], "assumptions": string[], "missing_data": string[],
  "confidence_score": number (0-100)
}`,
  financial_analysis: `{
  "financial_summary": string, "company_stage": string, "likely_valuation_method": string,
  "rough_valuation_logic": string, "financial_strengths": string[], "financial_risks": string[],
  "missing_financial_data": string[], "key_diligence_questions": string[],
  "facts": string[], "assumptions": string[], "confidence_score": number (0-100)
}`,
  market_map: `{
  "market_category": string, "market_description": string, "market_tailwinds": string[], "market_headwinds": string[],
  "adjacent_markets": string[], "major_incumbents": string[], "emerging_competitors": string[],
  "strategic_buyer_categories": string[], "financial_buyer_categories": string[], "customer_buyer_categories": string[],
  "consolidation_rationale": string, "market_risks": string[],
  "facts": string[], "assumptions": string[], "missing_data": string[], "confidence_score": number (0-100)
}`,
  competitive_landscape: `{
  "direct_competitors": CompetitorEntry[], "adjacent_competitors": CompetitorEntry[],
  "large_incumbents": CompetitorEntry[], "substitutes": CompetitorEntry[],
  "defensive_acquirer_candidates": string[], "competitive_risks": string[], "differentiation_analysis": string,
  "facts": string[], "assumptions": string[], "missing_data": string[], "confidence_score": number (0-100)
}
where CompetitorEntry = {"company_name": string, "description": string, "why_relevant": string, "relationship_to_target": "direct competitor" | "adjacent" | "substitute" | "incumbent", "potential_acquirer_or_competing_asset": string}`,
  buyer_discovery: `{
  "buyer_universe": [{
    "buyer_name": string,
    "buyer_type": "Strategic" | "Adjacent Strategic" | "Competitor" | "PE-backed Platform" | "Customer-Buyer" | "Channel Partner" | "International Buyer",
    "industry": string, "initial_rationale": string, "buyer_category": string,
    "estimated_fit": "High" | "Medium" | "Low", "research_needed": string[]
  }],
  "facts": string[], "assumptions": string[], "missing_data": string[], "confidence_score": number (0-100)
}`,
  buyer_research: `{
  "buyer_research": [{
    "buyer_name": string (exactly as provided), "company_overview": string, "relevant_business_units": string[],
    "strategic_priorities": string[], "m_and_a_history": string[], "recent_relevant_news": string[],
    "financial_capacity": string, "product_gap": string, "customer_overlap": string,
    "strategic_fit_summary": string, "reasons_to_acquire": string[], "reasons_not_to_acquire": string[],
    "evidence": string[], "confidence_score": number (0-100)
  }]
}`,
  strategic_fit_scoring: `{
  "ranked_buyers": [{
    "buyer_name": string (exactly as provided), "buyer_type": string,
    "product_fit": number (1-10), "customer_overlap": number (1-10), "market_expansion_fit": number (1-10),
    "m_and_a_history": number (1-10), "financial_capacity": number (1-10), "competitive_pressure": number (1-10),
    "integration_feasibility": number (1-10),
    "summary_rationale": string, "key_risk": string, "confidence_score": number (0-100)
  }]
}`,
  valuation: `{
  "valuation_approach": string, "possible_deal_type": string, "valuation_drivers": string[],
  "valuation_risks": string[], "rough_range_if_possible": string, "buyer_affordability_notes": string[],
  "data_needed_for_better_valuation": string[], "disclaimer": string,
  "facts": string[], "assumptions": string[], "confidence_score": number (0-100)
}`,
  synergy_thesis: `{
  "buyer_theses": [{
    "buyer_name": string (exactly as provided), "acquisition_thesis": string, "product_synergy": string,
    "revenue_synergy": string, "customer_synergy": string, "technology_synergy": string, "data_synergy": string,
    "team_or_talent_rationale": string, "competitive_rationale": string, "integration_path": string,
    "potential_objections": string[], "objection_responses": string[],
    "recommended_outreach_angle": string, "best_contact_type": string, "confidence_score": number (0-100)
  }]
}`,
  outreach: `{
  "messages": [{
    "buyer_name": string ("" for buyer-agnostic materials),
    "message_type": "anonymous_teaser" | "buyer_email" | "linkedin_message" | "corp_dev_email" | "product_leader_email" | "ceo_email" | "first_call_script" | "objection_handling" | "follow_up_email",
    "subject": string, "body": string
  }]
}`,
};

/** Strip markdown fences / stray prose and pull out the first JSON object. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model output.');
  }
  return candidate.slice(start, end + 1);
}

/**
 * Run one agent: build prompt, call the provider, parse and validate against
 * the agent's zod schema. On validation failure, retries once with the error
 * details appended so the model can self-correct (the mock never fails).
 */
export async function runAgent<T extends AgentName>(
  agent: T,
  input: unknown,
  opts: { maxTokens?: number } = {}
): Promise<z.infer<(typeof AGENT_SCHEMAS)[T]>> {
  const provider = getProvider();
  const schema = AGENT_SCHEMAS[agent];
  const system = buildSystemPrompt(agent, SCHEMA_HINTS[agent]);
  const user = typeof input === 'string' ? input : JSON.stringify(input, null, 2);

  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const suffix = attempt === 0
      ? ''
      : `\n\nYour previous response failed validation:\n${lastError}\nReturn corrected JSON only.`;
    const raw = await provider.complete({
      system,
      user: user + suffix,
      maxTokens: opts.maxTokens,
      agent,
    });
    try {
      const parsed = schema.parse(JSON.parse(extractJson(raw)));
      return parsed as z.infer<(typeof AGENT_SCHEMAS)[T]>;
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 2000) : String(err);
    }
  }
  throw new Error(`Agent "${agent}" failed validation after retry: ${lastError.slice(0, 500)}`);
}
