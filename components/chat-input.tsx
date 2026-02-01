import { useCallback, useEffect, useRef, useState } from "react";

export default function ChatInput({
  status,
  onSubmit,
  stop,
  suggestions,
  inputDisabled,
  placeholder,
}: {
  status: string;
  onSubmit: (text: string) => void;
  stop?: () => void;
  suggestions?: string[];
  inputDisabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const disabled = inputDisabled || status !== "ready";
  const canStop = !!stop && (status === "streaming" || status === "submitted");

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  const submit = () => {
    const value = text.trim();
    if (value === "" || disabled) return;
    onSubmit(value);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="w-full"
    >
      <div className="mx-auto min-h-fit w-full rounded-3xl border border-zinc-900/60 p-2 shadow-sm md:w-full lg:w-full">
        {suggestions?.length ? (
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto px-2 pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                className="shrink-0 rounded-full border border-zinc-900/60 bg-zinc-950/30 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  if (disabled) return;
                  onSubmit(s);
                  setText("");
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }}
                title={s}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          rows={1}
          className="w-full resize-none bg-transparent border border-zinc-900/60 bg-zinc-950/30 px-3 py-2 text-sm leading-relaxed text-zinc-100 rounded-xl shadow-sm outline-none placeholder:text-zinc-500 disabled:opacity-60"
          placeholder={
            placeholder ??
            "Ask Chat Assistant anything about your docs or GitHub repository…"
          }
          disabled={disabled}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={autoResize}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />

        <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-2">
          <div className="text-[11px] text-zinc-500">
            <span className="hidden sm:inline">
              Enter to send · Shift+Enter for newline
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canStop && (
              <button
                type="button"
                className="rounded-full border border-zinc-900/60 bg-zinc-950/30 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900/40"
                onClick={stop}
              >
                Stop
              </button>
            )}
            <button
              type="submit"
              disabled={disabled || text.trim() === ""}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-950 shadow-sm hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-400 disabled:opacity-100"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
