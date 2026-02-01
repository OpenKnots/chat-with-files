 "use client";
 
import { useCallback, useEffect, useRef, useState } from "react";
 import type React from "react";
 import { Streamdown } from "streamdown";
 import { code } from "@streamdown/code";
 import { mermaid } from "@streamdown/mermaid";
 
 type MarkdownMessageProps = {
   content: string;
   isAnimating: boolean;
 };
 
 type PreProps = React.ComponentPropsWithoutRef<"pre"> & {
   node?: unknown;
 };
 
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
 }: MarkdownMessageProps) {
   return (
     <Streamdown
       className="md whitespace-pre-wrap text-sm leading-relaxed"
       plugins={{ code, mermaid }}
       controls={{
         code: true,
         mermaid: {
           fullscreen: true,
           download: true,
           copy: true,
           panZoom: true,
         },
       }}
       mermaid={{ config: { theme: "dark" } }}
       components={{ pre: FullscreenPre }}
       isAnimating={isAnimating}
     >
       {content}
     </Streamdown>
   );
 }
