// GET /api/realtime/events?storeId=xxx — run the Risk Intelligence pipeline
import { NextResponse } from "next/server";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import { buildStoreOperatingProfile } from "@/lib/storeProfile/storeOperatingProfile";
import { getWeatherSignal } from "@/lib/weather/weatherSignalLayer";
import { runRiskIntelligence } from "@/lib/operations/riskIntelligenceAgent";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  const store = SEED_STORES.find((s) => s.id === storeId);
  if (!store) return NextResponse.json({ error: "store not found" }, { status: 404 });
  const profile = buildStoreOperatingProfile(store);
  const weather = await getWeatherSignal(store);
  const result = runRiskIntelligence(store, profile, weather);
  return NextResponse.json(result);
}
