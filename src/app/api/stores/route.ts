// GET /api/stores — list all KFC seed stores in TP.HCM
import { NextResponse } from "next/server";
import { SEED_STORES, HIGHLIGHT_STORES } from "@/lib/stores/seed-stores";

export async function GET() {
  return NextResponse.json({
    stores: SEED_STORES,
    highlights: HIGHLIGHT_STORES,
    count: SEED_STORES.length,
  });
}
