"use client";

import { useChat } from "@ai-sdk/react";
import ChatInput from "@/components/chat-input";
import type { DocsAgentUIMessage } from "@/agent/docs-agent";
import DocsView from "@/components/docs-view";
import type { DocsUIToolInvocation } from "@/tool/docs-tool";
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

export default function DocsChat() {
  const chat = useChat<DocsAgentUIMessage>();
  const { status, sendMessage, messages } = chat;
  const stop = (chat as unknown as { stop?: () => void }).stop;

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
          {messages?.length ? null : (
            <div className="pt-8 sm:pt-12">
              <div className="rounded-3xl border border-zinc-900/60 bg-zinc-950/30 p-4 shadow-sm backdrop-blur sm:p-6">
                <div className="text-base font-semibold sm:text-lg">
                  Welcome, ask DocChat anything about your docs or GitHub repo
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  Paste a docs page URL or a GitHub repo URL and ask questions.
                  DocChat will fetch the page, summarize it, and answer follow
                  ups grounded in the retrieved content.
                </div>
              </div>
            </div>
          )}
          <div className="py-6 sm:py-10">
            <div className="space-y-6">
              {messages?.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={`flex w-full gap-3 ${isUser ? "justify-end" : ""
                      }`}
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
        </div>
      </main>

      {/* Full-width fixed composer (ChatGPT-style) */}
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-900/60 bg-background">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-background" />
        <div className="pointer-events-auto relative w-full px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl min-w-full md:min-w-0 md:max-w-none lg:max-w-screen-2xl">
            <ChatInput
              status={status}
              stop={stop}
              suggestions={suggestions}
              onSubmit={(text: string) => sendMessage({ text })}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
