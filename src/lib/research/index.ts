// Web-research abstraction. The Buyer Research agent consumes whatever notes
// this service returns. The mock returns an explicit "no live research"
// marker; a real implementation can be plugged in here later (e.g. Claude's
// server-side web_search tool, or a search API) without touching the agents.

export interface WebResearchService {
  name: string;
  /** Returns research notes per buyer name (freeform text the agent can cite). */
  research(buyerNames: string[], context: { sector: string }): Promise<Record<string, string>>;
}

const mockResearch: WebResearchService = {
  name: 'mock',
  async research(buyerNames) {
    const notes: Record<string, string> = {};
    for (const name of buyerNames) {
      notes[name] =
        'No live web research available in this environment. All factual claims about this buyer require external verification before outreach.';
    }
    return notes;
  },
};

export function getResearchService(): WebResearchService {
  const provider = (process.env.WEB_RESEARCH_PROVIDER || '').toLowerCase();
  if (provider === 'anthropic-web-search') {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('WEB_RESEARCH_PROVIDER=anthropic-web-search requires ANTHROPIC_API_KEY — falling back to mock.');
      return mockResearch;
    }
    const { anthropicWebSearchResearch } =
      require('./anthropicWebSearch') as typeof import('./anthropicWebSearch');
    return anthropicWebSearchResearch;
  }
  return mockResearch;
}
