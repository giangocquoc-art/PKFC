// Weather Tool — calls Open-Meteo API (or deterministic fallback).
import type { KfcStore } from "@/lib/stores/seed-stores";
import type { WeatherSignal, WeatherProvenance } from "@/lib/types";
import { getWeatherSignalWithProvenance } from "@/lib/weather/weatherSignalLayer";
import type { ToolResult } from "./types";

export type WeatherToolResult = ToolResult<{
  signal: WeatherSignal;
  provenance: WeatherProvenance;
}>

export async function weatherTool(store: KfcStore): Promise<WeatherToolResult> {
  const start = Date.now();
  try {
    const { signal, provenance } = await getWeatherSignalWithProvenance(store);
    return {
      ok: true,
      sourceMode: signal.isLive ? "live" : "fallback",
      data: { signal, provenance },
      confidenceImpact: signal.isLive ? 0.4 : 0.1,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      sourceMode: "fallback",
      error: err instanceof Error ? err.message : "Weather fetch failed",
      confidenceImpact: -0.3,
      durationMs: Date.now() - start,
    };
  }
}
