import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LLM_MODEL,
  LLM_MODEL_OPTIONS,
  LLM_PROVIDER_LABELS,
  type LlmProvider,
  isModelSupported,
} from "@/lib/llm";

type SetupModalProps = {
  isOpen: boolean;
  initialApiKey: string;
  initialChatUrl: string;
  initialProvider: LlmProvider;
  initialModel: string;
  docsOptions: Array<{ label: string; url: string }>;
  trendingRepos: Array<{
    id: number;
    full_name: string;
    html_url: string;
    language: string | null;
    stargazers_count: number;
  }>;
  trendingStatus: "idle" | "loading" | "ready" | "error" | "rate-limited";
  trendingMessage: string;
  onClose: () => void;
  onSave: (data: {
    apiKey: string;
    chatUrl: string;
    provider: LlmProvider;
    model: string;
  }) => void;
};

function normalizeUrlInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^git@github\.com:/i.test(trimmed)) {
    return trimmed.replace(/^git@github\.com:/i, "https://github.com/");
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  if (/^github\.com\//i.test(trimmed)) return `https://${trimmed}`;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function isDocsUrl(url: URL) {
  return url.hostname.startsWith("docs.") || url.pathname.startsWith("/docs");
}

function isGithubUrl(url: URL) {
  return url.hostname.endsWith("github.com");
}

function isHardcodedOption(
  url: URL,
  options: Array<{ label: string; url: string }>
) {
  return options.some((option) => {
    try {
      return new URL(option.url).toString() === url.toString();
    } catch {
      return false;
    }
  });
}

export default function SetupModal({
  isOpen,
  initialApiKey,
  initialChatUrl,
  initialProvider,
  initialModel,
  docsOptions,
  trendingRepos,
  trendingStatus,
  trendingMessage,
  onClose,
  onSave,
}: SetupModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [chatUrl, setChatUrl] = useState("");
  const [provider, setProvider] = useState<LlmProvider>(initialProvider);
  const [model, setModel] = useState(initialModel);
  const [urlError, setUrlError] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const nextChatUrl = initialChatUrl || "https://docs.openclaw.ai";
    setApiKey(initialApiKey);
    setChatUrl(nextChatUrl);
    setProvider(initialProvider);
    setModel(
      isModelSupported(initialProvider, initialModel)
        ? initialModel
        : DEFAULT_LLM_MODEL[initialProvider]
    );
    setUrlError("");
    setApiKeyError("");
  }, [isOpen, initialApiKey, initialChatUrl, initialProvider, initialModel]);

  const modelOptions = useMemo(
    () => LLM_MODEL_OPTIONS[provider] ?? [],
    [provider]
  );

  const handleProviderChange = (nextProvider: LlmProvider) => {
    setProvider(nextProvider);
    const nextModel = DEFAULT_LLM_MODEL[nextProvider];
    setModel(nextModel);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-xl rounded-3xl border border-zinc-900/60 bg-zinc-950 p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Setup"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Setup required
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Add your conversation URL, API key, and model before chatting.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-900/60 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900/40"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-300">
              Conversation URL (docs or GitHub repo)
            </label>
            <input
              type="url"
              value={chatUrl}
              onChange={(event) => {
                const nextValue = event.target.value;
                setChatUrl(nextValue);
                const normalized = normalizeUrlInput(nextValue);
                if (!normalized) {
                  setUrlError("");
                  return;
                }
                try {
                  const parsed = new URL(normalized);
                  const isHardcoded = isHardcodedOption(parsed, docsOptions);
                  if (!isHardcoded && !isDocsUrl(parsed) && !isGithubUrl(parsed)) {
                    setUrlError(
                      "Conversation URL must be a docs page or GitHub repo."
                    );
                  } else {
                    setUrlError("");
                  }
                } catch {
                  setUrlError("Enter a valid URL, including https://.");
                }
              }}
              placeholder="https://docs.openclaw.ai or https://github.com/org/repo"
              className="mt-2 w-full rounded-2xl border border-zinc-900/60 bg-zinc-950/30 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              spellCheck={false}
            />
            {urlError ? (
              <div className="mt-2 text-xs text-red-300">{urlError}</div>
            ) : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[11px] font-medium text-zinc-300">
                  Documentation URLs
                </div>
                <select
                  defaultValue=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setChatUrl(event.target.value);
                    event.currentTarget.value = "";
                  }}
                  className="mt-2 w-full rounded-2xl border border-zinc-900/60 bg-zinc-950/40 px-4 py-2 text-[11px] text-zinc-200 outline-none"
                >
                  <option value="" disabled>
                    Select documentation URL
                  </option>
                  {docsOptions.map((option) => (
                    <option key={option.url} value={option.url}>
                      {option.label} — {option.url}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-zinc-300">
                  <span>Trending Repositories</span>
                </div>
                <select
                  defaultValue=""
                  disabled={trendingStatus !== "ready" || !trendingRepos.length}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setChatUrl(event.target.value);
                    event.currentTarget.value = "";
                  }}
                  className="mt-2 w-full rounded-2xl border border-zinc-900/60 bg-zinc-950/40 px-4 py-2 text-[11px] text-zinc-200 outline-none disabled:cursor-not-allowed disabled:text-zinc-500"
                >
                  <option value="" disabled>
                    {trendingStatus === "loading"
                      ? "Loading trending repositories..."
                      : trendingStatus === "rate-limited"
                        ? "Trending rate limited"
                        : trendingStatus === "error"
                          ? "Unable to load trending repos"
                          : "Select a trending repository"}
                  </option>
                  {trendingRepos.map((repo) => (
                    <option key={repo.id} value={repo.html_url}>
                      {repo.full_name} · {repo.language ?? "Unknown"} · ★
                      {repo.stargazers_count}
                    </option>
                  ))}
                </select>
                {trendingStatus !== "ready" ? (
                  <div className="mt-2 text-[10px] text-zinc-500">
                    {trendingMessage ||
                      "Trending uses GitHub search for repos created today."}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-300">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="api-key"
              className="mt-2 w-full rounded-2xl border border-zinc-900/60 bg-zinc-950/30 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              autoComplete="off"
              spellCheck={false}
            />
            {apiKeyError ? (
              <div className="mt-2 text-xs text-red-300">{apiKeyError}</div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-300">
                Provider
              </label>
              <select
                value={provider}
                onChange={(event) =>
                  handleProviderChange(event.target.value as LlmProvider)
                }
                className="mt-2 w-full rounded-2xl border border-zinc-900/60 bg-zinc-950/40 px-4 py-2 text-sm text-zinc-100 outline-none"
              >
                {Object.entries(LLM_PROVIDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-300">Model</label>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-zinc-900/60 bg-zinc-950/40 px-4 py-2 text-sm text-zinc-100 outline-none"
              >
                {modelOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-zinc-900/60 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const trimmedKey = apiKey.trim();
              const normalizedUrl = normalizeUrlInput(chatUrl);
              let hasError = false;
              if (!normalizedUrl) {
                setUrlError("Conversation URL is required.");
                hasError = true;
              } else {
                try {
                  const parsed = new URL(normalizedUrl);
                  const isHardcoded = isHardcodedOption(parsed, docsOptions);
                  if (!isHardcoded && !isDocsUrl(parsed) && !isGithubUrl(parsed)) {
                    setUrlError(
                      "Conversation URL must be a docs page or GitHub repo."
                    );
                    hasError = true;
                  } else {
                    setChatUrl(parsed.toString());
                    setUrlError("");
                  }
                } catch {
                  setUrlError("Enter a valid URL, including https://.");
                  hasError = true;
                }
              }
              if (!trimmedKey) {
                setApiKeyError("API key is required.");
                hasError = true;
              } else {
                setApiKeyError("");
              }
              if (hasError) return;
              const parsed = new URL(normalizedUrl);
              onSave({
                apiKey: trimmedKey,
                chatUrl: parsed.toString(),
                provider,
                model,
              });
            }}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-zinc-950 shadow-sm hover:bg-zinc-200"
          >
            Save setup
          </button>
        </div>
      </div>
    </div>
  );
}
