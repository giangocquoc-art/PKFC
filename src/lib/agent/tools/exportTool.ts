// Export Tool — creates manager briefing export.
import type { AgentRunResult } from "@/lib/types";
import type { ToolResult } from "./types";

export type ExportToolResult = ToolResult<{ markdown: string }>

export function exportTool(result: AgentRunResult): ExportToolResult {
  const start = Date.now();
  try {
    const { briefing, plan, weather, trace } = result;
    const lines: string[] = [];
    lines.push(`# Manager Briefing — ${briefing.storeName}`);
    lines.push("");
    lines.push(`**Generated:** ${new Date(briefing.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" })} (ICT)`);
    lines.push(`**Planning date:** ${plan.planningDate}`);
    lines.push(`**Data source:** ${weather.isLive ? "LIVE (Open-Meteo)" : "FALLBACK"} — ${weather.source}`);
    lines.push(`**Confidence:** ${(plan.confidence * 100).toFixed(0)}% (${briefing.confidenceLabel})`);
    lines.push("");
    lines.push("## Headline");
    lines.push(briefing.headline);
    lines.push("");
    lines.push("## TL;DR");
    briefing.tldr.forEach((t) => lines.push(`- ${t}`));
    lines.push("");
    lines.push("## Top Actions");
    briefing.topActions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
    lines.push("");
    lines.push("## Watch Items");
    briefing.watchItems.forEach((w) => lines.push(`- ${w}`));

    return {
      ok: true,
      sourceMode: "computed",
      data: { markdown: lines.join("\n") },
      confidenceImpact: 0,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      sourceMode: "fallback",
      error: err instanceof Error ? err.message : "Export failed",
      confidenceImpact: 0,
      durationMs: Date.now() - start,
    };
  }
}
