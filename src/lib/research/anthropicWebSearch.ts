import Anthropic from '@anthropic-ai/sdk';
import type { WebResearchService } from './index';

// Live buyer research via Claude's server-side web_search tool
// (web_search_20260209 — includes dynamic result filtering). Returns per-buyer
// research notes with cited source URLs that the Buyer Research agent can
// quote in its `evidence` arrays. Enabled with:
//   WEB_RESEARCH_PROVIDER=anthropic-web-search  (requires ANTHROPIC_API_KEY)

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
const BATCH_SIZE = 4; // buyers per research call — keeps searches focused

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM = `You are an M&A research analyst gathering factual background on potential acquirers.
For EACH company listed by the user, use web search to find:
- what the company does and its relevant business units
- recent acquisitions / M&A activity (with dates)
- recent strategic announcements relevant to the stated sector
- rough financial capacity signals (public/private, last funding, market cap if public)

Rules:
- Only report what you actually find; if search returns nothing useful for a company, say "No reliable public information found — requires manual verification."
- Cite the source URL in parentheses after every factual claim.
- Never speculate about acquisition interest in any specific target.

Output format: for each company, a section starting with "### <Company Name>" followed by bullet points. No other commentary.`;

async function researchBatch(names: string[], sector: string): Promise<string> {
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Sector context: ${sector}\n\nResearch these potential acquirers:\n${names
          .map((n) => `- ${n}`)
          .join('\n')}`,
      },
    ],
    // Server-side web search with dynamic filtering; capped to bound cost.
    // Cast: older SDK typings may not know this tool version — the API does.
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: names.length * 3 } as never],
    ...({ thinking: { type: 'adaptive' } } as Record<string, unknown>),
  });
  const message = await stream.finalMessage();
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

/** Split "### Name\n..." sections back into a per-buyer map. */
function splitSections(text: string, names: string[]): Record<string, string> {
  const notes: Record<string, string> = {};
  const parts = text.split(/^###\s+/m).filter(Boolean);
  for (const part of parts) {
    const [header, ...rest] = part.split('\n');
    const body = rest.join('\n').trim();
    const match = names.find((n) => header.trim().toLowerCase().includes(n.toLowerCase().slice(0, 24)));
    if (match && body) notes[match] = body;
  }
  for (const n of names) {
    if (!notes[n]) {
      notes[n] = 'Web research returned no parseable section for this buyer — requires manual verification.';
    }
  }
  return notes;
}

export const anthropicWebSearchResearch: WebResearchService = {
  name: 'anthropic-web-search',
  async research(buyerNames, context) {
    const notes: Record<string, string> = {};
    for (let i = 0; i < buyerNames.length; i += BATCH_SIZE) {
      const batch = buyerNames.slice(i, i + BATCH_SIZE);
      try {
        const text = await researchBatch(batch, context.sector);
        Object.assign(notes, splitSections(text, batch));
      } catch (err) {
        // Degrade gracefully — research failures must not sink the pipeline.
        const msg = `Live web research failed (${err instanceof Error ? err.message : err}) — requires manual verification.`;
        for (const n of batch) notes[n] = msg;
      }
    }
    return notes;
  },
};
