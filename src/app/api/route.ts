// GET /api — healthcheck endpoint.
// Returns system status: server uptime, data source modes, store count.
import { NextResponse } from "next/server";
import { SEED_STORES } from "@/lib/stores/seed-stores";

export const dynamic = "force-dynamic";

export async function GET() {
  const sponsorMode = process.env.SPONSOR_API_MODE ?? "demo";
  const sponsorConfigured = !!(process.env.SPONSOR_API_BASE_URL && process.env.SPONSOR_API_KEY);

  return NextResponse.json({
    status: "ok",
    service: "agent-camate-ai",
    timestamp: new Date().toISOString(),
    stores: SEED_STORES.length,
    dataSources: {
      weather: "live (open-meteo)",
      operations: {
        mode: sponsorMode,
        sponsorApiConfigured: sponsorConfigured,
        sponsorApiBaseUrl: process.env.SPONSOR_API_BASE_URL ? "[set]" : "[not set]",
      },
    },
    version: "1.0.0",
  });
}
