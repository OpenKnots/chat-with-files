 import { createAnthropic } from "@ai-sdk/anthropic";
 import { createOpenAI } from "@ai-sdk/openai";
 import { generateText } from "ai";
 import { isLlmProvider, isModelSupported } from "@/lib/llm";
 
 const systemPrompt =
   "You fix broken Mermaid diagrams. Return only valid Mermaid code with no code fences or extra text.";
 
const extractMermaid = (text: string) => {
  const mermaidMatch = text.match(/```mermaid\s*([\s\S]*?)```/i);
  if (mermaidMatch?.[1]) return mermaidMatch[1].trim();
  const fencedMatch = text.match(/```\s*([\s\S]*?)```/);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  return text.trim();
};
 
 export async function POST(request: Request) {
   const apiKey = request.headers.get("x-llm-key")?.trim();
   const provider = request.headers.get("x-llm-provider")?.trim() ?? "";
   const model = request.headers.get("x-llm-model")?.trim() ?? "";
   if (!apiKey) {
     return new Response("Missing API key.", { status: 401 });
   }
   if (!isLlmProvider(provider)) {
     return new Response("Invalid provider.", { status: 400 });
   }
   if (!model || !isModelSupported(provider, model)) {
     return new Response("Invalid model for provider.", { status: 400 });
   }
 
   const { chart, error } = (await request.json()) as {
     chart?: string;
     error?: string;
   };
 
   if (!chart || typeof chart !== "string") {
     return new Response("Missing Mermaid chart.", { status: 400 });
   }
 
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
 
   const prompt = [
     "Fix the Mermaid diagram below. Keep it minimal and valid.",
     error ? `Renderer error: ${error}` : null,
     "Diagram:",
     chart,
   ]
     .filter(Boolean)
     .join("\n\n");
 
   const result = await generateText({
     model: client(model),
     system: systemPrompt,
     prompt,
   });
 
  const fixedChart = extractMermaid(result.text);
  if (!fixedChart) {
    return new Response("AI did not return a valid Mermaid diagram.", {
      status: 422,
    });
  }
 
   return Response.json({ fixedChart });
 }
