// Backwards-compatible re-export.
// The weather architecture has been split into:
//   - src/lib/weather/adapters/openMeteoAdapter.ts (WeatherModelProvider impl)
//   - src/lib/weather/weatherSignalLayer.ts        (orchestrator + provenance)
//   - src/lib/weather/riskScoring.ts               (pure risk-score formulas)
//   - src/lib/weather/weatherModelProvider.ts      (pluggable interface)
//   - src/lib/weather/adapters/nasaGpmImergAdapter.ts (planned rain evidence)
//   - src/lib/weather/adapters/metostatAdapter.ts     (planned historical)
//   - src/lib/weather/adapters/metarAdapter.ts        (planned aviation baseline)
//
// Existing imports of getWeatherSignal/computeRiskScores from this path continue
// to work. New code should import from the split modules directly.

export { getWeatherSignal, getWeatherSignals } from "@/lib/weather/weatherSignalLayer";
export { computeRiskScores, clamp01, walkInExposure, pressureTrendFrom } from "@/lib/weather/riskScoring";
export type { RiskScores, RiskScoreInput, PressureTrend } from "@/lib/weather/riskScoring";
