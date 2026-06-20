// POST /api/automation/tasks — generate automation tasks for a store run
// Body: { storeId: string }
import { NextResponse } from "next/server";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import { buildStoreOperatingProfile } from "@/lib/storeProfile/storeOperatingProfile";
import { runStoreOpsAgent } from "@/lib/agent/runStoreOpsAgent";
import { runRiskIntelligence } from "@/lib/operations/riskIntelligenceAgent";
import { generateAutomationTasks } from "@/lib/automation/taskAutomationAgent";

export async function POST(req: Request) {
  let body: { storeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const store = SEED_STORES.find((s) => s.id === body.storeId);
  if (!store) return NextResponse.json({ error: "store not found" }, { status: 404 });

  const profile = buildStoreOperatingProfile(store);
  const agentResult = await runStoreOpsAgent(store);
  const risk = runRiskIntelligence(store, profile, agentResult.weather);
  const tasks = generateAutomationTasks({
    store,
    profile,
    plan: agentResult.plan,
    briefing: agentResult.briefing,
    weather: agentResult.weather,
    risk,
  });

  return NextResponse.json({
    tasks,
    profile,
    risk,
    generatedAt: new Date().toISOString(),
  });
}
