import type { DocsUIToolInvocation } from "@/tool/docs-tool";

export default function DocsView({
  invocation,
}: {
  invocation: DocsUIToolInvocation;
}) {
  const inputUrl = "input" in invocation ? invocation.input?.url : undefined;
  const inputQuery = "input" in invocation ? invocation.input?.query : undefined;
  const inputLibrary =
    "input" in invocation
      ? invocation.input?.libraryName || invocation.input?.libraryId
      : undefined;

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 items-center rounded-full border border-zinc-900/60 bg-zinc-950/30 px-2 text-[11px] font-medium text-zinc-200">
          tool
        </span>
        <span className="text-xs font-medium text-zinc-100">docs</span>
        {"output" in invocation &&
        invocation.output?.docs?.source ? (
          <span className="text-[11px] uppercase tracking-wide text-zinc-400">
            {invocation.output.docs.source}
          </span>
        ) : null}
      </div>
      {inputUrl ? (
        <a
          className="text-[11px] text-zinc-400 hover:text-zinc-200"
          href={inputUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {inputUrl}
        </a>
      ) : null}
    </div>
  );

  switch (invocation.state) {
    // example of pre-rendering streaming tool calls:
    case "input-streaming":
      return (
        <div className="rounded-2xl bg-transparent px-2 py-1">
          {header}
          <details className="mt-2">
            <summary className="cursor-pointer select-none text-[11px] font-medium text-zinc-300">
              Tool input
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-transparent p-3 text-[11px] leading-relaxed text-zinc-200">
              {JSON.stringify(invocation.input, null, 2)}
            </pre>
          </details>
        </div>
      );
    case "input-available":
      return (
        <div className="rounded-2xl bg-transparent px-2 py-1 text-sm text-zinc-300">
          {header}
          <div className="mt-2 text-[13px]">
            Fetching docs for{" "}
            <span className="font-medium">
              {inputLibrary ?? inputUrl ?? "query"}
            </span>
            …
          </div>
        </div>
      );
    case "output-available":
      return (
        <div className="rounded-2xl bg-transparent px-2 py-1">
          {header}
          {invocation.output.state === "loading" ? (
            <div className="mt-2 text-[13px] text-zinc-300">
              Fetching docs content…
            </div>
          ) : (
            <div className="mt-2 space-y-4 text-[13px] text-zinc-200">
              {inputQuery ? (
                <div className="text-[11px] text-zinc-400">
                  Query: <span className="text-zinc-200">{inputQuery}</span>
                </div>
              ) : null}
              {invocation.output.docs.summary ? (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Summary
                  </div>
                  <p className="mt-1 leading-relaxed">
                    {invocation.output.docs.summary}
                  </p>
                </div>
              ) : null}
              {invocation.output.docs.sections?.length ? (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Sections
                  </div>
                  <div className="mt-2 space-y-3">
                    {invocation.output.docs.sections.map((section, index) => (
                      <div key={`${section.heading}-${index}`}>
                        <div className="text-[12px] font-medium text-zinc-100">
                          {section.heading}
                        </div>
                        <p className="mt-1 leading-relaxed text-zinc-300">
                          {section.snippet}
                        </p>
                        {section.citationUrl ? (
                          <a
                            className="mt-1 inline-block text-[11px] text-zinc-400 hover:text-zinc-200"
                            href={section.citationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {section.citationUrl}
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {invocation.output.docs.citations?.length ? (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Citations
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    {invocation.output.docs.citations.map((citation, index) => (
                      <a
                        key={`${citation.url}-${index}`}
                        className="text-[11px] text-zinc-400 hover:text-zinc-200"
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {citation.title ?? citation.url}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              {invocation.output.docs.source === "url" &&
              invocation.output.docs.rawExcerpt ? (
                <details>
                  <summary className="cursor-pointer select-none text-[11px] font-medium text-zinc-300">
                    Raw excerpt
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-transparent p-3 text-[11px] leading-relaxed text-zinc-200">
                    {invocation.output.docs.rawExcerpt}
                  </pre>
                </details>
              ) : null}
              {invocation.output.docs.source === "url" &&
              invocation.output.docs.fallback ? (
                <details>
                  <summary className="cursor-pointer select-none text-[11px] font-medium text-zinc-300">
                    Fallback details
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-transparent p-3 text-[11px] leading-relaxed text-zinc-200">
                    {JSON.stringify(invocation.output.docs.fallback, null, 2)}
                  </pre>
                </details>
              ) : null}
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
