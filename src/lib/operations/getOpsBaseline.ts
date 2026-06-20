// Operations Baseline Resolver
// ============================
// Tries sponsor API → CSV → synthetic, in that order. Returns the first
// successful OpsBaseline along with a trace of which adapter was used.
// NEVER fabricates data — if all adapters fail, falls back to synthetic
// with a clear "synthetic" mode label.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { OpsBaseline } from "@/lib/operations/operationsDataAdapter";
import { sponsorOpsAdapter } from "@/lib/operations/sponsorOpsAdapter";
import { CsvOpsAdapter } from "@/lib/operations/csvOpsAdapter";
import { syntheticOpsAdapter } from "@/lib/operations/syntheticOpsAdapter";

const csvOpsAdapter = new CsvOpsAdapter();

export interface OpsBaselineResult {
  baseline: OpsBaseline;
  /** Which adapter succeeded: "sponsor" | "csv" | "synthetic" */
  source: "sponsor" | "csv" | "synthetic";
  /** Trace of attempts for the execution trace. */
  attempts: Array<{
    adapter: string;
    ok: boolean;
    error?: string;
    durationMs: number;
  }>;
}

/**
 * Resolve the operations baseline for a store.
 *
 * Tries: sponsor API (live) → CSV (historical) → synthetic (demo).
 * Returns the first success. If all fail, returns synthetic with clear labeling.
 */
export async function getOpsBaseline(store: KfcStore): Promise<OpsBaselineResult> {
  const attempts: OpsBaselineResult["attempts"] = [];

  // 1. Try sponsor API (live)
  const sponsorStart = Date.now();
  try {
    const baseline = await sponsorOpsAdapter.fetch(store);
    attempts.push({ adapter: "sponsor", ok: true, durationMs: Date.now() - sponsorStart });
    return { baseline, source: "sponsor", attempts };
  } catch (err) {
    attempts.push({
      adapter: "sponsor",
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
      durationMs: Date.now() - sponsorStart,
    });
  }

  // 2. Try CSV (historical)
  const csvStart = Date.now();
  try {
    const baseline = await csvOpsAdapter.fetch(store);
    if (baseline.mode === "csv" && baseline.baselineLunchOrders > 0) {
      attempts.push({ adapter: "csv", ok: true, durationMs: Date.now() - csvStart });
      return { baseline, source: "csv", attempts };
    }
    // CSV returned a fallback-shaped baseline (no row found) — try synthetic
    attempts.push({
      adapter: "csv",
      ok: false,
      error: "No CSV row for this store",
      durationMs: Date.now() - csvStart,
    });
  } catch (err) {
    attempts.push({
      adapter: "csv",
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
      durationMs: Date.now() - csvStart,
    });
  }

  // 3. Fallback to synthetic (demo)
  const synthStart = Date.now();
  const baseline = await syntheticOpsAdapter.fetch(store);
  attempts.push({ adapter: "synthetic", ok: true, durationMs: Date.now() - synthStart });
  return { baseline, source: "synthetic", attempts };
}

/**
 * Returns the current operations data mode based on env vars.
 * Used by the UI to show source badges without running the full pipeline.
 */
export function getOperationsMode(): "live" | "csv" | "demo" {
  if (process.env.SPONSOR_API_BASE_URL && process.env.SPONSOR_API_KEY) {
    return "live";
  }
  return "demo";
}
