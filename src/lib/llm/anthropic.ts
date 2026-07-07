import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider } from './types';

// Claude-backed provider. Uses streaming (long agent outputs would otherwise
// risk HTTP timeouts) with adaptive thinking, per current API guidance.

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export const anthropicProvider: LlmProvider = {
  name: 'anthropic',
  async complete({ system, user, maxTokens }) {
    const stream = getClient().messages.stream({
      model: MODEL,
      max_tokens: maxTokens ?? 32000,
      system,
      messages: [{ role: 'user', content: user }],
      // Adaptive thinking (Claude 4.6+ / Opus 4.7+). Cast because older SDK
      // typings may not yet include the "adaptive" variant; the API accepts it.
      ...({ thinking: { type: 'adaptive' } } as Record<string, unknown>),
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      throw new Error('The model declined this request (stop_reason: refusal).');
    }
    if (message.stop_reason === 'max_tokens') {
      throw new Error('Model output was truncated (max_tokens). Retry with a smaller batch.');
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (!text.trim()) throw new Error('Model returned an empty response.');
    return text;
  },
};
