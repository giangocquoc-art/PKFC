// Operations Data Adapters — synthetic implementations with live interfaces.
// Each adapter produces a stream of OperationEvent records for the Live
// Operations Monitor and Risk Intelligence Agent. In production these would
// connect to POS / inventory / workforce / delivery / complaint systems; here
// they generate deterministic synthetic events shaped by the Store Operating
// Profile and current weather risk.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { StoreOperatingProfile } from "@/lib/storeProfile/storeOperatingProfile";
import type { OperationEvent, OperationEventType, EventMode } from "@/lib/operations/realTimeEventSchema";
import { makeEvent } from "@/lib/operations/realTimeEventSchema";
import type { WeatherSignal } from "@/lib/types";

export interface OperationsDataAdapter {
  readonly id: string;
  readonly name: string;
  readonly eventType: OperationEventType;
  readonly mode: EventMode;
  /** Emit a batch of recent events for the store (last N minutes). */
  emit(store: KfcStore, profile: StoreOperatingProfile, weather: WeatherSignal, count: number): OperationEvent[];
}

// Deterministic pseudo-random in [0,1) seeded by store id + minute.
function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function hourOfDay(): number {
  return (new Date().getUTCHours() + 7) % 24;
}

// --- POS Data Adapter (walk-in + takeaway orders) ---
export class PosDataAdapter implements OperationsDataAdapter {
  readonly id = "pos-data";
  readonly name = "POS Data (walk-in + takeaway)";
  readonly eventType = "pos-order" as const;
  readonly mode = "synthetic" as const;

  emit(store: KfcStore, profile: StoreOperatingProfile, weather: WeatherSignal, count: number): OperationEvent[] {
    const events: OperationEvent[] = [];
    const h = hourOfDay();
    const isLunch = h >= 11 && h <= 13;
    const isDinner = h >= 18 && h <= 21;
    const walkInDrop = weather.walkInDropRisk;
    for (let i = 0; i < count; i++) {
      const seed = `${store.id}-pos-${i}-${Math.floor(Date.now() / 60000)}`;
      const r = seededRandom(seed);
      const baseOrders = isLunch ? 8 : isDinner ? 6 : 2;
      const walkInFactor = 1 - walkInDrop * 0.5;
      const ordersThisMin = Math.max(0, Math.round(baseOrders * walkInFactor * (0.6 + r * 0.8)));
      const channel = r < 0.6 ? "walk-in" : "takeaway";
      events.push(
        makeEvent(store, "pos-order", {
          channel,
          orders: ordersThisMin,
          avgItems: Math.round(2 + r * 3),
          avgTicketVnd: Math.round(45000 + r * 60000),
        }, { source: this.id, mode: this.mode, confidence: 0.7 }),
      );
    }
    return events;
  }
}

// --- Delivery Data Adapter ---
export class DeliveryDataAdapter implements OperationsDataAdapter {
  readonly id = "delivery-data";
  readonly name = "Delivery Data";
  readonly eventType = "delivery-order" as const;
  readonly mode = "synthetic" as const;

  emit(store: KfcStore, _profile: StoreOperatingProfile, weather: WeatherSignal, count: number): OperationEvent[] {
    const events: OperationEvent[] = [];
    const surge = weather.rainRiskScore;
    for (let i = 0; i < count; i++) {
      const seed = `${store.id}-del-${i}-${Math.floor(Date.now() / 60000)}`;
      const r = seededRandom(seed);
      const base = store.deliveryShare > 0.45 ? 5 : 3;
      const orders = Math.round(base * (1 + surge * 0.8) * (0.7 + r * 0.6));
      const dispatchDelayMin = Math.round(surge * (store.storeType === "suburban" ? 18 : 8) + r * 4);
      events.push(
        makeEvent(store, "delivery-order", {
          platform: r < 0.5 ? "ShopeeFood" : r < 0.8 ? "GrabFood" : "BeFood",
          orders,
          avgDispatchDelayMin: dispatchDelayMin,
          etaBreachRate: Math.min(0.6, surge * 0.5 + r * 0.1),
        }, { source: this.id, mode: this.mode, confidence: 0.7 }),
      );
    }
    return events;
  }
}

// --- Inventory Data Adapter ---
export class InventoryDataAdapter implements OperationsDataAdapter {
  readonly id = "inventory-data";
  readonly name = "Inventory Data";
  readonly eventType = "inventory-level" as const;
  readonly mode = "synthetic" as const;

  emit(store: KfcStore, _profile: StoreOperatingProfile, weather: WeatherSignal, count: number): OperationEvent[] {
    const events: OperationEvent[] = [];
    for (let i = 0; i < count; i++) {
      const seed = `${store.id}-inv-${i}-${Math.floor(Date.now() / 300000)}`;
      const r = seededRandom(seed);
      const chickenRawKg = Math.round(store.kitchenCapacity * (4 + r * 4));
      const buckets = Math.round(store.kitchenCapacity * (10 + r * 10));
      const cups = Math.round(store.dineInSeats * (2 + r * 3));
      const bags = Math.round(store.kitchenCapacity * (8 + r * 8));
      const stockoutRisk = weather.rainRiskScore > 0.5 && buckets < store.kitchenCapacity * 12 ? 0.6 : 0.15;
      events.push(
        makeEvent(store, "inventory-level", {
          chickenRawKg,
          buckets,
          cups,
          bags,
          stockoutRisk,
          lowStockSkus: stockoutRisk > 0.4 ? ["family-bucket", "combo-box"] : [],
        }, { source: this.id, mode: this.mode, confidence: 0.75 }),
      );
    }
    return events;
  }
}

// --- Staffing Data Adapter ---
export class StaffingDataAdapter implements OperationsDataAdapter {
  readonly id = "staffing-data";
  readonly name = "Staffing Data";
  readonly eventType = "staff-checkin" as const;
  readonly mode = "synthetic" as const;

  emit(store: KfcStore, _profile: StoreOperatingProfile, _weather: WeatherSignal, count: number): OperationEvent[] {
    const events: OperationEvent[] = [];
    for (let i = 0; i < count; i++) {
      const seed = `${store.id}-staff-${i}-${Math.floor(Date.now() / 3600000)}`;
      const r = seededRandom(seed);
      const present = Math.round(5 + r * 2);
      events.push(
        makeEvent(store, "staff-checkin", {
          staffPresent: present,
          scheduled: 6,
          roles: { kitchen: 2, counter: 2, runner: 1, lead: 1 },
          fitScore: Math.max(0.4, 1 - Math.abs(present - 6) * 0.15 - r * 0.1),
        }, { source: this.id, mode: this.mode, confidence: 0.8 }),
      );
    }
    return events;
  }
}

// --- Complaint Data Adapter ---
export class ComplaintDataAdapter implements OperationsDataAdapter {
  readonly id = "complaint-data";
  readonly name = "Customer Complaint Data";
  readonly eventType = "complaint" as const;
  readonly mode = "synthetic" as const;

  emit(store: KfcStore, _profile: StoreOperatingProfile, weather: WeatherSignal, count: number): OperationEvent[] {
    const events: OperationEvent[] = [];
    for (let i = 0; i < count; i++) {
      const seed = `${store.id}-comp-${i}-${Math.floor(Date.now() / 600000)}`;
      const r = seededRandom(seed);
      const complaintRisk = weather.rainRiskScore * 0.6 + weather.deliveryDisruptionRisk * 0.3;
      const hasComplaint = r < complaintRisk;
      events.push(
        makeEvent(store, "complaint", {
          count: hasComplaint ? 1 : 0,
          reasons: hasComplaint ? (r < 0.4 ? ["slow-delivery"] : r < 0.7 ? ["missing-item"] : ["cold-food"]) : [],
          channel: r < 0.5 ? "delivery" : "dine-in",
        }, { source: this.id, mode: this.mode, confidence: 0.6 }),
      );
    }
    return events;
  }
}

// --- Real-time Event Adapter (aggregates all sources for a time window) ---
export class RealTimeEventAdapter {
  readonly id = "realtime-event";
  readonly name = "Real-time Event Aggregator";
  readonly mode = "synthetic" as const;

  private sourceAdapters: OperationsDataAdapter[] = [
    new PosDataAdapter(),
    new DeliveryDataAdapter(),
    new InventoryDataAdapter(),
    new StaffingDataAdapter(),
    new ComplaintDataAdapter(),
  ];

  /** Emit a mixed batch of recent events across all sources. */
  emitAll(
    store: KfcStore,
    profile: StoreOperatingProfile,
    weather: WeatherSignal,
    perSource: number = 3,
  ): OperationEvent[] {
    const all: OperationEvent[] = [];
    for (const src of this.sourceAdapters) {
      all.push(...src.emit(store, profile, weather, perSource));
    }
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  get sources() {
    return this.sourceAdapters;
  }
}

export const realTimeEventAdapter = new RealTimeEventAdapter();
export const posDataAdapter = new PosDataAdapter();
export const inventoryDataAdapter = new InventoryDataAdapter();
export const staffingDataAdapter = new StaffingDataAdapter();
export const deliveryDataAdapter = new DeliveryDataAdapter();
export const complaintDataAdapter = new ComplaintDataAdapter();
