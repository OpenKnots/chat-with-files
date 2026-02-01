type UrlKind = "github" | "docs" | "unknown";

type UrlContext = {
  kind: UrlKind;
  host?: string;
  owner?: string;
  repo?: string;
  section?: string;
  page?: string;
  path?: string;
};

const STOPWORDS = new Set([
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "also",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "here",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "me",
  "more",
  "most",
  "my",
  "no",
  "nor",
  "not",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "out",
  "over",
  "own",
  "same",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "you",
  "your",
]);

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (/^git@github\.com:/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractKeywords(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const tokens = cleaned
    .split(" ")
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 4 && !STOPWORDS.has(token) && !/^\d+$/.test(token)
    );

  const unique: string[] = [];
  for (const token of tokens) {
    if (!unique.includes(token)) unique.push(token);
    if (unique.length >= 3) break;
  }
  return unique;
}

function parseGithubUrl(rawUrl: string): UrlContext | null {
  const trimmed = rawUrl.trim();
  const sshMatch = trimmed.match(
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?(?:\/(.*))?$/i
  );
  if (sshMatch?.[1] && sshMatch?.[2]) {
    return {
      kind: "github",
      owner: sshMatch[1],
      repo: sshMatch[2].replace(/\.git$/i, ""),
    };
  }

  try {
    const parsed = new URL(normalizeUrl(trimmed));
    if (!parsed.hostname.endsWith("github.com")) return null;

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return { kind: "github" };
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    const rest = parts.slice(2);
    let path: string | undefined;

    if (rest[0] === "tree" || rest[0] === "blob") {
      path = rest.slice(2).join("/") || undefined;
    } else if (rest.length > 0) {
      path = rest.join("/") || undefined;
    }

    return {
      kind: "github",
      owner,
      repo,
      path,
    };
  } catch {
    return { kind: "github" };
  }
}

function parseDocsUrl(rawUrl: string): UrlContext {
  try {
    const parsed = new URL(normalizeUrl(rawUrl));
    const segments = parsed.pathname
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .filter(Boolean);
    const rawSection = segments[0];
    const section =
      rawSection === "docs" && segments.length > 1 ? segments[1] : rawSection;
    const page = segments.length > 0 ? segments[segments.length - 1] : undefined;
    return {
      kind: "docs",
      host: parsed.hostname,
      section: section || undefined,
      page: page || undefined,
      path: segments.join("/") || undefined,
    };
  } catch {
    return { kind: "docs" };
  }
}

function buildDocsSuggestions(context: UrlContext, keywords: string[]): string[] {
  const suggestions: string[] = [];
  const section = context.section?.replace(/[-_]/g, " ");
  const page = context.page?.replace(/[-_]/g, " ");
  const keyword = keywords[0];

  if (section) {
    suggestions.push(`Summarize the ${section} section`);
  } else {
    suggestions.push("Summarize this page");
  }

  if (page && page !== section) {
    suggestions.push(`What does the ${page} cover?`);
  }

  if (keyword) {
    suggestions.push(`Explain how ${keyword} works`);
    suggestions.push(`Show a quick example for ${keyword}`);
  } else {
    suggestions.push("What are the key concepts?");
  }

  return suggestions;
}

function buildGithubSuggestions(
  context: UrlContext,
  keywords: string[]
): string[] {
  const suggestions: string[] = [];
  const repoLabel =
    context.owner && context.repo
      ? `${context.owner}/${context.repo}`
      : "this repository";
  const keyword = keywords[0];

  suggestions.push(`Summarize the ${repoLabel}`);
  suggestions.push("List key folders and what they do");

  if (context.path) {
    suggestions.push(`Explain the purpose of ${context.path}`);
  }

  if (keyword) {
    suggestions.push(`Where is ${keyword} implemented in this repo?`);
  }

  return suggestions;
}

function dedupeSuggestions(items: string[], max = 4): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    deduped.push(trimmed);
    if (deduped.length >= max) break;
  }
  return deduped;
}

export function buildSuggestions({
  chatUrl,
  lastUserText,
}: {
  chatUrl: string;
  lastUserText?: string;
}): string[] {
  if (!chatUrl) return [];
  const normalized = normalizeUrl(chatUrl);
  const isGithub = /github\.com/i.test(normalized) || /^git@github\.com:/i.test(normalized);
  const context = isGithub ? parseGithubUrl(normalized) : parseDocsUrl(normalized);
  const keywords = lastUserText ? extractKeywords(lastUserText) : [];

  if (context?.kind === "github") {
    return dedupeSuggestions(buildGithubSuggestions(context, keywords));
  }

  return dedupeSuggestions(buildDocsSuggestions(context ?? { kind: "docs" }, keywords));
}
