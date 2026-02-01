import { Octokit } from "@octokit/rest";

type TrendingRepo = {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateLimitStore = new Map<string, RateLimitEntry>();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN ?? undefined,
});

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function nowUtcDateString() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rateLimit(ip: string) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || entry.resetAt <= now) {
    const nextEntry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(ip, nextEntry);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function toTrendingRepo(item: {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
}): TrendingRepo {
  return {
    id: item.id,
    full_name: item.full_name,
    html_url: item.html_url,
    description: item.description,
    language: item.language,
    stargazers_count: item.stargazers_count,
    forks_count: item.forks_count,
  };
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limiter = rateLimit(ip);
  if (!limiter.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Please try again later.",
        retryAfterSeconds: limiter.retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(limiter.retryAfterSeconds),
        },
      }
    );
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const date = dateParam?.trim() || nowUtcDateString();
  const perPage = Number(url.searchParams.get("per_page") ?? "10");
  const perPageClamped = Number.isFinite(perPage)
    ? Math.min(Math.max(perPage, 1), 25)
    : 10;

  try {
    const query = `created:>=${date}`;
    const response = await octokit.search.repos({
      q: query,
      sort: "stars",
      order: "desc",
      per_page: perPageClamped,
    });

    const remaining = Number(response.headers["x-ratelimit-remaining"] ?? "1");
    if (Number.isFinite(remaining) && remaining <= 0) {
      const reset = Number(response.headers["x-ratelimit-reset"] ?? "0");
      const retryAfterSeconds = reset
        ? Math.max(1, reset - Math.floor(Date.now() / 1000))
        : 60;
      return new Response(
        JSON.stringify({
          error: "GitHub rate limit exceeded.",
          retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSeconds),
          },
        }
      );
    }

    const repos = response.data.items.map(toTrendingRepo);
    return new Response(
      JSON.stringify({
        date,
        query,
        count: repos.length,
        repos,
        note:
          "Trending today uses GitHub search: repos created today, sorted by stars.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to load trending repositories.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
