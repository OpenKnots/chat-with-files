import mermaid from "mermaid";
import type { MermaidConfig } from "mermaid";
import type { DiagramPlugin } from "streamdown";

const baseConfig: MermaidConfig = {
  startOnLoad: false,
  theme: "dark",
  securityLevel: "strict",
  fontFamily: "monospace",
  suppressErrorRendering: true,
};

const needsQuotedLabel = (label: string) => /[():,]/.test(label);

const fixNodeLabels = (chart: string) =>
  chart.replace(/(\b[\w.-]+)\[([^\]\n]+)\]/g, (_, id: string, label: string) => {
    const trimmed = label.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return `${id}[${trimmed}]`;
    }
    if (!needsQuotedLabel(trimmed)) return `${id}[${trimmed}]`;
    const escaped = trimmed.replace(/"/g, '\\"');
    return `${id}["${escaped}"]`;
  });

const preprocessChart = (chart: string) => {
  const normalized = chart.trim();
  return fixNodeLabels(normalized);
};

const ensureSvgDimensions = (svg: string) => {
  const svgTagMatch = svg.match(/<svg\b[^>]*>/i);
  if (!svgTagMatch) return svg;
  const svgTag = svgTagMatch[0];
  const hasWidth = /\bwidth\s*=\s*["'][^"']+["']/i.test(svgTag);
  const hasHeight = /\bheight\s*=\s*["'][^"']+["']/i.test(svgTag);
  if (hasWidth && hasHeight) return svg;

  const viewBoxMatch = svgTag.match(
    /\bviewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i
  );
  if (!viewBoxMatch) return svg;
  const width = Number(viewBoxMatch[3]);
  const height = Number(viewBoxMatch[4]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return svg;

  const widthAttr = hasWidth ? "" : ` width="${width}"`;
  const heightAttr = hasHeight ? "" : ` height="${height}"`;
  const replacement = svgTag.replace(
    "<svg",
    `<svg${widthAttr}${heightAttr}`
  );
  return svg.replace(svgTag, replacement);
};

export function createMermaidPlugin(
  config?: MermaidConfig
): DiagramPlugin {
  let initialized = false;
  let currentConfig: MermaidConfig = { ...baseConfig, ...config };

  const ensureInit = (override?: MermaidConfig) => {
    if (override) currentConfig = { ...baseConfig, ...override };
    if (!initialized) {
      mermaid.initialize(currentConfig);
      initialized = true;
    }
  };

  return {
    name: "mermaid",
    type: "diagram",
    language: "mermaid",
    getMermaid(override?: MermaidConfig) {
      ensureInit(override);
      return {
        initialize(nextConfig) {
          currentConfig = { ...baseConfig, ...nextConfig };
          mermaid.initialize(currentConfig);
          initialized = true;
        },
        async render(id: string, source: string) {
          ensureInit();
          const result = await mermaid.render(id, preprocessChart(source));
          return { ...result, svg: ensureSvgDimensions(result.svg) };
        },
      };
    },
  };
}
