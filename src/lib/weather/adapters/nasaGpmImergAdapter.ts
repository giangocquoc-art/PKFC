// NASA GPM IMERG Adapter — Rain Evidence Provider
// ================================================
// Production-ready interface for satellite-based precipitation evidence.
// Live ingestion requires NASA GES DISC / OPeNDAP access and a NetCDF/GeoTIFF
// parser, which is too heavy for the current sandbox. The interface is defined
// so live integration is a config + parser change, not an architecture change.
//
// See ADVANCED_WEATHER_AI_INTEGRATION.md and DATA_SOURCES.md.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { WeatherModelProvider, RawWeatherData } from "@/lib/weather/weatherModelProvider";
import { emptyRawWeather } from "@/lib/weather/weatherModelProvider";

/**
 * IMERG returns half-hourly precipitation rate (mm/hr) on a 0.1° global grid.
 * For a store we sample the nearest grid cell and the surrounding 3x3 cells to
 * get a local rain evidence signal. Until live ingestion is enabled, this
 * adapter returns mode='planned' and an empty raw weather payload (the signal
 * layer then relies on Open-Meteo precipitation).
 */
export class NasaGpmImergAdapter implements WeatherModelProvider {
  readonly id = "nasa-gpm-imerg";
  readonly name = "NASA GPM IMERG";
  readonly mode = "planned" as const;

  async fetch(store: KfcStore): Promise<RawWeatherData> {
    // Planned: return an empty payload so the signal layer knows this source
    // contributed nothing. The rain-evidence contribution comes from Open-Meteo.
    return emptyRawWeather(store, this.id, "planned — live ingestion not enabled in this build");
  }
}

export const nasaGpmImergAdapter = new NasaGpmImergAdapter();

/**
 * RainEvidenceSummary — the structured rain-evidence contribution that a live
 * IMERG integration would produce. Exposed so the UI can show "what this
 * source WOULD contribute" even in planned mode.
 */
export interface RainEvidenceSummary {
  source: string;
  mode: "live" | "planned";
  /** Nearest-grid precipitation rate (mm/hr). */
  precipRateMmPerHr: number | null;
  /** 3x3 neighbourhood mean (mm/hr). */
  neighbourhoodMeanMmPerHr: number | null;
  /** Confidence boost contributed to rain-risk (0-0.3). */
  confidenceBoost: number;
  fetchedAt: string | null;
  note: string;
}

export function plannedRainEvidence(): RainEvidenceSummary {
  return {
    source: "NASA GPM IMERG",
    mode: "planned",
    precipRateMmPerHr: null,
    neighbourhoodMeanMmPerHr: null,
    confidenceBoost: 0,
    fetchedAt: null,
    note: "Live ingestion requires NASA GES DISC / OPeNDAP access. Interface is production-ready; rain evidence currently comes from Open-Meteo precipitation.",
  };
}
