import { createDocsAgent } from "@/agent/docs-agent";
import { createGithubAgent } from "@/agent/github-agent";
import { createAgentUIStreamResponse } from "ai";

type UiMessage = {
  role?: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
};

function getMessageText(message: UiMessage): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n");
  }
  return "";
}

function isGithubQuery(messages: UiMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user") continue;
    const text = getMessageText(msg);
    if (!text) continue;
    if (/github\.com\/[^\s]+/i.test(text)) return true;
    if (/git@github\.com:[^\s]+/i.test(text)) return true;
    if (/\bgithub\b/i.test(text) && /[\w.-]+\/[\w.-]+/.test(text)) return true;
  }
  return false;
}

function isGithubUrl(url?: string): boolean {
  if (!url) return false;
  if (/^git@github\.com:/i.test(url)) return true;
  return /github\.com/i.test(url);
}

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-openai-key")?.trim();
  if (!apiKey) {
    return new Response("Missing OpenAI API key.", { status: 401 });
  }

  const { messages, chatUrl } = await request.json();

  const agent = isGithubUrl(chatUrl) || isGithubQuery(messages ?? [])
    ? createGithubAgent(apiKey)
    : createDocsAgent(apiKey);

  return createAgentUIStreamResponse({
    agent: agent as unknown as ReturnType<typeof createDocsAgent>,
    uiMessages: messages,
  });
}