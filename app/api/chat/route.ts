import { docsAgent } from "@/agent/docs-agent";
import { githubAgent } from "@/agent/github-agent";
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

export async function POST(request: Request) {
  const { messages } = await request.json();

  const agent = isGithubQuery(messages ?? []) ? githubAgent : docsAgent;

  return createAgentUIStreamResponse({
    agent: agent as typeof docsAgent,
    uiMessages: messages,
  });
}