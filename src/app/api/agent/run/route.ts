// POST /api/agent/run — run the full StoreOps Agent pipeline for a store
// Body: { storeId: string }
import { NextResponse } from "next/server";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import { runStoreOpsAgent } from "@/lib/agent/runStoreOpsAgent";

export async function POST(req: Request) {
  const start = Date.now();
  let body: { storeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const storeId = body.storeId;
  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }
  const store = SEED_STORES.find((s) => s.id === storeId);
  if (!store) {
    return NextResponse.json({ error: "store not found" }, { status: 404 });
  }

  const result = await runStoreOpsAgent(store);

  return NextResponse.json({
    ...result,
    serverDurationMs: Date.now() - start,
  });
}
