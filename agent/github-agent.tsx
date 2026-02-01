import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { githubTool } from "@/tool/github-tool";
import { ToolLoopAgent, InferAgentUIMessage } from "ai";
import type { LlmProvider } from "@/lib/llm";

export const createGithubAgent = ({
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
      "You are a helpful github assistant. If a conversation URL is provided in the system context, use it for github tool calls unless the user supplies a different URL. Provide concise answers grounded in the tool output.",
    tools: {
      github: githubTool,
    },
  });
};

export type GithubAgentUIMessage = InferAgentUIMessage<
  ReturnType<typeof createGithubAgent>
>;
