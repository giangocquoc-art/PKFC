// GET /api/area-overview — compute a lightweight risk snapshot for ALL stores
// for the area-manager view. Bounded concurrency to avoid hammering Open-Meteo.
import { NextResponse } from "next/server";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import { getWeatherSignal } from "@/lib/weather/weatherSignalLayer";
import { buildStoreOperatingProfile } from "@/lib/storeProfile/storeOperatingProfile";

export interface StoreRiskSnapshot {
  storeId: string;
  storeName: string;
  district: string;
  storeType: string;
  operatingType: string;
  highlight?: string;
  isLive: boolean;
  rainRiskScore: number;
  heatRiskScore: number;
  deliveryDisruptionRisk: number;
  walkInDropRisk: number;
  overallRisk: number;
  temperatureC: number;
  precipitationMm: number;
  dataConfidence: number;
  fetchedAt: string;
}

export async function GET() {
  const snapshots: StoreRiskSnapshot[] = [];
  const concurrency = 5;
  for (let i = 0; i < SEED_STORES.length; i += concurrency) {
    const batch = SEED_STORES.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (store) => {
        try {
          const weather = await getWeatherSignal(store);
          const profile = buildStoreOperatingProfile(store);
          const overallRisk = Number(
            (
              0.4 * weather.rainRiskScore +
              0.25 * weather.deliveryDisruptionRisk +
              0.2 * weather.walkInDropRisk +
              0.15 * weather.heatRiskScore
            ).toFixed(2),
          );
          return {
            storeId: store.id,
            storeName: store.name,
            district: store.district,
            storeType: store.storeType,
            operatingType: profile.operatingType,
            highlight: store.highlight,
            isLive: weather.isLive,
            rainRiskScore: weather.rainRiskScore,
            heatRiskScore: weather.heatRiskScore,
            deliveryDisruptionRisk: weather.deliveryDisruptionRisk,
            walkInDropRisk: weather.walkInDropRisk,
            overallRisk,
            temperatureC: weather.temperatureC,
            precipitationMm: weather.precipitationMm,
            dataConfidence: weather.dataConfidence,
            fetchedAt: weather.fetchedAt,
          } satisfies StoreRiskSnapshot;
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) {
      if (r) snapshots.push(r);
    }
  }
  // Sort by overall risk descending (highest risk first).
  snapshots.sort((a, b) => b.overallRisk - a.overallRisk);
  return NextResponse.json({ snapshots, count: snapshots.length });
}
