// Agent Tools — explicit tool/API wrappers.
// =========================================================================
// Each tool wraps an external call (weather API, operations baseline, export,
// approval, learning) and returns a structured result with:
//   ok, sourceMode, data, error, confidenceImpact
//
// This makes tool usage explicit and auditable — a key LangGraph pattern.

export interface ToolResult<T = unknown> {
  ok: boolean;
  sourceMode: "live" | "csv" | "synthetic" | "fallback" | "missing" | "computed";
  data?: T;
  error?: string;
  confidenceImpact: number; // -1 to +1, how this tool's result affects overall confidence
  durationMs: number;
}
