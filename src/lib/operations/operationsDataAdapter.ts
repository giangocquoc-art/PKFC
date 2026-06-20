// Operations Data Adapter — pluggable interface for POS / inventory / staffing.
// =========================================================================
// In production this would connect to KFC's POS, inventory and workforce
// management systems. In the current pilot-ready build it has two
// implementations:
//   - SyntheticOpsAdapter: deterministic synthetic POS/inventory/staffing
//     used in demo/dev mode (clearly labeled mode='simulated').
//   - CsvOpsAdapter: reads from a CSV file following the sample schema in
//     public/sample-operations-data.csv — the seam for plugging in real KFC
//     data exports.
//
// Both implement the same OperationsDataAdapter interface so the Demand,
// Inventory & Prep and Staffing agents can consume real or synthetic data
// without code changes.

import type { KfcStore } from "@/lib/stores/seed-stores";

export interface OpsBaseline {
  storeId: string;
  mode: "simulated" | "csv" | "live";
  source: string;
  fetchedAt: string;
  /** Average lunch baseline covers (orders). */
  baselineLunchOrders: number;
  /** Average dinner baseline covers (orders). */
  baselineDinnerOrders: number;
  /** Baseline delivery share (0-1). */
  baselineDeliveryShare: number;
  /** On-hand inventory units (chicken raw, buckets, cups). */
  inventory: { chickenRawKg: number; buckets: number; cups: number; bags: number };
  /** Scheduled staff count per slot. */
  staffing: { lunch: number; dinner: number };
  reliabilityNote: string;
}

export interface OperationsDataAdapter {
  readonly id: string;
  readonly name: string;
  readonly mode: "simulated" | "csv" | "live";
  /** Fetch the operations baseline for a store. Never throws. */
  fetch(store: KfcStore): Promise<OpsBaseline>;
}

export { SyntheticOpsAdapter } from "@/lib/operations/syntheticOpsAdapter";
export { CsvOpsAdapter, parseOpsCsv } from "@/lib/operations/csvOpsAdapter";
export { syntheticOpsAdapter } from "@/lib/operations/syntheticOpsAdapter";
