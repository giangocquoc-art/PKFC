// POST /api/compare — run the StoreOps Agent for multiple stores in parallel
// Body: { storeIds: string[] }
import { NextResponse } from "next/server";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import { runStoreOpsAgent } from "@/lib/agent/runStoreOpsAgent";

export async function POST(req: Request) {
  let body: { storeIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const ids = body.storeIds ?? [];
  if (!ids.length || ids.length > 4) {
    return NextResponse.json({ error: "provide 1–4 storeIds" }, { status: 400 });
  }
  const stores = ids
    .map((id) => SEED_STORES.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (!stores.length) {
    return NextResponse.json({ error: "no matching stores" }, { status: 404 });
  }

  const results = await Promise.all(stores.map((store) => runStoreOpsAgent(store)));

  return NextResponse.json({ results });
}
