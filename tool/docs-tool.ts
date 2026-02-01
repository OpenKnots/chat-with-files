import { UIToolInvocation, tool } from "ai";
import { z } from "zod";

const CONTEXT7_BASE_URL = "https://context7.com/api/v2";
const CONTEXT7_API_KEY = process.env.CONTEXT7_API_KEY;

type Context7Library = {
  id: string;
  name?: string;
  description?: string;
  totalSnippets?: number;
  trustScore?: number;
  benchmarkScore?: number;
  versions?: string[];
};

type Context7Snippet = {
  title?: string;
  content?: string;
  source?: string;
};

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

function normalizeSnippet(text: string, maxChars: number) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars).trim()}…`;
}

function isLibraryId(value?: string) {
  if (!value) return false;
  return /^\/[\w.-]+\/[\w.-]+(?:\/[\w.-]+)?$/.test(value.trim());
}

function scoreLibrary(library: Context7Library) {
  const totalSnippets = library.totalSnippets ?? 0;
  const trustScore = library.trustScore ?? 0;
  const benchmarkScore = library.benchmarkScore ?? 0;
  return totalSnippets + trustScore * 5 + benchmarkScore * 3;
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

async function fetchContext7Json<T>(
  url: string,
  opts?: { timeoutMs?: number }
) {
  const controller = new AbortController();
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      accept: "application/json",
    };
    if (CONTEXT7_API_KEY) {
      headers.authorization = `Bearer ${CONTEXT7_API_KEY}`;
    }
    const res = await fetch(url, {
      signal: controller.signal,
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `Context7 request failed (${res.status} ${res.statusText})${errorText ? `: ${errorText}` : ""
        }`
      );
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveContext7Library(
  libraryName: string,
  query: string
): Promise<Context7Library | null> {
  const params = new URLSearchParams({
    libraryName,
    query,
  });
  const url = `${CONTEXT7_BASE_URL}/libs/search?${params.toString()}`;
  const libraries = await fetchContext7Json<Context7Library[]>(url);
  if (!Array.isArray(libraries) || libraries.length === 0) return null;
  const sorted = [...libraries].sort(
    (a, b) => scoreLibrary(b) - scoreLibrary(a)
  );
  return sorted[0] ?? null;
}

async function queryContext7Docs(libraryId: string, query: string) {
  const params = new URLSearchParams({
    libraryId,
    query,
    type: "json",
  });
  const url = `${CONTEXT7_BASE_URL}/context?${params.toString()}`;
  const snippets = await fetchContext7Json<Context7Snippet[]>(url);
  if (!Array.isArray(snippets)) return [];
  return snippets.filter((snippet) => snippet.content || snippet.title);
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
  description: "Fetch documentation via Context7 or a URL fallback",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .default("Documentation overview")
      .describe("User question or task to ground docs retrieval"),
    url: z.string().url().optional().describe("Docs page URL to summarize"),
    libraryName: z
      .string()
      .optional()
      .describe("Library name for Context7 lookup (e.g. react, nextjs)"),
    libraryId: z
      .string()
      .optional()
      .describe("Context7 library ID (e.g. /vercel/next.js)"),
    maxChars: z
      .number()
      .int()
      .min(500)
      .max(20_000)
      .default(6_000)
      .describe("Maximum number of characters to return"),
    maxSectionChars: z
      .number()
      .int()
      .min(200)
      .max(5_000)
      .default(1_200)
      .describe("Maximum number of characters per section snippet"),
    maxSentences: z
      .number()
      .int()
      .min(2)
      .max(12)
      .default(5)
      .describe("Maximum number of sentences in the summary"),
  }),
  async *execute(input: {
    query: string;
    url?: string;
    libraryName?: string;
    libraryId?: string;
    maxChars: number;
    maxSectionChars: number;
    maxSentences: number;
  }) {
    const query = input.query.trim();
    const url = input.url?.trim();
    const maxChars = input.maxChars;
    const maxSectionChars = input.maxSectionChars;
    const maxSentences = input.maxSentences;

    yield { state: "loading" as const };

    let context7Result:
      | {
        source: "context7";
        title: string;
        summary: string;
        sections: Array<{
          heading: string;
          snippet: string;
          citationUrl?: string;
        }>;
        citations: Array<{ title?: string; url: string }>;
        libraryId?: string;
        libraryName?: string;
        query: string;
      }
      | null = null;

    const explicitLibraryId = isLibraryId(input.libraryId)
      ? input.libraryId?.trim()
      : undefined;
    const libraryName = input.libraryName?.trim();

    if (explicitLibraryId || libraryName) {
      try {
        const library =
          explicitLibraryId && isLibraryId(explicitLibraryId)
            ? ({ id: explicitLibraryId } as Context7Library)
            : await resolveContext7Library(
              libraryName ?? explicitLibraryId ?? "",
              query
            );

        if (library?.id) {
          const snippets = await queryContext7Docs(library.id, query);
          if (snippets.length > 0) {
            const sections = snippets.map((snippet) => ({
              heading: (snippet.title ?? "Documentation").trim(),
              snippet: normalizeSnippet(snippet.content ?? "", maxSectionChars),
              citationUrl: snippet.source?.trim() || undefined,
            }));

            const summarySource = snippets
              .map((snippet) => snippet.content ?? "")
              .join(" ");
            const summary = summarizeText(summarySource, maxSentences);

            const citations = Array.from(
              new Set(
                snippets
                  .map((snippet) => snippet.source?.trim())
                  .filter((source): source is string => Boolean(source))
              )
            ).map((source) => ({ url: source }));

            if (summary && sections.length > 0) {
              context7Result = {
                source: "context7",
                title: library.name ?? sections[0].heading ?? "Documentation",
                summary,
                sections,
                citations,
                libraryId: library.id,
                libraryName: library.name ?? libraryName,
                query,
              };
            }
          }
        }
      } catch (error) {
        console.error("Context7 lookup failed:", error);
      }
    }

    if (context7Result) {
      yield {
        state: "ready" as const,
        docs: context7Result,
      };
      return;
    }

    if (!url) {
      throw new Error(
        "No library could be resolved for Context7 and no URL was provided."
      );
    }

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
        source: "url" as const,
        title,
        summary,
        sections: [
          {
            heading: "Excerpt",
            snippet: normalizeSnippet(excerpt, maxSectionChars),
            citationUrl: url,
          },
        ],
        citations: [{ title, url }],
        rawExcerpt: excerpt,
        url,
        query,
        fallback: {
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
      },
    };
  },
});

export type DocsUIToolInvocation = UIToolInvocation<typeof docsTool>;
