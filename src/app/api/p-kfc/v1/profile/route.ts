import { NextResponse } from "next/server";
import { requirePkfcApiKey } from "@/lib/pkfc/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = requirePkfcApiKey(req);
  if (!auth.ok && auth.errorResponse) {
    return auth.errorResponse;
  }

  return NextResponse.json({
    ok: true,
    name: "P-KFC API",
    agent: "Agent CaMate",
    version: "v1",
    description: "StoreOps Decision Agent for KFC Ho Chi Minh City shift managers. External HTTP access gateway.",
    capabilities: [
      "storeops_plan",
      "ask_this_plan",
      "manager_briefing",
      "approval_review",
      "evidence_trace"
    ],
    disclaimer: "Independent hackathon demo. Not an official KFC product."
  });
}
