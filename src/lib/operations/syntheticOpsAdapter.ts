// Synthetic Operations Adapter
// ============================
// Deterministic synthetic POS/inventory/staffing baseline derived from the
// store profile (kitchen capacity, delivery share, seats). Used in demo/dev
// mode. mode='simulated' is surfaced honestly in the UI.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { OperationsDataAdapter, OpsBaseline } from "@/lib/operations/operationsDataAdapter";

export class SyntheticOpsAdapter implements OperationsDataAdapter {
  readonly id = "synthetic-ops";
  readonly name = "Synthetic Operations Data (POS / Inventory / Staffing)";
  readonly mode = "simulated" as const;

  async fetch(store: KfcStore): Promise<OpsBaseline> {
    const baselineLunchOrders = Math.round(store.dineInSeats * 1.8 + store.kitchenCapacity * 12);
    const baselineDinnerOrders = Math.round(store.dineInSeats * 2.1 + store.kitchenCapacity * 14);
    return {
      storeId: store.id,
      mode: "simulated",
      source: "synthetic-ops",
      fetchedAt: new Date().toISOString(),
      baselineLunchOrders,
      baselineDinnerOrders,
      baselineDeliveryShare: store.deliveryShare,
      inventory: {
        chickenRawKg: Math.round(store.kitchenCapacity * 6),
        buckets: Math.round(store.kitchenCapacity * 18),
        cups: Math.round(store.dineInSeats * 4),
        bags: Math.round(store.kitchenCapacity * 14),
      },
      staffing: { lunch: 6, dinner: 6 },
      reliabilityNote:
        "Synthetic baseline derived from store profile (seats, kitchen capacity, delivery share). NOT real KFC POS data. Replaceable by CsvOpsAdapter or a live POS connector.",
    };
  }
}

export const syntheticOpsAdapter = new SyntheticOpsAdapter();
