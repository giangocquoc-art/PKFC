// GET /api/agent/history?storeId=xxx&limit=20 — list past agent runs for a store
// (Also returns overallRisk + totalDurationMs parsed from the stored JSON
//  so the history panel can render risk gauges and durations without an
//  extra round-trip per row.)
// DELETE /api/agent/history?storeId=xxx — clear all persisted runs for a store
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const limit = Math.min(50, Number(searchParams.get("limit") ?? "20"));
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  try {
    const rows = await db.agentRun.findMany({
      where: { storeId },
      orderBy: { triggeredAt: "desc" },
      take: limit,
      select: {
        id: true,
        storeId: true,
        storeName: true,
        triggeredAt: true,
        confidence: true,
        isLive: true,
        planJson: true,
        traceJson: true,
      },
    });

    const runs = rows.map((r) => {
      let overallRisk: number | null = null;
      let totalDurationMs: number | null = null;
      let headline: string | null = null;
      try {
        const plan = JSON.parse(r.planJson) as { overallRisk?: number };
        if (typeof plan.overallRisk === "number") overallRisk = plan.overallRisk;
      } catch {
        /* ignore */
      }
      try {
        const trace = JSON.parse(r.traceJson) as Array<{ durationMs?: number }>;
        if (Array.isArray(trace)) {
          const sum = trace.reduce((acc, step) => acc + (typeof step.durationMs === "number" ? step.durationMs : 0), 0);
          if (trace.length > 0) totalDurationMs = sum;
        }
      } catch {
        /* ignore */
      }
      // Pull a one-line summary from the trace's last "explain" step if present.
      try {
        const trace = JSON.parse(r.traceJson) as Array<{ phase?: string; output?: string }>;
        const explainStep = [...trace].reverse().find((s) => s.phase === "explain" && typeof s.output === "string");
        if (explainStep?.output) {
          headline = explainStep.output.split("\n")[0].slice(0, 160);
        }
      } catch {
        /* ignore */
      }
      return {
        id: r.id,
        storeId: r.storeId,
        storeName: r.storeName,
        triggeredAt: r.triggeredAt,
        confidence: r.confidence,
        isLive: r.isLive,
        overallRisk,
        totalDurationMs,
        headline,
      };
    });

    return NextResponse.json({ runs });
  } catch {
    return NextResponse.json({ runs: [] });
  }
}

// GET /api/agent/history?id=xxx — get a single run by id (full trace + plan + briefing)
export async function POST(req: Request) {
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    const run = await db.agentRun.findUnique({ where: { id: body.id } });
    if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });
    return NextResponse.json({
      id: run.id,
      storeId: run.storeId,
      storeName: run.storeName,
      triggeredAt: run.triggeredAt,
      confidence: run.confidence,
      isLive: run.isLive,
      trace: JSON.parse(run.traceJson),
      plan: JSON.parse(run.planJson),
      briefing: JSON.parse(run.briefingJson),
    });
  } catch {
    return NextResponse.json({ error: "failed to load run" }, { status: 500 });
  }
}

// DELETE /api/agent/history?storeId=xxx — clear all persisted runs for a store
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  try {
    const result = await db.agentRun.deleteMany({ where: { storeId } });
    return NextResponse.json({ deleted: result.count });
  } catch {
    return NextResponse.json({ error: "failed to clear history" }, { status: 500 });
  }
}
