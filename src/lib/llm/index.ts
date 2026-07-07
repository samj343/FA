import type { LlmProvider } from './types';
import { mockProvider } from './mock';

// Provider selection: explicit LLM_PROVIDER wins; otherwise Anthropic when a
// key is present, mock otherwise. The mock keeps the whole workflow usable
// offline and in CI.
export function getProvider(): LlmProvider {
  const explicit = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (explicit === 'mock') return mockProvider;
  if (explicit === 'anthropic' || process.env.ANTHROPIC_API_KEY) {
    // Lazy require so the mock path never needs the SDK configured.
    const { anthropicProvider } = require('./anthropic') as typeof import('./anthropic');
    return anthropicProvider;
  }
  return mockProvider;
}
