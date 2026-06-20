// GET /api/weather?storeId=xxx — fetch weather signal (live-first, fallback) WITH provenance
import { NextResponse } from "next/server";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import { getWeatherSignalWithProvenance } from "@/lib/weather/weatherSignalLayer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }
  const store = SEED_STORES.find((s) => s.id === storeId);
  if (!store) {
    return NextResponse.json({ error: "store not found" }, { status: 404 });
  }
  const { signal: weather, provenance } = await getWeatherSignalWithProvenance(store);
  return NextResponse.json({ weather, store, provenance });
}
