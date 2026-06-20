// POST /api/simulate — Decision Simulator / What-If Scenario Explorer
// Lets a manager override weather risk scores and see how the plan changes.
// Uses getOpsBaseline + runAgentPipeline with the overridden weather signal.
//
// Body: { storeId: string, overrides: { rainRiskScore?, heatRiskScore?, deliveryDisruptionRisk?, walkInDropRisk? } }
import { NextResponse } from "next/server";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import { getWeatherSignalWithProvenance } from "@/lib/weather/weatherSignalLayer";
import { getOpsBaseline } from "@/lib/operations/getOpsBaseline";
import { runAgentPipeline } from "@/lib/agent/engine";
import type { WeatherSignal } from "@/lib/types";

function applyOverrides(weather: WeatherSignal, overrides: {
  rainRiskScore?: number;
  heatRiskScore?: number;
  deliveryDisruptionRisk?: number;
  walkInDropRisk?: number;
}): WeatherSignal {
  return {
    ...weather,
    rainRiskScore: overrides.rainRiskScore != null ? Math.max(0, Math.min(1, overrides.rainRiskScore)) : weather.rainRiskScore,
    heatRiskScore: overrides.heatRiskScore != null ? Math.max(0, Math.min(1, overrides.heatRiskScore)) : weather.heatRiskScore,
    deliveryDisruptionRisk: overrides.deliveryDisruptionRisk != null ? Math.max(0, Math.min(1, overrides.deliveryDisruptionRisk)) : weather.deliveryDisruptionRisk,
    walkInDropRisk: overrides.walkInDropRisk != null ? Math.max(0, Math.min(1, overrides.walkInDropRisk)) : weather.walkInDropRisk,
  };
}

export async function POST(req: Request) {
  let body: { storeId?: string; overrides?: Record<string, number> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const storeId = body.storeId;
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  const store = SEED_STORES.find((s) => s.id === storeId);
  if (!store) return NextResponse.json({ error: "store not found" }, { status: 404 });

  // Fetch live weather (cached) + provenance.
  const { signal: weather, provenance } = await getWeatherSignalWithProvenance(store);

  // Apply the manager's overrides.
  const overridden = applyOverrides(weather, body.overrides ?? {});

  // Fetch ops baseline (sponsor → CSV → synthetic) — same chain as runStoreOpsAgent.
  const { baseline: opsBaseline, source: opsSource } = await getOpsBaseline(store);

  // Run the pipeline with overridden weather + real ops baseline.
  // This route intentionally calls runAgentPipeline directly (not runStoreOpsAgent)
  // because it applies custom weather overrides that bypass the normal observe phase.
  const result = await runAgentPipeline(store, overridden, provenance, opsBaseline);

  return NextResponse.json({
    original: {
      rainRiskScore: weather.rainRiskScore,
      heatRiskScore: weather.heatRiskScore,
      deliveryDisruptionRisk: weather.deliveryDisruptionRisk,
      walkInDropRisk: weather.walkInDropRisk,
      overallRisk: Number(
        (
          0.4 * weather.rainRiskScore +
          0.25 * weather.deliveryDisruptionRisk +
          0.2 * weather.walkInDropRisk +
          0.15 * weather.heatRiskScore
        ).toFixed(2),
      ),
    },
    overridden: {
      rainRiskScore: overridden.rainRiskScore,
      heatRiskScore: overridden.heatRiskScore,
      deliveryDisruptionRisk: overridden.deliveryDisruptionRisk,
      walkInDropRisk: overridden.walkInDropRisk,
      overallRisk: result.plan.overallRisk,
    },
    plan: result.plan,
    briefing: result.briefing,
    slots: result.plan.slots,
    beforeAfter: result.beforeAfter,
    isLive: weather.isLive,
    opsBaselineMode: opsBaseline.mode,
    opsBaselineSource: opsSource,
    note: "Simulated plan based on overridden risk scores. NOT persisted. Does not change the live action plan.",
  });
}
