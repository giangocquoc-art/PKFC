// Weather Signal Layer
// ====================
// Orchestrates all weather WeatherModelProviders (Open-Meteo live + planned
// IMERG/Meteostat/METAR) and produces the final WeatherSignal consumed by the
// Weather Signal Agent. Applies risk scoring, confidence blending, source
// provenance, and persistence to the WeatherSnapshot table.
//
// Data flow:
//   Open-Meteo / NASA GPM / METAR  (WeatherModelProvider adapters)
//   → RawWeatherData (normalized)
//   → Weather Signal Layer (this file: blends + risk scoring + confidence)
//   → WeatherSignal (consumed by Weather Signal Agent)
//
// This is the production seam: swapping in GraphCast/Aurora/Earth2Studio as
// additional WeatherModelProviders requires NO change to this layer.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type {
  WeatherSignal,
  HourlyForecastPoint,
  DailyForecastPoint,
} from "@/lib/types";
import type { RawWeatherData } from "@/lib/weather/weatherModelProvider";
import { openMeteoAdapter } from "@/lib/weather/adapters/openMeteoAdapter";
import { computeRiskScores } from "@/lib/weather/riskScoring";
import { db } from "@/lib/db";

export interface SignalLayerProvenance {
  primarySource: string;
  primaryMode: "live" | "fallback";
  contributors: {
    sourceId: string;
    sourceName: string;
    mode: string;
    contributed: boolean;
    note?: string;
  }[];
}

export interface WeatherSignalResult {
  signal: WeatherSignal;
  provenance: SignalLayerProvenance;
}

/** Build the final WeatherSignal from a primary RawWeatherData + store profile. */
function toWeatherSignal(store: KfcStore, raw: RawWeatherData): WeatherSignal {
  const scores = computeRiskScores({
    precipMm: raw.precipitationMm,
    precipProb: raw.precipProb,
    humidity: raw.humidity,
    windKmh: raw.windSpeedKmh,
    pressureTrend: raw.pressureTrend,
    tempC: raw.temperatureC,
    cloudCover: raw.cloudCover,
    store,
  });

  // Confidence: high when we have current + hourly + daily, lower otherwise.
  const hasHourly = raw.hourly.length > 0;
  const hasDaily = raw.daily.length > 0;
  const baseConfidence = raw.isLive ? 0.5 : 0.45;
  const dataConfidence = Math.min(
    0.98,
    baseConfidence + (hasHourly ? 0.3 : 0) + (hasDaily ? 0.2 : 0),
  );

  const hourly: HourlyForecastPoint[] = raw.hourly;
  const daily: DailyForecastPoint[] = raw.daily;

  return {
    storeId: store.id,
    lat: store.lat,
    lng: store.lng,
    temperatureC: raw.temperatureC,
    apparentTempC: raw.apparentTempC,
    humidity: raw.humidity,
    pressureHpa: raw.pressureHpa,
    pressureTrend: raw.pressureTrend,
    windSpeedKmh: raw.windSpeedKmh,
    windDir: raw.windDir,
    precipitationMm: raw.precipitationMm,
    cloudCover: raw.cloudCover,
    rainRiskScore: Number(scores.rainRiskScore.toFixed(2)),
    heatRiskScore: Number(scores.heatRiskScore.toFixed(2)),
    deliveryDisruptionRisk: Number(scores.deliveryDisruptionRisk.toFixed(2)),
    walkInDropRisk: Number(scores.walkInDropRisk.toFixed(2)),
    dataConfidence: Number(dataConfidence.toFixed(2)),
    isLive: raw.isLive,
    source: raw.source,
    fetchedAt: raw.fetchedAt,
    hourlyForecast: hourly,
    dailyForecast: daily,
    fallbackReason: raw.isLive ? undefined : raw.error,
    reliabilityNote: raw.isLive
      ? "Live Open-Meteo observation interpolated to store coordinates. Snapshots persisted for audit."
      : "Deterministic synthetic signal derived from store profile + season + time-of-day. Directional only — re-run when live connectivity restores.",
  };
}

/** Persist a weather snapshot to the WeatherSnapshot table (best-effort). */
async function persistSnapshot(store: KfcStore, signal: WeatherSignal): Promise<void> {
  try {
    await db.weatherSnapshot.create({
      data: {
        storeId: store.id,
        lat: store.lat,
        lng: store.lng,
        payload: JSON.stringify(signal),
        source: signal.source,
        isLive: signal.isLive,
      },
    });
  } catch {
    // Persistence is best-effort — never fail a weather fetch on DB error.
  }
}

/**
 * Public entry — fetch the WeatherSignal for a store.
 * Live-first (Open-Meteo), with deterministic fallback. Persists a snapshot.
 * Never throws.
 */
export async function getWeatherSignal(
  store: KfcStore,
  opts: { persist?: boolean } = {},
): Promise<WeatherSignal> {
  const result = await getWeatherSignalWithProvenance(store, opts);
  return result.signal;
}

/** Fetch with full provenance (used by the Data Sources panel + agent trace). */
export async function getWeatherSignalWithProvenance(
  store: KfcStore,
  opts: { persist?: boolean } = {},
): Promise<WeatherSignalResult> {
  // 1. Primary source: Open-Meteo (live-first with built-in fallback).
  const primary = await openMeteoAdapter.fetch(store);

  // 2. Planned contributors (currently no-op, but recorded for provenance).
  //    When IMERG/Meteostat/METAR are activated, their contributions would be
  //    blended here to strengthen confidence.
  const contributors: SignalLayerProvenance["contributors"] = [
    {
      sourceId: openMeteoAdapter.id,
      sourceName: openMeteoAdapter.name,
      mode: primary.isLive ? "live" : "fallback",
      contributed: true,
      note: primary.error ? `fallback: ${primary.error}` : undefined,
    },
    { sourceId: "nasa-gpm-imerg", sourceName: "NASA GPM IMERG", mode: "planned", contributed: false },
    { sourceId: "meteostat", sourceName: "Meteostat", mode: "planned", contributed: false },
    { sourceId: "aviationweather-metar", sourceName: "METAR (VVTS)", mode: "planned", contributed: false },
  ];

  // 3. Convert to final WeatherSignal (applies risk scoring + confidence).
  const signal = toWeatherSignal(store, primary);

  // 4. Persist snapshot (best-effort).
  if (opts.persist !== false) {
    await persistSnapshot(store, signal);
  }

  return {
    signal,
    provenance: {
      primarySource: primary.source,
      primaryMode: primary.isLive ? "live" : "fallback",
      contributors,
    },
  };
}

/** Bounded-concurrency batch fetch. */
export async function getWeatherSignals(stores: KfcStore[]): Promise<WeatherSignal[]> {
  const results: WeatherSignal[] = [];
  const concurrency = 5;
  for (let i = 0; i < stores.length; i += concurrency) {
    const batch = stores.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((s) => getWeatherSignal(s)));
    results.push(...batchResults);
  }
  return results;
}
