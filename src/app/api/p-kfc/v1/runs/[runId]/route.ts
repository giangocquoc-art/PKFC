import { NextResponse } from "next/server";
import { requirePkfcApiKey } from "@/lib/pkfc/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const auth = requirePkfcApiKey(req);
  if (!auth.ok && auth.errorResponse) {
    return auth.errorResponse;
  }

  const { runId } = await params;

  if (!runId) {
    return NextResponse.json({
      ok: false,
      error: "missing_runId",
      message: "Run ID is required."
    }, { status: 400 });
  }

  try {
    const run = await db.agentRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({
        ok: false,
        error: "run_not_found",
        message: `Run with ID '${runId}' not found.`
      }, { status: 404 });
    }

    const plan = JSON.parse(run.planJson);
    const briefing = JSON.parse(run.briefingJson);
    const trace = JSON.parse(run.traceJson);

    // Extract evidence
    const evidence = trace
      .filter((t: any) => t.phase === "collect" || t.phase === "analyze" || t.dataSource === "live" || t.dataSource === "fallback")
      .map((t: any) => `${t.agentName}: ${t.output}`);

    return NextResponse.json({
      ok: true,
      runId: run.id,
      storeId: run.storeId,
      storeName: run.storeName,
      confidence: run.confidence,
      isLive: run.isLive,
      triggeredAt: run.triggeredAt.toISOString(),
      briefing,
      plan,
      evidenceSummary: evidence.slice(0, 8),
      disclaimer: "Independent hackathon demo. Not an official KFC product."
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: "db_error",
      message: `Failed to load run: ${err.message || err}`
    }, { status: 500 });
  }
}
