export interface CompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
  /** Which pipeline agent is calling — the mock provider dispatches on this. */
  agent?: string;
}

export interface LlmProvider {
  name: string;
  complete(req: CompletionRequest): Promise<string>;
}
