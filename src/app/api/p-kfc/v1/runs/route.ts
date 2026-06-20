import { NextResponse } from "next/server";
import { requirePkfcApiKey } from "@/lib/pkfc/auth";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import { runStoreOpsAgent } from "@/lib/agent/runStoreOpsAgent";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = requirePkfcApiKey(req);
  if (!auth.ok && auth.errorResponse) {
    return auth.errorResponse;
  }

  let body: { storeId?: string; language?: "vi" | "en"; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({
      ok: false,
      error: "invalid_json",
      message: "Invalid JSON body / Yêu cầu không hợp lệ."
    }, { status: 400 });
  }

  const { storeId, language = "vi" } = body;
  if (!storeId) {
    return NextResponse.json({
      ok: false,
      error: "missing_storeId",
      message: language === "vi" ? "Mã cửa hàng (storeId) là bắt buộc." : "Store ID (storeId) is required."
    }, { status: 400 });
  }

  const store = SEED_STORES.find((s) => s.id === storeId);
  if (!store) {
    return NextResponse.json({
      ok: false,
      error: "store_not_found",
      message: language === "vi" ? "Không tìm thấy cửa hàng này." : "Store not found."
    }, { status: 404 });
  }

  try {
    const runResult = await runStoreOpsAgent(store);

    // Extract approval requests
    const approvalRequests: Array<{ action: string; reason: string; risk: string; confidence: number }> = [];
    for (const step of runResult.trace) {
      if (step.structuredOutput && step.structuredOutput.approvalRequired) {
        approvalRequests.push(step.structuredOutput as any);
      }
    }

    // Extract evidence
    const evidence = runResult.trace
      .filter((t) => t.phase === "collect" || t.phase === "analyze" || t.dataSource === "live" || t.dataSource === "fallback")
      .map((t) => `${t.agentName}: ${t.output}`);

    // Build data source mode
    const dataSourceMode = {
      weather: runResult.weather.isLive ? "live" : "fallback",
      operations: runResult.opsBaselineMode,
      inventory: runResult.opsBaselineMode,
      staffing: runResult.opsBaselineMode
    };

    return NextResponse.json({
      ok: true,
      runId: runResult.runId,
      storeName: store.name,
      summary: runResult.briefing.headline,
      actions: [
        { type: "prep", recommendation: runResult.plan.prepRecommendation },
        { type: "staffing", recommendation: runResult.plan.staffingRecommendation },
        { type: "delivery", recommendation: runResult.plan.deliveryReadiness },
        { type: "campaign", recommendation: runResult.plan.campaignRecommendation }
      ],
      approvalRequests: approvalRequests.length > 0 ? approvalRequests : ["None"],
      evidence: evidence.slice(0, 8),
      dataSourceMode,
      disclaimer: "Independent hackathon demo. Not an official KFC product. All recommendations are drafts requiring manager approval."
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: "execution_error",
      message: `Failed to execute agent run: ${err.message || err}`
    }, { status: 500 });
  }
}
