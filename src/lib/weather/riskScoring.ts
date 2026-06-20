// Risk Scoring — pure functions that convert raw weather observations + store
// profile into the derived operational risk scores (rain, heat, delivery
// disruption, walk-in drop). Extracted from the monolithic adapter so the
// formulas are unit-testable and reusable by any WeatherModelProvider.

import type { KfcStore } from "@/lib/stores/seed-stores";

export type PressureTrend = "rising" | "falling" | "stable";

export interface RiskScoreInput {
  precipMm: number;
  precipProb: number; // 0-1
  humidity: number; // %
  windKmh: number;
  pressureTrend: PressureTrend;
  tempC: number;
  cloudCover: number; // %
  store: KfcStore;
}

export interface RiskScores {
  rainRiskScore: number;
  heatRiskScore: number;
  deliveryDisruptionRisk: number;
  walkInDropRisk: number;
}

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/** Walk-in exposure weight by store type (malls are sheltered). */
export function walkInExposure(storeType: KfcStore["storeType"]): number {
  switch (storeType) {
    case "mall":
      return 0.1; // shelter effect — rain can even push footfall up
    case "urban-street":
      return 0.9;
    case "office-area":
      return 0.8;
    case "residential":
      return 0.6;
    case "suburban":
      return 0.6;
    default:
      return 0.6;
  }
}

/** Derive pressure trend from current vs previous reading (if available). */
export function pressureTrendFrom(current: number, previous?: number): PressureTrend {
  if (previous == null || !Number.isFinite(previous)) return "stable";
  const delta = current - previous;
  if (delta > 0.8) return "rising";
  if (delta < -0.8) return "falling";
  return "stable";
}

/** Compute the four derived operational risk scores. */
export function computeRiskScores(input: RiskScoreInput): RiskScores {
  const { precipMm, precipProb, windKmh, pressureTrend, tempC, cloudCover, store } = input;

  // Rain risk blends current precip intensity + probability + falling pressure.
  const precipIntensity = clamp01(precipMm / 8); // 8mm/hr = saturated
  const pressureSignal = pressureTrend === "falling" ? 0.25 : 0;
  const rainRiskScore = clamp01(
    0.45 * precipIntensity + 0.4 * precipProb + pressureSignal + 0.05 * (cloudCover / 100),
  );

  // Heat risk — HCM heat-index style.
  const heatRiskScore = clamp01(
    tempC >= 34 ? 0.7 + (tempC - 34) * 0.08 : tempC >= 31 ? 0.35 + (tempC - 31) * 0.12 : 0.1,
  );

  // Delivery disruption — sensitive to rain + wind + store delivery share + suburban distance.
  const storeDeliveryExposure = store.deliveryShare; // 0.3-0.55
  const suburbanPenalty = store.storeType === "suburban" ? 0.15 : 0;
  const deliveryDisruptionRisk = clamp01(
    0.5 * rainRiskScore +
      0.2 * clamp01(windKmh / 40) +
      0.2 * storeDeliveryExposure +
      suburbanPenalty,
  );

  // Walk-in drop risk — rain collapses walk-in for street/office stores; malls are sheltered.
  const exposure = walkInExposure(store.storeType);
  const walkInDropRisk = clamp01(rainRiskScore * exposure + 0.1 * clamp01(windKmh / 30));

  return { rainRiskScore, heatRiskScore, deliveryDisruptionRisk, walkInDropRisk };
}
