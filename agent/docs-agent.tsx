import { docsTool } from "@/tool/docs-tool";
import { createOpenAI } from "@ai-sdk/openai";
import { ToolLoopAgent, InferAgentUIMessage } from "ai";

export const createDocsAgent = (apiKey: string) => {
  const openai = createOpenAI({ apiKey });
  return new ToolLoopAgent({
    model: openai("gpt-4o"),
    instructions:
      "You are a helpful docs assistant. When asked to summarize or answer questions about a docs URL, call the docs tool with the URL. Provide concise answers grounded in the tool output.",
    tools: {
      docs: docsTool,
    },
  });
};

export type DocsAgentUIMessage = InferAgentUIMessage<
  ReturnType<typeof createDocsAgent>
>;
