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
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { id: "gpt-4o", label: "GPT-4o" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-5-20250929", label: "Claude 4.5 Sonnet" },
  ],
  openrouter: [
    { id: "openai/gpt-5", label: "GPT-5 (OpenRouter)" },
    { id: "openai/gpt-4.1", label: "GPT-4.1 (OpenRouter)" },
    { id: "openai/gpt-4.1-mini", label: "GPT-4.1 mini (OpenRouter)" },
    { id: "openai/gpt-4o", label: "GPT-4o (OpenRouter)" },
    {
      id: "anthropic/claude-4.5-sonnet",
      label: "Claude 4.5 Sonnet (OpenRouter)",
    },
    {
      id: "anthropic/claude-4.5-haiku",
      label: "Claude 4.5 Haiku (OpenRouter)",
    },
    { id: "anthropic/claude-4-opus", label: "Claude 4 Opus (OpenRouter)" },
    { id: "mistralai/mistral-large", label: "Mistral Large (OpenRouter)" },
    { id: "mistralai/mixtral-8x7b", label: "Mixtral 8x7B (OpenRouter)" },
  ],
};

export const DEFAULT_LLM_PROVIDER: LlmProvider = "openai";

export const DEFAULT_LLM_MODEL: Record<LlmProvider, string> = {
  openai: "gpt-5",
  anthropic: "claude-sonnet-4-5-20250929",
  openrouter: "openai/gpt-5",
};

export function isLlmProvider(value: string | null): value is LlmProvider {
  return value === "openai" || value === "anthropic" || value === "openrouter";
}

export function isModelSupported(provider: LlmProvider, model: string): boolean {
  return LLM_MODEL_OPTIONS[provider].some((option) => option.id === model);
}
