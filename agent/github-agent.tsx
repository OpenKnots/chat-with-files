import { createOpenAI } from "@ai-sdk/openai";
import { githubTool } from "@/tool/github-tool";
import { ToolLoopAgent, InferAgentUIMessage } from "ai";

export const createGithubAgent = (apiKey: string) => {
  const openai = createOpenAI({ apiKey });
  return new ToolLoopAgent({
    model: openai("gpt-4o"),
    instructions:
      "You are a helpful github assistant. When asked to summarize or answer questions about a github repository, call the github tool with the repository URL. Provide concise answers grounded in the tool output.",
    tools: {
      github: githubTool,
    },
  });
};

export type GithubAgentUIMessage = InferAgentUIMessage<
  ReturnType<typeof createGithubAgent>
>;
