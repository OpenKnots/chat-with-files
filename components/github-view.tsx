import type { GitHubUIToolInvocation } from "@/tool/github-tool";

export default function GithubView({
  invocation,
}: {
  invocation: GitHubUIToolInvocation;
}) {
  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 items-center rounded-full border border-zinc-900/60 bg-zinc-950/30 px-2 text-[11px] font-medium text-zinc-200">
          tool
        </span>
        <span className="text-xs font-medium text-zinc-100">github</span>
      </div>
      {"input" in invocation && invocation.input?.url ? (
        <a
          className="text-[11px] text-zinc-400 hover:text-zinc-200"
          href={invocation.input.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {invocation.input.url}
        </a>
      ) : null}
    </div>
  );

  switch (invocation.state) {
    // example of pre-rendering streaming tool calls:
    case "input-streaming":
      return (
        <div className="rounded-2xl border border-zinc-900/60 bg-zinc-950/20 p-3">
          {header}
          <details className="mt-2">
            <summary className="cursor-pointer select-none text-[11px] font-medium text-zinc-300">
              Tool input
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-zinc-900/60 bg-black/30 p-3 text-[11px] leading-relaxed text-zinc-200">
              {JSON.stringify(invocation.input, null, 2)}
            </pre>
          </details>
        </div>
      );
    case "input-available":
      return (
        <div className="rounded-2xl border border-zinc-900/60 bg-zinc-950/20 p-3 text-sm text-zinc-300">
          {header}
          <div className="mt-2 text-[13px]">
            Getting GitHub information for{" "}
            <span className="font-medium">{invocation.input.url}</span>…
          </div>
        </div>
      );
    case "output-available":
      return (
        <div className="rounded-2xl border border-zinc-900/60 bg-zinc-950/20 p-3">
          {header}
          {invocation.output.github ? (
            <details className="mt-2">
              <summary className="cursor-pointer select-none text-[11px] font-medium text-zinc-300">
                Tool output
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-zinc-900/60 bg-black/30 p-3 text-[11px] leading-relaxed text-zinc-200">
                {JSON.stringify(invocation.output.github, null, 2)}
              </pre>
            </details>
          ) : (
            <div className="mt-2 text-[13px] text-zinc-300">
              No repository data was returned.
            </div>
          )}
        </div>
      );
    case "output-error":
      return (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
          {header}
          <div className="mt-2">Error: {invocation.errorText}</div>
        </div>
      );
  }
}
