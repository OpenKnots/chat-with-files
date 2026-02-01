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
      "You are a helpful docs assistant. If a conversation URL is provided in the system context, use it for docs tool calls unless the user supplies a different URL. Provide concise answers grounded in the tool output.",
    tools: {
      docs: docsTool,
    },
  });
};

export type DocsAgentUIMessage = InferAgentUIMessage<
  ReturnType<typeof createDocsAgent>
>;
