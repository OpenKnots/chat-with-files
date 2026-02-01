import { docsTool } from "@/tool/docs-tool";
import { openai } from "@ai-sdk/openai";
import { ToolLoopAgent, InferAgentUIMessage } from "ai";

export const docsAgent = new ToolLoopAgent({
  model: openai("gpt-4o"),
  instructions:
    "You are a helpful docs assistant. When asked to summarize or answer questions about a docs URL, call the docs tool with the URL. Provide concise answers grounded in the tool output.",
  tools: {
    docs: docsTool,
  },
});

export type DocsAgentUIMessage = InferAgentUIMessage<typeof docsAgent>;
