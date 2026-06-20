// GET /api/store-profile?storeId=xxx — build the Store Operating Profile
import { NextResponse } from "next/server";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import { buildStoreOperatingProfile } from "@/lib/storeProfile/storeOperatingProfile";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  const store = SEED_STORES.find((s) => s.id === storeId);
  if (!store) return NextResponse.json({ error: "store not found" }, { status: 404 });
  const profile = buildStoreOperatingProfile(store);
  return NextResponse.json({ profile, store });
}
