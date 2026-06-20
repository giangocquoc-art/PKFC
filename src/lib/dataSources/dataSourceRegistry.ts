// Data Source Registry
// ====================
// Single source of truth for every external data source the Agent CaMate
// system can reference. Each source declares its id, type, purpose, mode
// (live / verified-seed / simulated / fallback / planned / unavailable),
// where it's used in the pipeline, its fallback strategy, and a reliability
// note. The UI Data Sources panel renders this registry so operators can see
// exactly where every signal comes from.
//
// Principles:
//  - Never mix live and mock data without an explicit mode label.
//  - Every source has a fallback strategy.
//  - Planned sources have a clear interface so they can be activated later.

export type DataSourceMode =
  | "live" // actively fetched at runtime from a real API
  | "verified-seed" // manually verified, curated dataset (e.g. store list)
  | "simulated" // synthetic data used in demo/dev mode
  | "fallback" // deterministic synthetic signal used only when live fails
  | "planned" // interface ready, not yet wired to live data
  | "unavailable"; // interface defined, live integration blocked (e.g. heavy compute)

export type DataSourceType =
  | "store-directory"
  | "geocoding"
  | "weather-current"
  | "weather-forecast"
  | "weather-historical"
  | "rain-evidence"
  | "aviation"
  | "operations-pos"
  | "operations-inventory"
  | "operations-staffing"
  | "llm";

export interface DataSourceEntry {
  id: string;
  name: string;
  url: string;
  type: DataSourceType;
  purpose: string;
  mode: DataSourceMode;
  usedIn: string; // which agent/layer consumes this
  fallbackStrategy: string;
  reliabilityNote: string;
  /** Whether an API key is required. */
  requiresApiKey: boolean;
  /** Cache TTL in seconds, if caching is applied. */
  cacheTtlSec?: number;
  /** Rate limit note. */
  rateLimit?: string;
  /** License. */
  license?: string;
  /** Last-updated label (resolved at render time for live sources). */
  freshnessLabel?: string;
}

export const DATA_SOURCE_REGISTRY: DataSourceEntry[] = [
  {
    id: "kfc-vn-locator",
    name: "KFC Vietnam Store Locator",
    url: "https://kfcvietnam.com.vn/he-thong-nha-hang-kfc",
    type: "store-directory",
    purpose:
      "Source of truth for the KFC Vietnam store list, addresses and districts. Used to seed and verify the 20-store TP.HCM dataset.",
    mode: "verified-seed",
    usedIn: "Store Context Agent · store selector",
    fallbackStrategy:
      "If the locator is unreachable, fall back to the verified seed dataset committed in src/lib/stores/seed-stores.ts (manually cross-checked against the locator).",
    reliabilityNote:
      "Store list, addresses and districts are verified against the public KFC Vietnam locator. Coordinates are pre-geocoded via OSM/Nominatim and committed. The locator is not scraped at runtime to avoid breakage.",
    requiresApiKey: false,
    license: "Public website — used for verification only",
  },
  {
    id: "osm-nominatim",
    name: "OpenStreetMap / Nominatim",
    url: "https://nominatim.org/",
    type: "geocoding",
    purpose:
      "Geocodes store addresses to lat/lng. Results are cached in the GeoCache Prisma table to avoid repeat lookups.",
    mode: "planned",
    usedIn: "Store Context Agent (geocoding path) · map markers",
    fallbackStrategy:
      "If Nominatim fails or is rate-limited, the verified seed coordinates in seed-stores.ts are used. The GeoCache table persists successful lookups.",
    reliabilityNote:
      "Nominatim is free but rate-limited (1 req/sec per usage policy). The 20 seed stores already carry verified coordinates, so live geocoding is only triggered for new/edited stores. Cache TTL: permanent per address.",
    requiresApiKey: false,
    cacheTtlSec: 0, // permanent cache
    rateLimit: "1 request/second (usage policy)",
    license: "ODbL (Open Database License)",
  },
  {
    id: "open-meteo",
    name: "Open-Meteo",
    url: "https://open-meteo.com/",
    type: "weather-current",
    purpose:
      "Primary live weather source: current temperature, apparent temp, humidity, pressure, wind, precipitation, cloud cover + hourly & daily forecast interpolated to store coordinates.",
    mode: "live",
    usedIn: "Weather Signal Agent · Weather Signal Layer · risk scoring",
    fallbackStrategy:
      "On HTTP error, timeout (6s) or malformed payload, the Weather Signal Layer switches to a deterministic synthetic fallback signal derived from store profile + season + time-of-day, with isLive=false and a low confidence (0.45).",
    reliabilityNote:
      "Free, no API key, generous quota (10k/day non-commercial). Best-effort hyperlocal interpolation. Snapshots are persisted to the WeatherSnapshot table for audit. Fallback is clearly labeled in the UI.",
    requiresApiKey: false,
    cacheTtlSec: 300, // 5 min
    rateLimit: "10,000 calls/day (free tier)",
    license: "CC BY 4.0 (attribution required)",
  },
  {
    id: "nasa-gpm-imerg",
    name: "NASA GPM IMERG",
    url: "https://gpm.nasa.gov/data/imerg",
    type: "rain-evidence",
    purpose:
      "Satellite-based precipitation evidence (half-hourly global rain rate). Strengthens rain-risk confidence with actual observed rainfall near the store.",
    mode: "planned",
    usedIn: "Weather Signal Layer (rain evidence cross-check)",
    fallbackStrategy:
      "Until live integration is enabled, rain evidence comes from Open-Meteo precipitation. The RainEvidenceAdapter interface is defined so IMERG can be plugged in without changing the signal layer.",
    reliabilityNote:
      "IMERG provides near-global half-hourly precipitation. Live ingestion requires NASA GES DISC / OPeNDAP access and a NetCDF/GeoTIFF parser — too heavy for the current sandbox. Interface is production-ready; live toggle is a config change.",
    requiresApiKey: false,
    license: "NASA open data (public domain)",
  },
  {
    id: "meteostat",
    name: "Meteostat",
    url: "https://dev.meteostat.net/",
    type: "weather-historical",
    purpose:
      "Historical weather normals and station observations for the nearest station to each store. Used to contextualise whether current conditions are anomalous.",
    mode: "planned",
    usedIn: "Weather Signal Layer (historical context) · Demand Agent (baseline)",
    fallbackStrategy:
      "Until live integration is enabled, historical baselines use a deterministic HCM seasonal model. The MeteostatAdapter interface is defined for future activation.",
    reliabilityNote:
      "Meteostat provides station-level historical data via a Python SDK and REST API. Nearest-station matching for HCM (Tan Son Hoa / Vung Tau) is feasible. Interface ready; live toggle pending API key provisioning.",
    requiresApiKey: true,
    license: "CC BY-NC 4.0 (non-commercial)",
  },
  {
    id: "aviationweather-metar",
    name: "AviationWeather / METAR (Tân Sơn Nhất)",
    url: "https://aviationweather.gov/data/api/",
    type: "aviation",
    purpose:
      "City-level aviation baseline (wind, pressure, cloud, rain/thunderstorm) from Tân Sơn Nhất (VVTS) METAR. Used as a SUPPLEMENT, never as the sole store-area signal.",
    mode: "planned",
    usedIn: "Weather Signal Layer (city-level cross-check)",
    fallbackStrategy:
      "Not used as a primary source. If unavailable, the signal layer relies on Open-Meteo + fallback. The MetarAdapter interface is defined.",
    reliabilityNote:
      "METAR is airport-level (VVTS), ~6km from District 1. Useful as a city-level baseline and for pressure/wind cross-validation. Deliberately NOT used to replace hyperlocal store-area signals.",
    requiresApiKey: false,
    rateLimit: "Fair use",
    license: "Public domain (US government)",
  },
  {
    id: "synthetic-ops",
    name: "Synthetic Operations Data (POS / Inventory / Staffing)",
    url: "",
    type: "operations-pos",
    purpose:
      "Simulated POS demand, inventory levels and staffing rosters used in demo/dev mode to exercise the Demand, Inventory & Prep and Staffing agents. Replaceable by a real POS connector.",
    mode: "simulated",
    usedIn: "Demand Agent · Inventory & Prep Agent · Staffing Agent (baselines)",
    fallbackStrategy:
      "The OperationsDataAdapter interface accepts either the SyntheticOpsAdapter (default) or a CsvOpsAdapter (sample CSV schema provided). Real KFC POS can be plugged in by implementing the same interface.",
    reliabilityNote:
      "Numbers are internally consistent but NOT real KFC data. All before/after comparison metrics are simulated and clearly labeled. The architecture is ready to swap in real POS/inventory/staffing feeds.",
    requiresApiKey: false,
    license: "Simulated (hackathon demo)",
  },
  {
    id: "camate-llm",
    name: "Mô hình AI CaMate",
    url: "",
    type: "llm",
    purpose:
      "Cung cấp khả năng lập luận tự nhiên cho các Agent giải thích rủi ro và tóm tắt ca trực.",
    mode: "live",
    usedIn: "Risk Explanation Agent · Manager Briefing Agent",
    fallbackStrategy:
      "Nếu mô hình AI gặp sự cố (hết thời gian phản hồi, giới hạn lượt gọi), hệ thống tự động kích hoạt kịch bản mẫu dựa trên dữ liệu cấu trúc thực tế.",
    reliabilityNote:
      "Chạy ở phía máy chủ. Tự động chuyển đổi sang chế độ dự phòng nếu lỗi kết nối.",
    requiresApiKey: false,
    rateLimit: "Shared quota",
  },
];

/** Look up a source by id. */
export function getDataSource(id: string): DataSourceEntry | undefined {
  return DATA_SOURCE_REGISTRY.find((s) => s.id === id);
}

/** Get all sources used by a given layer/agent. */
export function sourcesUsedBy(layer: string): DataSourceEntry[] {
  return DATA_SOURCE_REGISTRY.filter((s) => s.usedIn.toLowerCase().includes(layer.toLowerCase()));
}

/** Live vs non-live summary for the Data Sources panel header. */
export function sourceModeSummary() {
  const total = DATA_SOURCE_REGISTRY.length;
  const live = DATA_SOURCE_REGISTRY.filter((s) => s.mode === "live").length;
  const planned = DATA_SOURCE_REGISTRY.filter((s) => s.mode === "planned").length;
  const simulated = DATA_SOURCE_REGISTRY.filter((s) => s.mode === "simulated").length;
  const verifiedSeed = DATA_SOURCE_REGISTRY.filter((s) => s.mode === "verified-seed").length;
  return { total, live, planned, simulated, verifiedSeed };
}
