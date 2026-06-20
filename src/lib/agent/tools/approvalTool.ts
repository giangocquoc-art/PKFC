// Approval Tool — records approval decisions for high-impact actions.
// =========================================================================
// High-impact actions that REQUIRE manager approval:
//   - supplier order
//   - campaign launch
//   - staff change
//   - public customer reply
//   - pricing/discount change
//
// The agent may create DRAFT actions, but manager approval is required
// before execution. This tool records the approval status.

import type { ToolResult } from "./types";

export type ApprovalAction =
  | "supplier-order"
  | "campaign"
  | "staff-change"
  | "customer-reply"
  | "pricing-change";

export interface ApprovalRequest {
  action: ApprovalAction;
  title: string;
  reason: string;
  riskLevel: "medium" | "high";
}

export interface ApprovalDecision {
  action: ApprovalAction;
  approved: boolean;
  decidedBy: string;
  decidedAt: string;
  note?: string;
}

export type ApprovalToolResult = ToolResult<{
  requests: ApprovalRequest[];
  decisions: ApprovalDecision[];
}>

/** Classify which actions in a plan require approval. */
export function classifyApprovalNeeds(plan: {
  inventoryRecommendation: string;
  campaignRecommendation: string;
  staffingRecommendation: string;
}): ApprovalRequest[] {
  const requests: ApprovalRequest[] = [];

  if (plan.inventoryRecommendation?.toLowerCase().includes("order") ||
      plan.inventoryRecommendation?.toLowerCase().includes("urgent")) {
    requests.push({
      action: "supplier-order",
      title: "Supplier Order Draft",
      reason: "Inventory recommendation includes a replenishment order. Manager must approve before sending.",
      riskLevel: "high",
    });
  }

  if (plan.campaignRecommendation?.toLowerCase().includes("campaign") ||
      plan.campaignRecommendation?.toLowerCase().includes("push") ||
      plan.campaignRecommendation?.toLowerCase().includes("promo")) {
    requests.push({
      action: "campaign",
      title: "Campaign Launch Draft",
      reason: "Campaign recommendation requires area manager approval before launch.",
      riskLevel: "high",
    });
  }

  if (plan.staffingRecommendation?.toLowerCase().includes("add") ||
      plan.staffingRecommendation?.toLowerCase().includes("pull") ||
      plan.staffingRecommendation?.toLowerCase().includes("shift")) {
    requests.push({
      action: "staff-change",
      title: "Staff Roster Change Draft",
      reason: "Staffing recommendation changes roster. Manager must confirm.",
      riskLevel: "medium",
    });
  }

  return requests;
}

export function approvalTool(
  plan: { inventoryRecommendation: string; campaignRecommendation: string; staffingRecommendation: string },
): ApprovalToolResult {
  const start = Date.now();
  const requests = classifyApprovalNeeds(plan);
  return {
    ok: true,
    sourceMode: "computed",
    data: { requests, decisions: [] },
    confidenceImpact: 0,
    durationMs: Date.now() - start,
  };
}
