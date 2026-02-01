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
          return mermaid.render(id, preprocessChart(source));
        },
      };
    },
  };
}
