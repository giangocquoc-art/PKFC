// StoreOps State — typed agent state for the LangGraph-style workflow.
// =========================================================================
// This state object flows through each node in the workflow graph. Each node
// receives the current state, does its work, and returns an updated state.
// The state is durable: it can be persisted to the AgentRun table and
// recalled by runId for chat ("Ask this plan").

import type { KfcStore } from "@/lib/stores/seed-stores";
import type {
  WeatherSignal,
  WeatherProvenance,
  AgentStep,
  ActionPlan,
  ManagerBriefing,
  SlotPlan,
  RiskExplanation,
} from "@/lib/types";
import type { OpsBaseline } from "@/lib/operations/operationsDataAdapter";

/** A single trace item appended by each workflow node. */
export interface StoreOpsTraceItem {
  agentName: string;
  phase: "observe" | "reason" | "plan" | "act" | "verify" | "report" | "learn";
  input: string;
  output: string;
  confidence: number; // 0–1
  dataSource: "live" | "csv" | "synthetic" | "fallback" | "computed" | "llm";
  durationMs: number;
  status: "running" | "done" | "error";
  structuredOutput?: unknown;
}

/** Data source descriptor for the state's dataSources field. */
export interface StoreOpsDataSource {
  id: string;
  name: string;
  mode: "live" | "csv" | "synthetic" | "fallback" | "missing" | "computed";
  confidence: number;
}

/** The complete state of a StoreOps agent run. */
export interface StoreOpsState {
  // ── Identity ──
  runId: string;
  storeId: string;
  store: KfcStore;

  // ── Observe phase ──
  weatherSignal?: WeatherSignal;
  weatherProvenance?: WeatherProvenance;
  opsBaseline?: OpsBaseline;
  opsBaselineMode: "live" | "csv" | "simulated" | "none";

  // ── Reason phase ──
  demandShift?: SlotPlan[];

  // ── Plan phase ──
  prepPlan?: string;
  staffingPlan?: string;
  campaignPlan?: string;
  plan?: ActionPlan;

  // ── Verify phase ──
  riskReview?: RiskExplanation[];
  approvalRequired: boolean;
  approvalStatus: "pending" | "approved" | "rejected" | "not-required";

  // ── Report phase ──
  briefing?: ManagerBriefing;

  // ── Trace + metadata ──
  trace: StoreOpsTraceItem[];
  confidence: number;
  dataSources: StoreOpsDataSource[];
  errors: string[];

  // ── Learn phase ──
  learningStatus: "placeholder" | "learning" | "learned" | "active" | "no_data";
}

/** Create an initial StoreOpsState for a new run. */
export function createStoreOpsState(store: KfcStore): StoreOpsState {
  return {
    runId: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    storeId: store.id,
    store,
    opsBaselineMode: "none",
    approvalRequired: false,
    approvalStatus: "not-required",
    trace: [],
    confidence: 0,
    dataSources: [],
    errors: [],
    learningStatus: "placeholder",
  };
}

/** Helper: append a trace item to the state. */
export function appendTrace(
  state: StoreOpsState,
  item: Omit<StoreOpsTraceItem, "durationMs"> & { durationMs?: number },
): StoreOpsState {
  return {
    ...state,
    trace: [
      ...state.trace,
      {
        ...item,
        durationMs: item.durationMs ?? 0,
      },
    ],
  };
}
