// Real-time Operations Event Schema
// =================================
// Canonical event schema for all real-time operations data (POS, inventory,
// staffing, delivery, complaints). Every event carries provenance (source,
// mode, confidence, timestamp) so the Risk Intelligence Agent and Live
// Operations Monitor can surface data freshness and live/synthetic/fallback
// status honestly.
//
// In production these events would flow from KFC POS / inventory / workforce
// systems (optionally via Kafka). In this pilot-ready build they are produced
// by synthetic adapters with mode='synthetic' — the schema is real, the data
// is simulated, and the adapters are swappable for live connectors.

import type { KfcStore } from "@/lib/stores/seed-stores";

export type OperationEventType =
  | "pos-order" // a POS order (walk-in / takeaway)
  | "delivery-order" // a delivery order
  | "inventory-level" // inventory snapshot
  | "batch-prep" // a kitchen batch prep event
  | "waste-event" // waste logged
  | "stockout-event" // stockout logged
  | "staff-checkin" // staff check-in
  | "staff-checkout" // staff check-out
  | "service-time" // service time sample
  | "complaint" // customer complaint
  | "refund" // refund / cancel
  | "campaign-event"; // campaign performance sample

export type EventMode = "live" | "synthetic" | "fallback";

export interface OperationEvent {
  eventId: string;
  storeId: string;
  type: OperationEventType;
  timestamp: string; // ISO
  source: string; // adapter id
  mode: EventMode;
  confidence: number; // 0-1
  payload: Record<string, unknown>;
}

/** Computed real-time metrics derived from the event stream. */
export interface RealTimeMetrics {
  storeId: string;
  computedAt: string;
  walkInTrend: number; // signed % vs baseline (last hour)
  deliverySurge: number; // signed % vs baseline (last hour)
  prepUtilization: number; // 0-1
  wasteTrend: number; // signed % vs baseline
  stockoutProbability: number; // 0-1 next 2h
  staffingFit: number; // 0-1
  serviceDelayRisk: number; // 0-1
  marginRisk: number; // 0-1
  complaintRisk: number; // 0-1
  campaignEffectiveness: number; // 0-1
  mode: EventMode;
  eventCount: number;
  windowStart: string;
  windowEnd: string;
}

/** Anomaly alert emitted by the Risk Intelligence Agent. */
export interface AnomalyAlert {
  id: string;
  storeId: string;
  severity: "info" | "warning" | "critical";
  category: "stockout" | "waste" | "staffing" | "delivery" | "complaint" | "campaign" | "margin";
  title: string;
  message: string;
  recommendation: string;
  detectedAt: string;
  confidence: number;
  mode: EventMode;
}

/** Strategic insight (longer-horizon than an alert). */
export interface StrategicInsight {
  id: string;
  storeId: string;
  horizon: "today" | "week";
  title: string;
  message: string;
  evidence: string;
  confidence: number;
  generatedAt: string;
}

let _seq = 0;
function uid(prefix = "evt"): string {
  _seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

export function makeEvent(
  store: KfcStore,
  type: OperationEventType,
  payload: Record<string, unknown>,
  opts: { source?: string; mode?: EventMode; confidence?: number; timestamp?: string } = {},
): OperationEvent {
  return {
    eventId: uid("evt"),
    storeId: store.id,
    type,
    timestamp: opts.timestamp ?? new Date().toISOString(),
    source: opts.source ?? "synthetic",
    mode: opts.mode ?? "synthetic",
    confidence: opts.confidence ?? 0.7,
    payload,
  };
}
