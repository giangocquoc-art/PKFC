// POST /api/automation/approve — approve / reject / execute a task (stateless demo)
// Body: { task: AutomationTask, action: "approve" | "reject" | "execute", by: string, note?: string }
import { NextResponse } from "next/server";
import { approve, reject, execute, type AutomationTask } from "@/lib/automation/approvalWorkflow";

export async function POST(req: Request) {
  let body: { task?: AutomationTask; action?: "approve" | "reject" | "execute"; by?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.task || !body.action) {
    return NextResponse.json({ error: "task and action are required" }, { status: 400 });
  }
  const by = body.by || "store-manager";
  let task = body.task;
  if (body.action === "approve") task = approve(task, by);
  else if (body.action === "reject") task = reject(task, by, body.note);
  else if (body.action === "execute") task = execute(task, by);
  return NextResponse.json({ task });
}
