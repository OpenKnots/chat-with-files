"use client";

import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import ChatInput from "@/components/chat-input";
import SetupModal from "@/components/setup-modal";
import type { DocsAgentUIMessage } from "@/agent/docs-agent";
import type { GithubAgentUIMessage } from "@/agent/github-agent";
import DocsView from "@/components/docs-view";
import GithubView from "@/components/github-view";
import type { DocsUIToolInvocation } from "@/tool/docs-tool";
import type { GitHubUIToolInvocation } from "@/tool/github-tool";
import Image from "next/image";
import { Streamdown } from "streamdown";
import Link from "next/link";
import { GitHubIcon, TelegramIcon, XIcon } from "@/components/icons";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  isLlmProvider,
  isModelSupported,
  type LlmProvider,
} from "@/lib/llm";
import { documentationUrlOptions } from "@/lib/constants";

const suggestions = [
  "Summarize the getting started guide",
  "What does the auth API say about tokens?",
  "Summarize the repo and highlight key folders",
  "Explain the purpose of the `app/` folder in this repo",
];


type ChatUIMessage = DocsAgentUIMessage | GithubAgentUIMessage;

type TrendingRepo = {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
};

const LAST_URL_KEY = "docchat:last-url";
const PROVIDER_KEY = "docchat:provider";
const MODEL_KEY = "docchat:model";
const API_KEY_STORAGE = "docchat:api-key";
const SETUP_COMPLETE_KEY = "docchat:setup-complete";
const messagesStorageKey = (url: string) => `docchat:messages:${url}`;

function buildSystemMessage(url: string): ChatUIMessage {
  return {
    id: `system-${Date.now()}`,
    role: "system",
    parts: [
      {
        type: "text",
        text: `Conversation URL: ${url}. Use this URL for tool calls unless the user provides a different one. Respond in Markdown.`,
      },
    ],
  } as ChatUIMessage;
}

function loadStoredMessages(url: string): ChatUIMessage[] {
  if (!url || typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(messagesStorageKey(url));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChatUIMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildInitialMessages(url: string): ChatUIMessage[] {
  if (!url) return [];
  const stored = loadStoredMessages(url);
  const hasSystem = stored.some((message) => message.role === "system");
  if (stored.length === 0 || !hasSystem) {
    return [buildSystemMessage(url), ...stored];
  }
  return stored;
}

function ChatConversation({
  apiKey,
  provider,
  model,
  chatUrl,
  isKeyReady,
  isSetupComplete,
}: {
  apiKey: string;
  provider: LlmProvider;
  model: string;
  chatUrl: string;
  isKeyReady: boolean;
  isSetupComplete: boolean;
}) {
  const chat = useChat<ChatUIMessage>();
  const { status, sendMessage, messages, setMessages } = chat;
  const stop = (chat as unknown as { stop?: () => void }).stop;
  const isChatReady = isSetupComplete && isKeyReady;
  const isWaiting = status === "streaming" || status === "submitted";
  const [ellipsis, setEllipsis] = useState("");

  useEffect(() => {
    if (!chatUrl) {
      setMessages([]);
      return;
    }
    setMessages(buildInitialMessages(chatUrl));
  }, [chatUrl, setMessages]);

  useEffect(() => {
    if (!chatUrl || typeof window === "undefined") return;
    window.localStorage.setItem(
      messagesStorageKey(chatUrl),
      JSON.stringify(messages ?? [])
    );
  }, [chatUrl, messages]);

  useEffect(() => {
    if (!isWaiting) {
      setEllipsis("");
      return;
    }
    let step = 0;
    const id = window.setInterval(() => {
      step = (step + 1) % 4;
      setEllipsis(".".repeat(step));
    }, 450);
    return () => window.clearInterval(id);
  }, [isWaiting]);

  return (
    <div className="min-h-screen">
      {messages?.length ? null : (
        <div className="pt-8 sm:pt-12">
          <div className="rounded-3xl border border-zinc-900/60 p-4 shadow-sm sm:p-6">
            <div className="text-base font-semibold sm:text-lg">
              Welcome, ask anything about your docs or GitHub repo
            </div>
            <div className="mt-2 text-sm text-zinc-400">
              Paste a docs page URL or a GitHub repo URL and ask questions.
              Chat will fetch the page, summarize it, and answer follow ups
              grounded in the retrieved content.
            </div>
            {isSetupComplete && !isKeyReady && (
              <div className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300">
                Add your API Key to start chatting. It is saved in your
                browser local storage.
              </div>
            )}
          </div>
        </div>
      )}
      <div className="min-h-screen py-6 sm:py-10">
        <div className="min-h-screen space-y-6">
          {messages
            ?.filter((message) => message.role !== "system")
            .map((message) => {
              const isUser = message.role === "user";

              return (
                <div
                  key={message.id}
                  className={`flex w-full gap-3 ${isUser ? "justify-end" : ""}`}
                >
                  {!isUser && (
                    <Image
                      src="/logo.png"
                      alt="Chat"
                      width={32}
                      height={32}
                      className="mt-0.5 hidden size-8 shrink-0 rounded-full border border-zinc-900/60 bg-black p-1 object-contain shadow-sm sm:block"
                    />
                  )}

                  <div
                    className={`w-full ${isUser ? "max-w-[92%] sm:max-w-[80%]" : "max-w-full"
                      }`}
                  >
                    <div
                      className={[
                        "rounded-3xl px-4 py-3",
                        isUser
                          ? "ml-auto border border-zinc-900/60 text-zinc-100 shadow-sm"
                          : "border border-zinc-900/60 text-zinc-100 shadow-sm",
                      ].join(" ")}
                    >
                      {(() => {
                        const toolInvocations = message.parts.filter(
                          (part) =>
                            part.type === "tool-docs" ||
                            part.type === "tool-github"
                        );
                        const nonToolParts = message.parts.filter(
                          (part) =>
                            part.type !== "tool-docs" &&
                            part.type !== "tool-github"
                        );

                        return (
                          <div className="space-y-3">
                            {nonToolParts.map((part, index) => {
                              switch (part.type) {
                                case "text":
                                  return (
                                    <Streamdown
                                      key={index}
                                      className="md whitespace-pre-wrap text-sm leading-relaxed"
                                    >
                                      {part.text}
                                    </Streamdown>
                                  );

                                case "step-start":
                                  return index > 0 ? (
                                    <div key={index} className="py-1">
                                      <div className="h-px w-full bg-background" />
                                    </div>
                                  ) : null;
                              }
                            })}

                            {toolInvocations.length > 0 ? (
                              <details className="rounded-2xl border border-zinc-900/60 p-3">
                                <summary className="cursor-pointer select-none text-[11px] font-medium text-zinc-300">
                                  Tool calls ({toolInvocations.length})
                                </summary>
                                <div className="mt-3 space-y-2">
                                  {toolInvocations.map((part, index) => {
                                    if (part.type === "tool-docs") {
                                      const invocation =
                                        part as DocsUIToolInvocation & {
                                          toolCallId?: string;
                                          id?: string;
                                        };
                                      return (
                                        <DocsView
                                          key={
                                            invocation.toolCallId ??
                                            invocation.id ??
                                            index
                                          }
                                          invocation={invocation}
                                        />
                                      );
                                    }
                                    const invocation =
                                      part as GitHubUIToolInvocation & {
                                        toolCallId?: string;
                                        id?: string;
                                      };
                                    return (
                                      <GithubView
                                        key={
                                          invocation.toolCallId ??
                                          invocation.id ??
                                          index
                                        }
                                        invocation={invocation}
                                      />
                                    );
                                  })}
                                </div>
                              </details>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          {isWaiting ? (
            <div className="flex w-full gap-3">
              <Image
                src="/logo.png"
                alt="Chat"
                width={32}
                height={32}
                className="mt-0.5 hidden size-8 shrink-0 rounded-full border border-zinc-900/60 bg-black p-1 object-contain shadow-sm sm:block"
              />
              <div className="w-full max-w-full">
                <div className="rounded-3xl border border-zinc-900/60 px-4 py-3 text-zinc-100 shadow-sm">
                  <div
                    className="inline-flex items-center gap-1 text-sm leading-relaxed text-zinc-300"
                    aria-live="polite"
                  >
                    Waiting for response
                    <span className="inline-block w-4 text-left">
                      {ellipsis}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-900/60 bg-background">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-background" />
        <div className="pointer-events-auto relative w-full px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl min-w-full md:min-w-0 md:max-w-none lg:max-w-screen-2xl">
            <ChatInput
              status={isChatReady ? status : "blocked"}
              stop={stop}
              suggestions={suggestions}
              inputDisabled={!chatUrl || !isChatReady}
              placeholder={
                chatUrl
                  ? "Ask anything about your docs or GitHub repository…"
                  : "Paste a docs or GitHub URL above to start a conversation…"
              }
              onSubmit={(text: string) => {
                if (!chatUrl || !isChatReady) return;
                sendMessage(
                  { text },
                  {
                    body: { chatUrl },
                    headers: {
                      "x-llm-key": apiKey,
                      "x-llm-provider": provider,
                      "x-llm-model": model,
                    },
                  }
                );
              }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function DocsChat() {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<LlmProvider>(
    DEFAULT_LLM_PROVIDER
  );
  const [model, setModel] = useState(DEFAULT_LLM_MODEL[DEFAULT_LLM_PROVIDER]);
  const [chatUrl, setChatUrl] = useState("");
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [trendingRepos, setTrendingRepos] = useState<TrendingRepo[]>([]);
  const [trendingStatus, setTrendingStatus] = useState<
    "idle" | "loading" | "ready" | "error" | "rate-limited"
  >("idle");
  const [trendingMessage, setTrendingMessage] = useState("");
  const isKeyReady = apiKey.trim().length > 0 && !!model;

  useEffect(() => {
    const storedKey = localStorage.getItem(API_KEY_STORAGE);
    if (storedKey) setApiKey(storedKey);
    const storedProvider = localStorage.getItem(PROVIDER_KEY);
    const nextProvider = isLlmProvider(storedProvider)
      ? storedProvider
      : DEFAULT_LLM_PROVIDER;
    setProvider(nextProvider);
    const storedModel = localStorage.getItem(MODEL_KEY);
    const nextModel =
      storedModel && isModelSupported(nextProvider, storedModel)
        ? storedModel
        : DEFAULT_LLM_MODEL[nextProvider];
    setModel(nextModel);
    const storedUrl = localStorage.getItem(LAST_URL_KEY);
    if (storedUrl) {
      setChatUrl(storedUrl);
    }
    const storedSetupComplete = localStorage.getItem(SETUP_COMPLETE_KEY) === "true";
    const hasRequired = Boolean(storedKey && storedUrl);
    const setupReady = storedSetupComplete || hasRequired;
    setIsSetupComplete(setupReady);
    if (setupReady && !storedSetupComplete) {
      localStorage.setItem(SETUP_COMPLETE_KEY, "true");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadTrending = async () => {
      setTrendingStatus("loading");
      setTrendingMessage("");
      try {
        const response = await fetch("/api/trending", { cache: "no-store" });
        if (!response.ok) {
          if (response.status === 429) {
            const data = (await response.json()) as {
              error?: string;
              retryAfterSeconds?: number;
            };
            if (!isMounted) return;
            setTrendingStatus("rate-limited");
            setTrendingMessage(
              data?.error ??
              "Trending request rate limited. Try again later."
            );
            return;
          }
          throw new Error("Trending fetch failed");
        }
        const data = (await response.json()) as {
          repos?: TrendingRepo[];
          note?: string;
        };
        if (!isMounted) return;
        setTrendingRepos(data.repos ?? []);
        setTrendingStatus("ready");
        setTrendingMessage(
          data.note ??
          "Trending today uses GitHub search: repos created today, sorted by stars."
        );
      } catch {
        if (!isMounted) return;
        setTrendingStatus("error");
        setTrendingMessage("Unable to load trending repos right now.");
      }
    };
    loadTrending();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSetupSave = (data: {
    apiKey: string;
    chatUrl: string;
    provider: LlmProvider;
    model: string;
  }) => {
    setApiKey(data.apiKey);
    localStorage.setItem(API_KEY_STORAGE, data.apiKey);
    setProvider(data.provider);
    localStorage.setItem(PROVIDER_KEY, data.provider);
    setModel(data.model);
    localStorage.setItem(MODEL_KEY, data.model);
    setChatUrl(data.chatUrl);
    localStorage.setItem(LAST_URL_KEY, data.chatUrl);
    setIsSetupComplete(true);
    localStorage.setItem(SETUP_COMPLETE_KEY, "true");
    setIsSetupOpen(false);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-zinc-900/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.png"
              alt="Chat with Files"
              width={1200}
              height={1200}
              className="aspect-square size-8 shrink-0 rounded-md bg-black p-1 object-contain"
            />

            <div className="min-w-0">
              <div className="truncate text-sm font-medium leading-tight">
                Chat with Files
              </div>
              <div className="truncate text-[11px] leading-tight text-zinc-400">
                Chat with docs pages or GitHub repos
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSetupOpen(true)}
              className={`rounded-xl px-3 py-2 text-xs font-medium shadow-sm transition ${isSetupComplete
                  ? "border border-zinc-900/60 text-zinc-200 hover:bg-zinc-900/40"
                  : "bg-white text-zinc-950 hover:bg-zinc-200"
                }`}
            >
              Setup
            </button>
            <Link
              href="https://github.com/OpenKnots/chat-with-files"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              title="GitHub"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-zinc-900/60 bg-zinc-950/30 text-zinc-200 hover:bg-zinc-900/40"
            >
              <GitHubIcon className="size-5" />
            </Link>
            <Link
              href="https://x.com/OpenKnot"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              title="X (Twitter)"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-zinc-900/60 bg-zinc-950/30 text-zinc-200 hover:bg-zinc-900/40"
            >
              <XIcon className="size-5" />
            </Link>
            <Link
              href="https://t.me/OpenKnot"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              title="Telegram"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-zinc-900/60 bg-zinc-950/30 text-zinc-200 hover:bg-zinc-900/40"
            >
              <TelegramIcon className="size-5" />
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-screen-2xl px-4 pb-[calc(11rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-3xl min-w-full md:min-w-0 md:max-w-none lg:max-w-screen-2xl">
          {!isSetupComplete ? (
            <div className="pt-6 sm:pt-8">
              <div className="rounded-3xl border border-amber-900/60 p-4 text-sm text-amber-200 shadow-sm">
                <div className="font-medium">
                  Setup required before chatting.
                </div>
                <div className="mt-1 text-xs text-amber-200/80">
                  Click the Setup button to add your conversation URL, API key,
                  and model selection.
                </div>
                <button
                  type="button"
                  onClick={() => setIsSetupOpen(true)}
                  className="mt-3 rounded-2xl bg-white px-4 py-2 text-xs font-medium text-zinc-950 shadow-sm hover:bg-zinc-200"
                >
                  Open setup
                </button>
              </div>
            </div>
          ) : null}
          <ChatConversation
            key={chatUrl || "empty"}
            apiKey={apiKey}
            provider={provider}
            model={model}
            chatUrl={chatUrl}
            isKeyReady={isKeyReady}
            isSetupComplete={isSetupComplete}
          />
        </div>
      </main>
      <SetupModal
        isOpen={isSetupOpen}
        initialApiKey={apiKey}
        initialChatUrl={chatUrl}
        initialProvider={provider}
        initialModel={model}
        docsOptions={documentationUrlOptions}
        trendingRepos={trendingRepos}
        trendingStatus={trendingStatus}
        trendingMessage={trendingMessage}
        onClose={() => setIsSetupOpen(false)}
        onSave={handleSetupSave}
      />

    </div>
  );
}
