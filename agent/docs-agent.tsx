import { docsTool } from "@/tool/docs-tool";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, InferAgentUIMessage } from "ai";
import type { LlmProvider } from "@/lib/llm";

export const createDocsAgent = ({
  provider,
  apiKey,
  model,
}: {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}) => {
  const client =
    provider === "anthropic"
      ? createAnthropic({ apiKey })
      : createOpenAI({
          apiKey,
          baseURL:
            provider === "openrouter"
              ? "https://openrouter.ai/api/v1"
              : undefined,
        });

  return new ToolLoopAgent({
    model: client(model),
    instructions:
      "You are a helpful docs assistant. Prefer Context7-based retrieval by calling the docs tool with a specific query plus libraryName or libraryId whenever possible. If the user provides a URL, include it in the docs tool call; otherwise only use a URL when Context7 cannot resolve the library. Provide concise answers grounded in the tool output and cite the referenced sources.",
    tools: {
      docs: docsTool,
    },
  });
};

export type DocsAgentUIMessage = InferAgentUIMessage<
  ReturnType<typeof createDocsAgent>
>;
