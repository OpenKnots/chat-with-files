
import { Octokit } from "@octokit/rest";
import { UIToolInvocation, tool } from "ai";
import { z } from "zod";

// Create Octokit instance with GitHub token if available
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN ?? undefined,
});

/**
 * Type definition for GitHub repository data
 */
export type GitHubRepoData = {
    name: string;
    full_name: string;
    description: string | null;
    stars: number;
    forks: number;
    language: string | null;
    created_at: string;
    updated_at: string;
    homepage: string | null;
    default_branch: string;
};

/**
 * Fetches repository data from GitHub API
 * @param owner Repository owner (username or organization)
 * @param repo Repository name
 * @returns Repository data or null if not found
 */
export async function getRepoData(owner: string, repo: string): Promise<GitHubRepoData | null> {
    try {
        if (!owner || !repo) {
            console.error('Invalid owner or repo name');
            return null;
        }

        const response = await octokit.repos.get({
            owner,
            repo,
        });

        if (response.status !== 200) {
            console.error(`Error fetching repo data: ${String(response.status)}`);
            return null;
        }

        const data = response.data;

        return {
            name: data.name,
            full_name: data.full_name,
            description: data.description,
            stars: data.stargazers_count,
            forks: data.forks_count,
            language: data.language,
            created_at: data.created_at,
            updated_at: data.updated_at,
            homepage: data.homepage,
            default_branch: data.default_branch,
        };
    } catch (error) {
        console.error(`Error fetching repo data for ${owner}/${repo}:`, error);
        return null;
    }
}

/**
 * Extracts owner and repo name from a GitHub URL
 * @param url GitHub repository URL
 * @returns Object containing owner and repo, or null if invalid URL
 */
export function extractRepoInfo(url: string): {
    owner: string;
    repo: string;
    ref?: string;
    path?: string;
    repoUrl?: string;
} | null {
    try {
        if (!url || typeof url !== 'string') {
            return null;
        }

        // Decode URL to handle URL-encoded characters like %0A (newline)
        const decodedUrl = decodeURIComponent(url.trim());

        // Handle SSH-style Git URLs (git@github.com:owner/repo.git)
        const sshMatch = decodedUrl.match(
            /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?(?:\/(.*))?$/
        );
        if (sshMatch?.[1] && sshMatch?.[2]) {
            const owner = sshMatch[1];
            const repo = sshMatch[2].replace(/\.git$/, '');
            return {
                owner,
                repo,
                repoUrl: `https://github.com/${owner}/${repo}`,
            };
        }

        // Handle simple "owner/repo" inputs
        const ownerRepoMatch = decodedUrl.match(/^([^/]+)\/([^/]+)$/);
        if (ownerRepoMatch?.[1] && ownerRepoMatch?.[2]) {
            const owner = ownerRepoMatch[1];
            const repo = ownerRepoMatch[2].replace(/\.git$/, '');
            const blockedOwners = new Set(['repos', 'rest', 'api', 'docs']);
            if (blockedOwners.has(owner.toLowerCase())) {
                return null;
            }
            return {
                owner,
                repo,
                repoUrl: `https://github.com/${owner}/${repo}`,
            };
        }

        const normalized = decodedUrl
            .replace(/^git\+/, '')
            .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
            .replace(/^www\./, 'https://www.');

        const parsed = new URL(
            normalized.startsWith('http') ? normalized : `https://${normalized}`
        );

        if (!parsed.hostname.endsWith('github.com')) {
            return null;
        }
        if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
            return null;
        }

        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length < 2) {
            return null;
        }

        const owner = parts[0];
        const repo = parts[1].replace(/\.git$/, '');
        const rest = parts.slice(2);
        let ref: string | undefined;
        let path: string | undefined;

        if (rest[0] === 'tree' || rest[0] === 'blob') {
            ref = rest[1];
            path = rest.slice(2).join('/') || undefined;
        } else if (rest[0] === 'commit') {
            ref = rest[1];
        } else if (rest.length > 0) {
            path = rest.join('/');
        }

        return {
            owner,
            repo,
            ref,
            path,
            repoUrl: `https://github.com/${owner}/${repo}`,
        };
    } catch (error) {
        console.error('Error extracting repo info:', error);
        return null;
    }
}

export const githubTool = tool({
    description: "Get repository data from GitHub",
    inputSchema: z.object({
        url: z.string().url().describe("GitHub repository URL"),
    }),
    execute: async ({ url }) => {
        const { owner, repo } =
            extractRepoInfo(url) ?? ({ owner: "", repo: "" } as {
                owner: string;
                repo: string;
            });
        const repoData = await getRepoData(owner, repo);
        return {
            state: "ready" as const,
            github: repoData,
        };
    },
});

export type GitHubUIToolInvocation = UIToolInvocation<typeof githubTool>;
