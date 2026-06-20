// Centralized StoreOps Agent runner.
// =========================================================================
// Uses the LangGraph-style workflow: 12 nodes in order.
// All API routes use this helper — no route calls runAgentPipeline directly.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { AgentRunResult, AgentStep } from "@/lib/types";
import { createStoreOpsState, type StoreOpsState } from "./storeOpsState";
import { runStoreOpsWorkflow } from "./storeOpsWorkflow";
import { db } from "@/lib/db";

export interface StoreOpsRunResult extends AgentRunResult {
  runId: string;
  opsBaselineSource: "sponsor" | "csv" | "synthetic";
  opsBaselineMode: "live" | "csv" | "simulated" | "none";
  opsBaselineAttempts: Array<{
    adapter: string;
    ok: boolean;
    error?: string;
    durationMs: number;
  }>;
  state: StoreOpsState;
}

/**
 * Run the full StoreOps Agent workflow for a store.
 * Uses the node-based workflow: observe → reason → plan → verify → act → learn.
 */
export async function runStoreOpsAgent(store: KfcStore): Promise<StoreOpsRunResult> {
  const runStart = Date.now();

  // Create initial state
  const initialState = createStoreOpsState(store);

  // Run the workflow
  const finalState = await runStoreOpsWorkflow(initialState);

  // Convert workflow state back to AgentRunResult format (for backward compat
  // with existing UI components that expect trace, plan, briefing, etc.)
  const result: AgentRunResult = {
    storeId: store.id,
    storeName: store.name,
    trace: stateTraceToAgentSteps(finalState.trace),
    plan: finalState.plan!,
    briefing: finalState.briefing!,
    beforeAfter: [], // computed by engine internally
    weather: finalState.weatherSignal!,
    weatherProvenance: finalState.weatherProvenance ?? {
      primarySource: finalState.weatherSignal?.source ?? "unknown",
      primaryMode: finalState.weatherSignal?.isLive ? "live" : "fallback",
      contributors: [],
    },
    isLive: finalState.weatherSignal?.isLive ?? false,
    generatedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - runStart,
  };

  // Persist run (best-effort) — capture the Prisma-generated id as runId
  let dbRunId: string | undefined;
  try {
    const created = await db.agentRun.create({
      data: {
        storeId: store.id,
        storeName: store.name,
        traceJson: JSON.stringify(result.trace),
        planJson: JSON.stringify({
          ...result.plan,
          opsBaselineMode: finalState.opsBaselineMode,
          dataSources: finalState.dataSources,
        }),
        briefingJson: JSON.stringify(result.briefing),
        confidence: result.plan.confidence,
        isLive: result.isLive,
      },
    });
    dbRunId = created.id;
  } catch {
    // ignore DB errors
  }

  // Use the Prisma id as runId if available, otherwise fall back to the workflow runId
  const effectiveRunId = dbRunId ?? finalState.runId;

  // Extract ops baseline info from state
  const opsMode = finalState.opsBaselineMode;
  const opsSource: "sponsor" | "csv" | "synthetic" =
    opsMode === "live" ? "sponsor" : opsMode === "csv" ? "csv" : "synthetic";

  // Find ops baseline attempts from trace
  const opsTrace = finalState.trace.find((t) => t.agentName === "Operations Baseline Agent");
  const opsAttempts: Array<{ adapter: string; ok: boolean; error?: string; durationMs: number }> = [];
  // The attempts are in the structuredOutput of the engine's trace — extract from there
  // For now, we construct a summary from the ops trace output
  if (opsTrace) {
    const output = opsTrace.output;
    if (output.includes("sponsor(ok)")) opsAttempts.push({ adapter: "sponsor", ok: true, durationMs: 0 });
    else if (output.includes("sponsor(fail)")) opsAttempts.push({ adapter: "sponsor", ok: false, error: "not configured", durationMs: 0 });
    if (output.includes("csv(ok)")) opsAttempts.push({ adapter: "csv", ok: true, durationMs: 0 });
    else if (output.includes("csv(fail)")) opsAttempts.push({ adapter: "csv", ok: false, error: "no row", durationMs: 0 });
    if (output.includes("synthetic") || opsAttempts.length === 0) opsAttempts.push({ adapter: "synthetic", ok: true, durationMs: 0 });
  }

  return {
    ...result,
    runId: effectiveRunId,
    opsBaselineSource: opsSource,
    opsBaselineMode: opsMode,
    opsBaselineAttempts: opsAttempts,
    state: finalState,
  };
}

/** Convert workflow trace items to AgentStep format for backward compat. */
function stateTraceToAgentSteps(
  trace: StoreOpsState["trace"],
): AgentStep[] {
  let stepNum = 1;
  return trace.map((item) => ({
    step: stepNum++,
    agentName: item.agentName,
    agentRole: item.agentName,
    phase: item.phase as AgentStep["phase"],
    input: item.input,
    output: item.output,
    confidence: item.confidence,
    timestamp: new Date().toISOString(),
    dataSource: item.dataSource as AgentStep["dataSource"],
    durationMs: item.durationMs,
    status: item.status,
    structuredOutput: item.structuredOutput as Record<string, unknown> | undefined,
  }));
}
