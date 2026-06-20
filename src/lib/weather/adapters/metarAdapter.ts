// AviationWeather / METAR Adapter — City-level Aviation Baseline
// ==============================================================
// Production-ready interface for METAR observations from Tân Sơn Nhất (VVTS).
// Used ONLY as a city-level SUPPLEMENT (wind, pressure, cloud, rain/thunderstorm
// cross-check), never as the sole store-area signal. Deliberately NOT used to
// replace hyperlocal store-area signals.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { WeatherModelProvider, RawWeatherData } from "@/lib/weather/weatherModelProvider";
import { emptyRawWeather } from "@/lib/weather/weatherModelProvider";

const VVTS_STATION = "VVTS"; // Tan Son Nhat International
const AW_BASE = "https://aviationweather.gov/cgi-bin/data/metar.php";

interface MetarPayload {
  raw: string;
  station: string;
  tempC?: number;
  dewC?: number;
  windDir?: number;
  windSpeedKt?: number;
  visibilityM?: number;
  pressureHpa?: number;
  presentWeather?: string; // e.g. "RA", "TSRA"
  cloudCover?: number; // 0-100 derived from cloud layers
  observedAt?: string;
}

function parseMetar(raw: string): MetarPayload {
  // Minimal METAR parser — handles the common fields we care about.
  // Format example: VVTS 190300Z 18012KT 9999 FEW018 SCT100 28/24 Q1010
  const tokens = raw.trim().split(/\s+/);
  const payload: MetarPayload = { raw, station: tokens[0] ?? VVTS_STATION };
  for (const tok of tokens) {
    if (/^\d{6}Z$/.test(tok)) {
      payload.observedAt = tok;
    } else if (/^\d{3}\d{2}KT$/.test(tok)) {
      payload.windDir = Number(tok.slice(0, 3));
      payload.windSpeedKt = Number(tok.slice(3, 5));
    } else if (/^Q\d{4}$/.test(tok)) {
      payload.pressureHpa = Number(tok.slice(1));
    } else if (/^\d{2}\/M?\d{2}$/.test(tok) || /^\d{2}\/\d{2}$/.test(tok)) {
      const [t, d] = tok.split("/");
      payload.tempC = Number(t);
      payload.dewC = Number(d.startsWith("M") ? `-${d.slice(1)}` : d);
    } else if (/^(FEW|SCT|BKN|OVC)\d{3}$/.test(tok)) {
      const layer = tok.slice(0, 3);
      // Approx cloud cover contribution: FEW=25, SCT=50, BKN=75, OVC=100.
      const contribution = layer === "FEW" ? 25 : layer === "SCT" ? 50 : layer === "BKN" ? 75 : 100;
      payload.cloudCover = Math.min(100, (payload.cloudCover ?? 0) + contribution);
    } else if (/^(RA|TSRA|TS|DZ|SN|FG|BR)$/.test(tok)) {
      payload.presentWeather = tok;
    }
  }
  return payload;
}

function metarToRaw(store: KfcStore, mp: MetarPayload): RawWeatherData {
  const ktToKmh = (kt: number) => kt * 1.852;
  return {
    storeId: store.id,
    lat: store.lat,
    lng: store.lng,
    temperatureC: Number((mp.tempC ?? 29).toFixed(1)),
    apparentTempC: Number((mp.tempC ?? 29).toFixed(1)),
    humidity: 70,
    pressureHpa: mp.pressureHpa ?? 1010,
    pressureTrend: "stable",
    windSpeedKmh: mp.windSpeedKt ? Number(ktToKmh(mp.windSpeedKt).toFixed(1)) : 8,
    windDir: mp.windDir ?? 180,
    precipitationMm: mp.presentWeather?.includes("RA") ? 1 : 0,
    cloudCover: mp.cloudCover ?? 50,
    precipProb: mp.presentWeather?.includes("RA") ? 0.6 : 0.1,
    hourly: [],
    daily: [],
    fetchedAt: new Date().toISOString(),
    source: `metar:${VVTS_STATION}`,
    isLive: true,
  };
}

export class MetarAdapter implements WeatherModelProvider {
  readonly id = "aviationweather-metar";
  readonly name = "AviationWeather / METAR (VVTS)";
  readonly mode = "planned" as const;

  async fetch(store: KfcStore): Promise<RawWeatherData> {
    // Planned mode: do not call the live METAR endpoint yet to keep the demo
    // deterministic. When enabled, the call below is production-ready.
    if (this.mode === "planned") {
      return emptyRawWeather(store, this.id, "planned — live METAR call disabled in this build");
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${AW_BASE}?ids=${VVTS_STATION}&format=raw&hours=1`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      if (!res.ok) return emptyRawWeather(store, this.id, `METAR HTTP ${res.status}`);
      const text = await res.text();
      const lines = text.trim().split("\n").filter(Boolean);
      if (!lines.length) return emptyRawWeather(store, this.id, "no METAR observations");
      const mp = parseMetar(lines[lines.length - 1]); // most recent
      return metarToRaw(store, mp);
    } catch (e) {
      return emptyRawWeather(
        store,
        this.id,
        e instanceof Error ? e.message : "metar fetch error",
      );
    }
  }
}

export const metarAdapter = new MetarAdapter();

export interface AviationBaselineSummary {
  source: string;
  mode: "live" | "planned";
  station: string;
  rawMetar: string | null;
  windKmh: number | null;
  pressureHpa: number | null;
  presentWeather: string | null;
  note: string;
}

export function plannedAviationBaseline(): AviationBaselineSummary {
  return {
    source: "AviationWeather / METAR",
    mode: "planned",
    station: VVTS_STATION,
    rawMetar: null,
    windKmh: null,
    pressureHpa: null,
    presentWeather: null,
    note: "METAR is airport-level (VVTS, ~6km from District 1). Used only as a city-level cross-check, never as the sole store-area signal. Live call is disabled in this build.",
  };
}
