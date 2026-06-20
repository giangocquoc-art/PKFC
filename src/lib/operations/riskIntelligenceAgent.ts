// Risk Intelligence Agent
// =======================
// Consumes the real-time operations event stream + weather signal + Store
// Operating Profile, computes real-time metrics, detects anomalies, emits
// alerts (pre-stockout, pre-waste, under-staffing, delivery overload), and
// produces strategic insights. This is the "Live Operations Intelligence"
// layer of the StoreOps Autopilot.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { StoreOperatingProfile } from "@/lib/storeProfile/storeOperatingProfile";
import type { WeatherSignal } from "@/lib/types";
import type {
  OperationEvent,
  RealTimeMetrics,
  AnomalyAlert,
  StrategicInsight,
} from "@/lib/operations/realTimeEventSchema";
import { realTimeEventAdapter } from "@/lib/operations/operationsAdapters";

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function sumPayload(events: OperationEvent[], key: string): number {
  return events.reduce((acc, e) => acc + (Number(e.payload[key] ?? 0) || 0), 0);
}

function avgPayload(events: OperationEvent[], key: string): number {
  if (!events.length) return 0;
  return sumPayload(events, key) / events.length;
}

/** Compute real-time metrics from the event stream + weather. */
export function computeRealTimeMetrics(
  store: KfcStore,
  profile: StoreOperatingProfile,
  weather: WeatherSignal,
  events: OperationEvent[],
): RealTimeMetrics {
  const posEvents = events.filter((e) => e.type === "pos-order");
  const deliveryEvents = events.filter((e) => e.type === "delivery-order");
  const inventoryEvents = events.filter((e) => e.type === "inventory-level");
  const staffEvents = events.filter((e) => e.type === "staff-checkin");
  const complaintEvents = events.filter((e) => e.type === "complaint");

  const walkInOrders = sumPayload(posEvents, "orders");
  const deliveryOrders = sumPayload(deliveryEvents, "orders");
  const totalOrders = walkInOrders + deliveryOrders || 1;

  // Walk-in trend: compare to a nominal baseline.
  const baselineWalkIn = profile.operatingType === "urban-center" ? 40 : 24;
  const walkInTrend = ((walkInOrders - baselineWalkIn) / baselineWalkIn) * 100;

  // Delivery surge.
  const baselineDelivery = store.deliveryShare * 40;
  const deliverySurge = ((deliveryOrders - baselineDelivery) / Math.max(1, baselineDelivery)) * 100;

  // Prep utilization.
  const prepUtilization = clamp01(0.3 + (totalOrders / 80) * 0.5);

  // Waste trend — over-prep when walk-in drops but prep stays high.
  const wasteTrend = weather.walkInDropRisk > 0.4 ? 20 + weather.walkInDropRisk * 30 : -5;

  // Stockout probability — from inventory events + delivery surge.
  const stockoutRiskFromInv = avgPayload(inventoryEvents, "stockoutRisk");
  const stockoutProbability = clamp01(
    0.4 * stockoutRiskFromInv + 0.4 * clamp01(deliverySurge / 50) + 0.2 * weather.rainRiskScore,
  );

  // Staffing fit.
  const staffingFit = clamp01(avgPayload(staffEvents, "fitScore") || 0.7);

  // Service delay risk.
  const serviceDelayRisk = clamp01(
    0.5 * weather.deliveryDisruptionRisk + 0.3 * (1 - staffingFit) + 0.2 * clamp01(deliverySurge / 40),
  );

  // Margin risk.
  const marginRisk = clamp01(
    0.3 * clamp01(Math.abs(wasteTrend) / 40) + 0.3 * stockoutProbability + 0.2 * serviceDelayRisk + 0.2 * (1 - staffingFit),
  );

  // Complaint risk.
  const complaintCount = sumPayload(complaintEvents, "count");
  const complaintRisk = clamp01(
    0.4 * weather.rainRiskScore + 0.3 * serviceDelayRisk + 0.15 * stockoutProbability + clamp01(complaintCount / 5) * 0.15,
  );

  // Campaign effectiveness (delivery campaign in rain is effective).
  const campaignEffectiveness = clamp01(
    weather.rainRiskScore > 0.5 ? 0.7 + weather.rainRiskScore * 0.2 : 0.4,
  );

  return {
    storeId: store.id,
    computedAt: new Date().toISOString(),
    walkInTrend: Number(walkInTrend.toFixed(1)),
    deliverySurge: Number(deliverySurge.toFixed(1)),
    prepUtilization: Number(prepUtilization.toFixed(2)),
    wasteTrend: Number(wasteTrend.toFixed(1)),
    stockoutProbability: Number(stockoutProbability.toFixed(2)),
    staffingFit: Number(staffingFit.toFixed(2)),
    serviceDelayRisk: Number(serviceDelayRisk.toFixed(2)),
    marginRisk: Number(marginRisk.toFixed(2)),
    complaintRisk: Number(complaintRisk.toFixed(2)),
    campaignEffectiveness: Number(campaignEffectiveness.toFixed(2)),
    mode: "synthetic",
    eventCount: events.length,
    windowStart: events.length ? events[events.length - 1].timestamp : new Date().toISOString(),
    windowEnd: events.length ? events[0].timestamp : new Date().toISOString(),
  };
}

/** Detect anomalies from real-time metrics + weather + profile. */
export function detectAnomalies(
  store: KfcStore,
  metrics: RealTimeMetrics,
  weather: WeatherSignal,
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const now = new Date().toISOString();

  // Delivery surge alert.
  if (metrics.deliverySurge > 20) {
    alerts.push({
      id: `alert-delivery-${store.id}-${Date.now()}`,
      storeId: store.id,
      severity: metrics.deliverySurge > 35 ? "critical" : "warning",
      category: "delivery",
      title: "Delivery surge exceeds forecast",
      message: `Delivery is trending ${metrics.deliverySurge.toFixed(0)}% above baseline — faster than expected.`,
      recommendation: "Add 1 packing staff member now; pre-confirm extra rider via aggregator.",
      detectedAt: now,
      confidence: 0.8,
      mode: "synthetic",
    });
  }

  // Waste risk alert.
  if (metrics.wasteTrend > 20 && weather.walkInDropRisk > 0.4) {
    alerts.push({
      id: `alert-waste-${store.id}-${Date.now()}`,
      storeId: store.id,
      severity: "warning",
      category: "waste",
      title: "Waste risk rising — early batch too high",
      message: `Waste trend +${metrics.wasteTrend.toFixed(0)}% because batch prep is outpacing the walk-in drop (${(weather.walkInDropRisk * 100).toFixed(0)}%).`,
      recommendation: "Cut the next fried batch by 15%; delay large prep until confirmed demand.",
      detectedAt: now,
      confidence: 0.75,
      mode: "synthetic",
    });
  }

  // Stockout alert.
  if (metrics.stockoutProbability > 0.5) {
    const sku = store.storeType === "suburban" ? "spicy chicken" : "family bucket";
    alerts.push({
      id: `alert-stockout-${store.id}-${Date.now()}`,
      storeId: store.id,
      severity: metrics.stockoutProbability > 0.7 ? "critical" : "warning",
      category: "stockout",
      title: `Stockout risk for ${sku}`,
      message: `Stockout probability ${(metrics.stockoutProbability * 100).toFixed(0)}% in the next 2 hours if no replenishment.`,
      recommendation: store.storeType === "suburban"
        ? "Confirm replenishment delivery NOW — suburban lead time is long."
        : "Pull backstock for high-delivery SKUs before 17:00.",
      detectedAt: now,
      confidence: 0.78,
      mode: "synthetic",
    });
  }

  // Staffing alert.
  if (metrics.staffingFit < 0.6) {
    alerts.push({
      id: `alert-staff-${store.id}-${Date.now()}`,
      storeId: store.id,
      severity: "warning",
      category: "staffing",
      title: "Staffing mismatch at peak",
      message: `Staffing fit is ${(metrics.staffingFit * 100).toFixed(0)}% — current roster doesn't match the demand mix.`,
      recommendation: "Redeploy 1 counter staff to packing; consider calling 1 backup for dinner.",
      detectedAt: now,
      confidence: 0.7,
      mode: "synthetic",
    });
  }

  // Complaint risk alert.
  if (metrics.complaintRisk > 0.5) {
    alerts.push({
      id: `alert-complaint-${store.id}-${Date.now()}`,
      storeId: store.id,
      severity: "warning",
      category: "complaint",
      title: "Complaint risk elevated",
      message: `Complaint risk ${(metrics.complaintRisk * 100).toFixed(0)}% — driven by service delay + stockout.`,
      recommendation: "Set delivery ETA buffer +10min; prepare apology voucher draft for affected orders.",
      detectedAt: now,
      confidence: 0.65,
      mode: "synthetic",
    });
  }

  return alerts;
}

/** Generate strategic insights (longer horizon). */
export function generateStrategicInsights(
  store: KfcStore,
  metrics: RealTimeMetrics,
  weather: WeatherSignal,
  profile: StoreOperatingProfile,
): StrategicInsight[] {
  const insights: StrategicInsight[] = [];
  const now = new Date().toISOString();

  if (weather.rainRiskScore > 0.5 && metrics.campaignEffectiveness > 0.6) {
    insights.push({
      id: `insight-campaign-${store.id}-${Date.now()}`,
      storeId: store.id,
      horizon: "today",
      title: "Delivery campaign outperforming dine-in in rain window",
      message: `Campaign effectiveness ${(metrics.campaignEffectiveness * 100).toFixed(0)}% — delivery combo is converting better than dine-in discount during the current rain window.`,
      evidence: `Rain risk ${(weather.rainRiskScore * 100).toFixed(0)}%, delivery surge ${metrics.deliverySurge.toFixed(0)}%. Store type: ${profile.operatingType}.`,
      confidence: 0.8,
      generatedAt: now,
    });
  }

  if (metrics.wasteTrend > 15 && profile.operatingType === "urban-center") {
    insights.push({
      id: `insight-prep-${store.id}-${Date.now()}`,
      storeId: store.id,
      horizon: "week",
      title: "Recurring over-prep pattern at lunch — review batch schedule",
      message: `Waste trend is consistently positive at lunch for this urban-center store. The fixed batch schedule is over-preparing relative to weather-sensitive walk-in.`,
      evidence: `Waste trend +${metrics.wasteTrend.toFixed(0)}%, walk-in drop risk ${(weather.walkInDropRisk * 100).toFixed(0)}%.`,
      confidence: 0.72,
      generatedAt: now,
    });
  }

  if (store.storeType === "suburban" && metrics.stockoutProbability > 0.4) {
    insights.push({
      id: `insight-replenish-${store.id}-${Date.now()}`,
      storeId: store.id,
      horizon: "week",
      title: "Suburban replenishment lead time is the binding constraint",
      message: `This suburban store's stockout risk is structural — replenishment lead time is too long for demand spikes. Recommend raising the inventory floor for high-delivery SKUs.`,
      evidence: `Stockout probability ${(metrics.stockoutProbability * 100).toFixed(0)}%, delivery share ${(store.deliveryShare * 100).toFixed(0)}%.`,
      confidence: 0.76,
      generatedAt: now,
    });
  }

  return insights;
}

/** Full risk intelligence result. */
export interface RiskIntelligenceResult {
  metrics: RealTimeMetrics;
  alerts: AnomalyAlert[];
  insights: StrategicInsight[];
  events: OperationEvent[];
  sources: { id: string; name: string; mode: string; eventCount: number }[];
}

/** Run the full risk intelligence pipeline for a store. */
export function runRiskIntelligence(
  store: KfcStore,
  profile: StoreOperatingProfile,
  weather: WeatherSignal,
): RiskIntelligenceResult {
  const events = realTimeEventAdapter.emitAll(store, profile, weather, 3);
  const metrics = computeRealTimeMetrics(store, profile, weather, events);
  const alerts = detectAnomalies(store, metrics, weather);
  const insights = generateStrategicInsights(store, metrics, weather, profile);
  const sources = realTimeEventAdapter.sources.map((s) => ({
    id: s.id,
    name: s.name,
    mode: s.mode,
    eventCount: events.filter((e) => e.source === s.id).length,
  }));
  return { metrics, alerts, insights, events, sources };
}
