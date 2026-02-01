"use client";

import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import ChatInput from "@/components/chat-input";
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

const suggestions = [
  "Summarize https://docs.example.com/getting-started",
  "What does https://docs.example.com/api/auth say about tokens?",
  "Summarize https://github.com/org/repo and highlight key folders",
  "Explain the purpose of the `app/` folder in https://github.com/org/repo",
];

type ChatUIMessage = DocsAgentUIMessage | GithubAgentUIMessage;

const LAST_URL_KEY = "docchat:last-url";
const messagesStorageKey = (url: string) => `docchat:messages:${url}`;

function isGithubUrl(url: string) {
  if (!url) return false;
  if (/^git@github\.com:/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().endsWith("github.com");
  } catch {
    return /github\.com/i.test(url);
  }
}

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

function buildSystemMessage(url: string): ChatUIMessage {
  return {
    id: `system-${Date.now()}`,
    role: "system",
    parts: [
      {
        type: "text",
        text: `Conversation URL: ${url}. Use this URL for tool calls unless the user provides a different one.`,
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
  chatUrl,
  isKeyReady,
  onApiKeyChange,
}: {
  apiKey: string;
  chatUrl: string;
  isKeyReady: boolean;
  onApiKeyChange: (nextKey: string) => void;
}) {
  const chat = useChat<ChatUIMessage>();
  const { status, sendMessage, messages, setMessages } = chat;
  const stop = (chat as unknown as { stop?: () => void }).stop;

  useEffect(() => {
    if (!chatUrl) return;
    setMessages(buildInitialMessages(chatUrl));
  }, [chatUrl, setMessages]);

  useEffect(() => {
    if (!chatUrl || typeof window === "undefined") return;
    window.localStorage.setItem(
      messagesStorageKey(chatUrl),
      JSON.stringify(messages ?? [])
    );
  }, [chatUrl, messages]);

  return (
    <>
      {messages?.length ? null : (
        <div className="pt-8 sm:pt-12">
          <div className="rounded-3xl border border-zinc-900/60 bg-zinc-950/30 p-4 shadow-sm backdrop-blur sm:p-6">
            <div className="text-base font-semibold sm:text-lg">
              Welcome, ask DocChat anything about your docs or GitHub repo
            </div>
            <div className="mt-2 text-sm text-zinc-400">
              Paste a docs page URL or a GitHub repo URL and ask questions.
              DocChat will fetch the page, summarize it, and answer follow ups
              grounded in the retrieved content.
            </div>
            {!isKeyReady && (
              <div className="mt-4 rounded-2xl border border-zinc-900/60 bg-zinc-950/40 p-3 text-xs text-zinc-300">
                Add your OpenAI API key to start chatting. It is saved in your
                browser local storage.
              </div>
            )}
          </div>
        </div>
      )}
      <div className="py-6 sm:py-10">
        <div className="space-y-6">
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
                      alt="DocChat"
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
                          ? "ml-auto border border-zinc-900/60 bg-zinc-900/80 text-zinc-100 shadow-sm"
                          : "border border-zinc-900/60 bg-zinc-950/30 text-zinc-100 shadow-sm",
                      ].join(" ")}
                    >
                      <div className="space-y-3">
                        {message.parts.map((part, index) => {
                          switch (part.type) {
                            case "text":
                              return message.role === "assistant" ? (
                                <Streamdown
                                  key={index}
                                  className="md whitespace-pre-wrap text-sm leading-relaxed"
                                >
                                  {part.text}
                                </Streamdown>
                              ) : (
                                <div
                                  key={index}
                                  className="whitespace-pre-wrap text-sm leading-relaxed"
                                >
                                  {part.text}
                                </div>
                              );

                            case "step-start":
                              return index > 0 ? (
                                <div key={index} className="py-1">
                                  <div className="h-px w-full bg-background" />
                                </div>
                              ) : null;

                            case "tool-docs": {
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
                            case "tool-github": {
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
                            }
                          }
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-900/60 bg-background">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-background" />
        <div className="pointer-events-auto relative w-full px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl min-w-full md:min-w-0 md:max-w-none lg:max-w-screen-2xl">
            <div className="mb-3 flex items-center gap-2 rounded-2xl border border-zinc-900/60 bg-zinc-950/30 px-3 py-2 text-xs text-zinc-200 sm:hidden">
              <label htmlFor="openai-api-key-mobile" className="text-zinc-400">
                OpenAI key
              </label>
              <input
                id="openai-api-key-mobile"
                type="password"
                value={apiKey}
                onChange={(event) => onApiKeyChange(event.target.value)}
                placeholder="sk-..."
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-zinc-600"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <ChatInput
              status={isKeyReady ? status : "blocked"}
              stop={stop}
              suggestions={suggestions}
              inputDisabled={!chatUrl || !isKeyReady}
              placeholder={
                chatUrl
                  ? "Ask Chat Assistant anything about your docs or GitHub repository…"
                  : "Paste a docs or GitHub URL above to start a conversation…"
              }
              onSubmit={(text: string) => {
                if (!chatUrl || !isKeyReady) return;
                sendMessage(
                  { text },
                  {
                    body: { chatUrl },
                    headers: apiKey ? { "x-openai-key": apiKey } : undefined,
                  }
                );
              }}
            />
          </div>
        </div>
      </footer>
    </>
  );
}

export default function DocsChat() {
  const [apiKey, setApiKey] = useState("");
  const [chatUrl, setChatUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const isKeyReady = apiKey.trim().length > 0;
  const isGithubTarget = isGithubUrl(chatUrl);

  useEffect(() => {
    const stored = localStorage.getItem("openai_api_key");
    if (stored) setApiKey(stored);
    const storedUrl = localStorage.getItem(LAST_URL_KEY);
    if (storedUrl) {
      setChatUrl(storedUrl);
      setUrlInput(storedUrl);
    }
  }, []);

  const handleApiKeyChange = (nextKey: string) => {
    setApiKey(nextKey);
    if (nextKey.trim().length === 0) {
      localStorage.removeItem("openai_api_key");
      return;
    }
    localStorage.setItem("openai_api_key", nextKey);
  };

  const handleUrlSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeUrlInput(urlInput);
    if (!normalized) {
      setUrlError("Enter a docs or GitHub URL to start a conversation.");
      return;
    }
    try {
      const parsed = new URL(normalized);
      setChatUrl(parsed.toString());
      setUrlInput(parsed.toString());
      setUrlError("");
      localStorage.setItem(LAST_URL_KEY, parsed.toString());
    } catch {
      setUrlError("Enter a valid URL, including https://.");
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-zinc-900/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.png"
              alt="DocChat"
              width={1200}
              height={1200}
              className="aspect-square size-8 shrink-0 rounded-md bg-black p-1 object-contain"
            />

            <div className="min-w-0">
              <div className="truncate text-sm font-medium leading-tight">
                Chat Assistant
              </div>
              <div className="truncate text-[11px] leading-tight text-zinc-400">
                Chat with docs pages or GitHub repos
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-zinc-900/60 bg-zinc-950/30 px-2 py-1 sm:flex">
              <label
                htmlFor="openai-api-key"
                className="text-[11px] text-zinc-400"
              >
                OpenAI API key
              </label>
              <input
                id="openai-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => handleApiKeyChange(event.target.value)}
                placeholder="sk-..."
                className="w-44 bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
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
          <form onSubmit={handleUrlSubmit} className="pt-8 sm:pt-10">
            <div className="rounded-3xl border border-zinc-900/60 bg-zinc-950/30 p-4 shadow-sm backdrop-blur sm:p-6">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-100">
                Conversation URL
                {chatUrl ? (
                  <span className="rounded-full border border-zinc-900/60 bg-zinc-950/40 px-2 py-0.5 text-[11px] text-zinc-300">
                    {isGithubTarget ? "GitHub" : "Docs"}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  placeholder="https://docs.example.com/getting-started"
                  className="flex-1 rounded-2xl border border-zinc-900/60 bg-zinc-950/30 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-zinc-950 shadow-sm hover:bg-zinc-200"
                >
                  Use URL
                </button>
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                {chatUrl
                  ? `Persisting this conversation for ${chatUrl}`
                  : "Paste a docs or GitHub URL to start a persistent conversation."}
              </div>
              {urlError ? (
                <div className="mt-2 text-xs text-red-300">{urlError}</div>
              ) : null}
            </div>
          </form>
          <ChatConversation
            key={chatUrl || "empty"}
            apiKey={apiKey}
            chatUrl={chatUrl}
            isKeyReady={isKeyReady}
            onApiKeyChange={handleApiKeyChange}
          />
        </div>
      </main>

    </div>
  );
}
