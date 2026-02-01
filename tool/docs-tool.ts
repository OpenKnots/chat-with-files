import { UIToolInvocation, tool } from "ai";
import { z } from "zod";

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string) {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");

  const withNewlines = withoutScripts
    .replace(/<\/(p|div|section|article|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  const textOnly = withNewlines.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(textOnly);
  return decoded.replace(/\s+/g, " ").trim();
}

function extractTitle(html: string, textFallback: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return stripHtml(titleMatch[1]);
  }
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]) {
    return stripHtml(h1Match[1]);
  }
  return textFallback.slice(0, 80);
}

function summarizeText(text: string, maxSentences: number) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.slice(0, maxSentences).join(" ");
}

async function fetchText(url: string, opts?: { timeoutMs?: number }) {
  const controller = new AbortController();
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html, text/plain;q=0.9, */*;q=0.8",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Docs request failed (${res.status} ${res.statusText})${text ? `: ${text}` : ""
        }`
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain/i.test(contentType)) {
      throw new Error(
        `Unsupported content type (${contentType || "unknown"}). Expected HTML.`
      );
    }

    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOptionalText(url: string, opts?: { timeoutMs?: number }) {
  const controller = new AbortController();
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/plain, text/markdown;q=0.9, */*;q=0.8",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/plain|text\/markdown|text\/html/i.test(contentType)) {
      return null;
    }

    const text = await res.text();
    return text.trim() ? text : null;
  } finally {
    clearTimeout(timeout);
  }
}

export const docsTool = tool({
  description: "Fetch and summarize a standard docs page by URL",
  inputSchema: z.object({
    url: z.string().url().describe("Docs page URL to summarize"),
    maxChars: z
      .number()
      .int()
      .min(500)
      .max(20_000)
      .default(6_000)
      .describe("Maximum number of characters to return"),
    maxSentences: z
      .number()
      .int()
      .min(2)
      .max(12)
      .default(5)
      .describe("Maximum number of sentences in the summary"),
  }),
  async *execute(input: {
    url: string;
    maxChars: number;
    maxSentences: number;
  }) {
    const url = input.url.trim();
    const maxChars = input.maxChars;
    const maxSentences = input.maxSentences;

    yield { state: "loading" as const };

    const html = await fetchText(url);
    const text = stripHtml(html);
    if (!text) {
      throw new Error("No readable text was found on the page.");
    }

    const llmsTxtUrl = new URL("llms.txt", url).toString();
    const llmsFullTxtUrl = new URL("llms-full.txt", url).toString();
    const [llmsTxt, llmsFullTxt] = await Promise.all([
      fetchOptionalText(llmsTxtUrl),
      fetchOptionalText(llmsFullTxtUrl),
    ]);

    const title = extractTitle(html, text);
    const summary = summarizeText(text, maxSentences);
    const excerpt = text.slice(0, maxChars);

    yield {
      state: "ready" as const,
      docs: {
        url,
        title,
        summary,
        excerpt,
        contentLength: text.length,
        llmsTxt: llmsTxt ? llmsTxt.slice(0, maxChars) : null,
        llmsFullTxt: llmsFullTxt ? llmsFullTxt.slice(0, maxChars) : null,
        llmsTxtUrl,
        llmsFullTxtUrl,
      },
    };
  },
});

export type DocsUIToolInvocation = UIToolInvocation<typeof docsTool>;
