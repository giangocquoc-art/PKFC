// WeatherModelProvider — pluggable interface for weather data sources.
// ================================================================
// Any weather source (Open-Meteo live, NASA GPM IMERG, Meteostat, a future
// GraphCast/Aurora/Earth2Studio model) implements this interface so the
// Weather Signal Layer can consume it without knowing the underlying source.
//
// This is the seam described in ADVANCED_WEATHER_AI_INTEGRATION.md: advanced
// AI weather models (GraphCast, Aurora, Earth2Studio, RainNet, NowcastNet)
// would be wired as additional WeatherModelProviders and selected via config.

import type { KfcStore } from "@/lib/stores/seed-stores";

/** Raw normalized weather data returned by any adapter (before risk scoring). */
export interface RawWeatherData {
  storeId: string;
  lat: number;
  lng: number;
  temperatureC: number;
  apparentTempC: number;
  humidity: number;
  pressureHpa: number;
  pressureTrend: "rising" | "falling" | "stable";
  windSpeedKmh: number;
  windDir: number;
  precipitationMm: number;
  cloudCover: number;
  precipProb: number; // 0-1, next-hour probability
  hourly: {
    time: string;
    tempC: number;
    precipProb: number;
    precipMm: number;
    windKmh: number;
    humidity: number;
  }[];
  daily: {
    date: string;
    tempMaxC: number;
    tempMinC: number;
    precipProb: number;
    precipSumMm: number;
    windMaxKmh: number;
  }[];
  fetchedAt: string; // ISO
  source: string; // adapter identifier
  isLive: boolean;
  error?: string; // populated when the adapter failed and returned fallback data
}

export interface WeatherModelProvider {
  /** Stable identifier for this provider. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Current operational mode. */
  readonly mode: "live" | "fallback" | "planned" | "unavailable";
  /** Fetch raw normalized weather data for a store. Never throws — returns fallback data with isLive=false on error. */
  fetch(store: KfcStore): Promise<RawWeatherData>;
}

/** Helper for adapters to build a fallback RawWeatherData deterministically. */
export function emptyRawWeather(store: KfcStore, source: string, error?: string): RawWeatherData {
  return {
    storeId: store.id,
    lat: store.lat,
    lng: store.lng,
    temperatureC: 29,
    apparentTempC: 31,
    humidity: 70,
    pressureHpa: 1010,
    pressureTrend: "stable",
    windSpeedKmh: 8,
    windDir: 180,
    precipitationMm: 0,
    cloudCover: 50,
    precipProb: 0,
    hourly: [],
    daily: [],
    fetchedAt: new Date().toISOString(),
    source,
    isLive: false,
    error,
  };
}
