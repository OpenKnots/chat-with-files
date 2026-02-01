export type LlmProvider = "openai" | "anthropic" | "openrouter";

export type LlmModelOption = {
  id: string;
  label: string;
};

export const LLM_PROVIDER_LABELS: Record<LlmProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
};

export const LLM_MODEL_OPTIONS: Record<LlmProvider, LlmModelOption[]> = {
  openai: [
    { id: "gpt-5", label: "GPT-5" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-20240620", label: "Claude 3.5 Sonnet" },
    { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
  ],
  openrouter: [
    { id: "openai/gpt-5", label: "GPT-5 (OpenRouter)" },
    { id: "openai/gpt-4o", label: "GPT-4o (OpenRouter)" },
    { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (OpenRouter)" },
  ],
};

export const DEFAULT_LLM_PROVIDER: LlmProvider = "openai";

export const DEFAULT_LLM_MODEL: Record<LlmProvider, string> = {
  openai: "gpt-5",
  anthropic: "claude-3-5-sonnet-20240620",
  openrouter: "openai/gpt-5",
};

export function isLlmProvider(value: string | null): value is LlmProvider {
  return value === "openai" || value === "anthropic" || value === "openrouter";
}

export function isModelSupported(provider: LlmProvider, model: string): boolean {
  return LLM_MODEL_OPTIONS[provider].some((option) => option.id === model);
}
