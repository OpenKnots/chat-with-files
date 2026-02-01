 "use client";
 
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type React from "react";
import type { LlmProvider } from "@/lib/llm";
 import { Streamdown } from "streamdown";
 import { code } from "@streamdown/code";
import { createMermaidPlugin } from "@/lib/mermaid-plugin";
 
 type MarkdownMessageProps = {
   content: string;
   isAnimating: boolean;
  apiKey: string;
  provider: LlmProvider;
  model: string;
 };
 
 type PreProps = React.ComponentPropsWithoutRef<"pre"> & {
   node?: unknown;
 };
 
type MermaidFixContextValue = {
  fixMermaid: (original: string, fixed: string) => void;
  requestAiFix: (chart: string, error?: string) => Promise<string | null>;
  canAiFix: boolean;
};

type MermaidErrorProps = {
  error: string;
  chart: string;
  retry: () => void;
};

const MermaidFixContext = createContext<MermaidFixContextValue | null>(null);

const mermaidBlockRegex = /```mermaid\s*([\s\S]*?)```/g;

const normalizeMermaidChart = (chart: string) => chart.trim();

const applyMermaidFixes = (
  markdown: string,
  fixes: Record<string, string>
) => {
  if (Object.keys(fixes).length === 0) return markdown;
  return markdown.replace(mermaidBlockRegex, (match, chart: string) => {
    const normalized = normalizeMermaidChart(chart);
    const replacement = fixes[normalized];
    if (!replacement) return match;
    const fixed = normalizeMermaidChart(replacement);
    return `\`\`\`mermaid\n${fixed}\n\`\`\``;
  });
};

function MermaidError({ error, chart, retry }: MermaidErrorProps) {
  const fixContext = useContext(MermaidFixContext);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(chart);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    setDraft(chart);
  }, [chart]);

  const handleApplyFix = () => {
    if (!fixContext) return;
    fixContext.fixMermaid(chart, draft);
    retry();
    setIsEditing(false);
  };

  const handleAiFix = async () => {
    if (!fixContext?.canAiFix) return;
    setIsAiLoading(true);
    setAiStatus(null);
    try {
      const suggestion = await fixContext.requestAiFix(chart, error);
      if (!suggestion) {
        setAiStatus("AI could not generate a fix.");
        return;
      }
      setDraft(suggestion);
      fixContext.fixMermaid(chart, suggestion);
      retry();
      setIsEditing(false);
      setAiStatus("AI fix applied. Re-rendering diagram.");
    } catch (err) {
      setAiStatus(
        err instanceof Error ? err.message : "AI fix failed. Try again."
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRetry = () => {
    setAiStatus(null);
    if (fixContext && isEditing) {
      fixContext.fixMermaid(chart, draft);
    }
    retry();
  };

  return (
    <div className="rounded-2xl border border-amber-900/70 bg-amber-950/40 p-4 text-xs text-amber-200">
      <div className="font-semibold">Mermaid diagram failed to render.</div>
      <div className="mt-1 text-amber-200/80">{error}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          className="rounded-lg border border-amber-200/30 px-3 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-200/10"
        >
          {isEditing ? "Hide editor" : "Fix diagram"}
        </button>
        <button
          type="button"
          onClick={handleAiFix}
          disabled={!fixContext?.canAiFix || isAiLoading}
          className="rounded-lg border border-amber-200/30 px-3 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-200/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAiLoading ? "Fixing with AI…" : "Fix with AI"}
        </button>
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-lg border border-amber-200/30 px-3 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-200/10"
        >
          Retry render
        </button>
      </div>
      {aiStatus ? (
        <div className="mt-2 text-[11px] text-amber-100/80">{aiStatus}</div>
      ) : null}
      {isEditing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={8}
            className="w-full rounded-xl border border-amber-200/20 bg-black/40 p-3 font-mono text-[11px] text-amber-100"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApplyFix}
              className="rounded-lg bg-amber-200 px-3 py-1 text-[11px] font-semibold text-zinc-900 hover:bg-amber-100"
            >
              Apply fix
            </button>
            <button
              type="button"
              onClick={() => setDraft(chart)}
              className="rounded-lg border border-amber-200/30 px-3 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-200/10"
            >
              Reset
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

 function FullscreenPre({ children, className, node, ...rest }: PreProps) {
   const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper || typeof document === "undefined") return;
      setIsFullscreen(document.fullscreenElement === wrapper);
    };

    document.addEventListener("fullscreenchange", handleChange);
    handleChange();
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);
 
   const handleFullscreen = useCallback(() => {
     const wrapper = wrapperRef.current;
     if (!wrapper || typeof document === "undefined") return;
     if (document.fullscreenElement) {
       void document.exitFullscreen();
       return;
     }
     void wrapper.requestFullscreen();
   }, []);
 
   return (
     <div ref={wrapperRef} className="streamdown-code-block group relative">
       <button
         type="button"
         onClick={handleFullscreen}
         className="code-fullscreen-btn absolute left-2 top-2 z-10 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] font-medium text-white/80 opacity-100 backdrop-blur transition sm:opacity-0 sm:group-hover:opacity-100"
       >
         {isFullscreen ? "Exit full screen" : "Full screen"}
       </button>
       <pre className={className} {...rest}>
         {children}
       </pre>
     </div>
   );
 }
 
 export default function MarkdownMessage({
   content,
   isAnimating,
  apiKey,
  provider,
  model,
 }: MarkdownMessageProps) {
  const [mermaidFixes, setMermaidFixes] = useState<Record<string, string>>({});
  const fixMermaid = useCallback((original: string, fixed: string) => {
    const key = normalizeMermaidChart(original);
    const value = normalizeMermaidChart(fixed);
    if (!key || !value) return;
    setMermaidFixes((prev) => ({ ...prev, [key]: value }));
  }, []);
  const processedContent = useMemo(
    () => applyMermaidFixes(content, mermaidFixes),
    [content, mermaidFixes]
  );
  const canAiFix = apiKey.trim().length > 0 && !!model;
  const requestAiFix = useCallback(
    async (chart: string, error?: string) => {
      if (!canAiFix) return null;
      const response = await fetch("/api/mermaid-fix", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-llm-key": apiKey,
          "x-llm-provider": provider,
          "x-llm-model": model,
        },
        body: JSON.stringify({ chart, error }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "AI fix failed.");
      }
      const data = (await response.json()) as { fixedChart?: string };
      return data.fixedChart?.trim() || null;
    },
    [apiKey, canAiFix, model, provider]
  );

   return (
    <MermaidFixContext.Provider
      value={{ fixMermaid, requestAiFix, canAiFix }}
    >
      <Streamdown
        className="md whitespace-pre-wrap text-sm leading-relaxed"
        plugins={{ code, mermaid: createMermaidPlugin() }}
        controls={{
          code: true,
          mermaid: {
            fullscreen: true,
            download: true,
            copy: true,
            panZoom: true,
          },
        }}
        mermaid={{
          config: { theme: "dark" },
          errorComponent: MermaidError,
        }}
        components={{ pre: FullscreenPre }}
        isAnimating={isAnimating}
      >
        {processedContent}
      </Streamdown>
    </MermaidFixContext.Provider>
   );
 }
