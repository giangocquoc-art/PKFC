// Operations Tool — calls SponsorOpsAdapter → CsvOpsAdapter → SyntheticOpsAdapter.
// =========================================================================
// Fallback chain:
//   1. Sponsor API (live) — if SPONSOR_API_BASE_URL + SPONSOR_API_KEY set
//   2. CSV file — if public/sample-operations-data.csv has a row for this store
//   3. Synthetic — deterministic profile-derived baseline (mode="simulated")
//
// CRITICAL: Never presents synthetic data as real. sourceMode is always honest.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { OpsBaseline } from "@/lib/operations/operationsDataAdapter";
import { getOpsBaseline } from "@/lib/operations/getOpsBaseline";
import type { ToolResult } from "./types";

export type OperationsToolResult = ToolResult<{
  baseline: OpsBaseline;
  source: "sponsor" | "csv" | "synthetic";
  attempts: Array<{ adapter: string; ok: boolean; error?: string; durationMs: number }>;
}>;

export async function operationsTool(store: KfcStore): Promise<OperationsToolResult> {
  const start = Date.now();
  try {
    const { baseline, source, attempts } = await getOpsBaseline(store);

    const sourceMode: "live" | "csv" | "synthetic" =
      source === "sponsor" ? "live" : source === "csv" ? "csv" : "synthetic";

    const confidenceImpact =
      source === "sponsor" ? 0.5 : source === "csv" ? 0.2 : 0.05;

    return {
      ok: true,
      sourceMode,
      data: { baseline, source, attempts },
      confidenceImpact,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      sourceMode: "synthetic",
      error: err instanceof Error ? err.message : "Operations baseline fetch failed",
      confidenceImpact: -0.2,
      durationMs: Date.now() - start,
    };
  }
}
