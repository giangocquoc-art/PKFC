// Meteostat Adapter — Historical / Context Weather Provider
// ==========================================================
// Production-ready interface for Meteostat station-level historical data.
// Live ingestion requires a Meteostat API key (commercial for high volume).
// The interface is defined so live integration is a config change.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { WeatherModelProvider, RawWeatherData } from "@/lib/weather/weatherModelProvider";
import { emptyRawWeather } from "@/lib/weather/weatherModelProvider";

/** Nearest Meteostat stations to HCM. */
export const HCM_STATIONS = [
  { id: "48900", name: "Ho Chi Minh (Tan Son Hoa)", lat: 10.817, lng: 106.652, distanceKm: 0 },
  { id: "48910", name: "Vung Tau", lat: 10.167, lng: 107.167, distanceKm: 65 },
];

export class MeteostatAdapter implements WeatherModelProvider {
  readonly id = "meteostat";
  readonly name = "Meteostat";
  readonly mode = "planned" as const;

  async fetch(store: KfcStore): Promise<RawWeatherData> {
    // Planned: return an empty payload. Historical context currently uses a
    // deterministic HCM seasonal model inside the signal layer.
    return emptyRawWeather(store, this.id, "planned — Meteostat API key not provisioned");
  }
}

export const meteostatAdapter = new MeteostatAdapter();

export interface HistoricalContext {
  source: string;
  mode: "live" | "planned";
  /** Seasonal-normal temperature range for the store's location & current month. */
  normalTempRangeC: [number, number] | null;
  /** Seasonal-normal precipitation probability. */
  normalPrecipProb: number | null;
  /** Whether current conditions are anomalous vs normal. */
  anomalyFlag: "above-normal" | "normal" | "below-normal" | null;
  note: string;
}

export function plannedHistoricalContext(month: number): HistoricalContext {
  // HCM wet season (May-Oct) vs dry season.
  const isWet = month >= 4 && month <= 10;
  return {
    source: "Meteostat",
    mode: "planned",
    normalTempRangeC: isWet ? [25, 33] : [21, 31],
    normalPrecipProb: isWet ? 0.6 : 0.2,
    anomalyFlag: null,
    note: "Live Meteostat integration pending API key. Historical normals use a deterministic HCM seasonal model.",
  };
}
