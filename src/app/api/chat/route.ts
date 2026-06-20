// POST /api/chat — Grounded chat with runId context and optional Router API
// =========================================================================
// Input: { runId: string, message: string, language?: "vi" | "en", storeId?, role?, question? }

import { NextResponse } from "next/server";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import { buildStoreOperatingProfile } from "@/lib/storeProfile/storeOperatingProfile";
import { runRiskIntelligence } from "@/lib/operations/riskIntelligenceAgent";
import { answerQuestion } from "@/lib/interactions/smartInteractionAgent";
import { retrieve } from "@/lib/knowledge/documentIntelligenceAgent";
import { db } from "@/lib/db";
import { callRouterChatCompletion } from "@/lib/llm/routerChatClient";
import type { AgentRunResult } from "@/lib/types";

/** Helper to derive ops mode from trace as a fallback if not explicitly persisted. */
function deriveOpsModeFromTrace(trace: any[]): "live" | "csv" | "simulated" | "none" {
  const opsTrace = trace.find((t) => t.agentName === "Operations Baseline Agent");
  if (opsTrace) {
    const out = (opsTrace.output || "").toLowerCase();
    if (out.includes("sponsor(ok)") || out.includes("live")) return "live";
    if (out.includes("csv(ok)") || out.includes("csv")) return "csv";
    if (out.includes("synthetic")) return "simulated";
  }
  return "none";
}

/** Reconstruct an AgentRunResult from a Prisma AgentRun record. */
function reconstructRun(run: {
  storeId: string;
  storeName: string;
  traceJson: string;
  planJson: string;
  briefingJson: string;
  isLive: boolean;
  triggeredAt: Date;
}): AgentRunResult & { opsBaselineMode?: string; dataSources?: any } {
  const trace = JSON.parse(run.traceJson);
  const plan = JSON.parse(run.planJson);
  return {
    storeId: run.storeId,
    storeName: run.storeName,
    trace,
    plan,
    briefing: JSON.parse(run.briefingJson),
    beforeAfter: [],
    weather: trace[1]?.structuredOutput?.signal ?? trace.find((t: { agentName: string }) => t.agentName === "Weather Signal Agent")?.structuredOutput ?? {},
    weatherProvenance: {
      primarySource: "open-meteo",
      primaryMode: run.isLive ? "live" : "fallback",
      contributors: [],
    },
    isLive: run.isLive,
    generatedAt: run.triggeredAt.toISOString(),
    totalDurationMs: 0,
    opsBaselineMode: plan.opsBaselineMode ?? deriveOpsModeFromTrace(trace),
    dataSources: plan.dataSources,
  };
}

export async function POST(req: Request) {
  let body: {
    runId?: string;
    message?: string;
    question?: string; // support question as fallback
    language?: "vi" | "en";
    storeId?: string;
    role?: string;
  };
  
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({
      ok: false,
      error: "invalid_body",
      message: "Invalid JSON body / Yêu cầu không hợp lệ.",
    }, { status: 400 });
  }

  const runId = body.runId;
  const message = body.message || body.question;
  const language = body.language || "vi";

  if (!message) {
    return NextResponse.json({
      ok: false,
      error: "missing_message",
      message: language === "vi" ? "Tin nhắn là bắt buộc." : "Message is required.",
    }, { status: 400 });
  }

  if (!runId) {
    return NextResponse.json({
      ok: false,
      error: "missing_runId",
      message: language === "vi" ? "Mã phiên chạy (runId) là bắt buộc." : "Run ID (runId) is required.",
    }, { status: 400 });
  }

  // Load the exact AgentRun by Prisma ID (or find latest overall if runId is 'latest')
  let run;
  try {
    if (runId === "latest") {
      run = await db.agentRun.findFirst({
        orderBy: { triggeredAt: "desc" },
      });
    } else {
      run = await db.agentRun.findUnique({ where: { id: runId } });
    }
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: "db_error",
      message: language === "vi" ? "Lỗi truy vấn cơ sở dữ liệu." : "Database query failed.",
    }, { status: 500 });
  }

  if (!run) {
    return NextResponse.json({
      ok: false,
      error: "run_not_found",
      message: language === "vi" ? "Không tìm thấy phiên chạy này." : "Run not found.",
    });
  }

  // Reconstruct context
  const agentResult = reconstructRun(run);
  const plan = agentResult.plan;
  const briefing = agentResult.briefing;
  const trace = agentResult.trace;
  const weather = agentResult.weather;
  const opsBaselineMode = agentResult.opsBaselineMode ?? "none";

  const store = SEED_STORES.find((s) => s.id === run.storeId) || SEED_STORES[0];

  // Build dataSourceMode
  const dataSourceMode = {
    weather: run.isLive ? "live" : "fallback",
    operations: opsBaselineMode,
    inventory: opsBaselineMode,
    staffing: opsBaselineMode,
  };

  // Extract signals
  const signals = [
    `Weather: Temp ${weather.temperatureC}°C, Rain risk ${(weather.rainRiskScore * 100).toFixed(0)}%, Delivery disruption risk ${(weather.deliveryDisruptionRisk * 100).toFixed(0)}%`,
    `Lunch expected walk-in delta: ${plan.slots[0]?.expectedWalkInDelta}%, delivery delta: ${plan.slots[0]?.expectedDeliveryDelta}%`,
    `Dinner expected walk-in delta: ${plan.slots[1]?.expectedWalkInDelta}%, delivery delta: ${plan.slots[1]?.expectedDeliveryDelta}%`,
  ];

  // Extract actions
  const actions = [
    `Prep recommendation: ${plan.prepRecommendation}`,
    `Staffing recommendation: ${plan.staffingRecommendation}`,
    `Delivery readiness: ${plan.deliveryReadiness}`,
    `Campaign recommendation: ${plan.campaignRecommendation}`,
  ];

  // Extract approval requests
  const approvalRequests: string[] = [];
  for (const step of trace) {
    if (step.structuredOutput && step.structuredOutput.approvalRequired) {
      approvalRequests.push(JSON.stringify(step.structuredOutput));
    } else if (step.agentName && step.agentName.toLowerCase().includes("approval") && step.output) {
      approvalRequests.push(step.output);
    }
  }
  if (approvalRequests.length === 0) {
    approvalRequests.push("None");
  }

  // Extract evidence
  const evidence = trace
    .filter((t) => t.phase === "collect" || t.phase === "analyze" || t.dataSource === "live" || t.dataSource === "fallback")
    .map((t) => `${t.agentName}: ${t.output}`);

  // Extract trace summary
  const traceSummary = trace.map((t) => `Step ${t.step}: ${t.agentName} (${t.phase}) - Status: ${t.status}`);

  // Build context object
  const contextObj = {
    runId: run.id,
    store: {
      id: store.id,
      name: store.name,
      district: store.district,
      type: (store as any).storeType || "standard",
    },
    dataSourceMode,
    signals,
    actions,
    approvalRequests,
    evidence,
    traceSummary,
  };

  // System Prompt
  const systemPrompt = language === "vi"
    ? "Bạn là Agent CaMate, trợ lý đồng quản lý ca cho cửa hàng KFC. Chỉ trả lời dựa trên CONTEXT của phiên chạy hiện tại. Không được bịa số liệu, không được tự thêm dữ liệu ngoài context. Nếu context không đủ, hãy nói rõ là chưa đủ dữ liệu. Các hành động nhạy cảm luôn là bản nháp cần quản lý duyệt."
    : "You are Agent CaMate, a StoreOps Decision Agent for KFC shift managers. Answer only from the CURRENT RUN CONTEXT. Do not invent numbers, demand, weather, staffing, inventory, approval status, or real KFC data. If the context is insufficient, say so. Sensitive actions are draft recommendations requiring manager approval.";

  const userPrompt = `
CURRENT RUN CONTEXT:
${JSON.stringify(contextObj, null, 2)}

MANAGER QUESTION:
${message}
  `;

  // Read Router API configuration from Server Environment or Database
  let providerId = process.env.LLM_PROVIDER_ID || "custom-openai-compatible";
  let adapter = (process.env.LLM_PROVIDER || "openai-compatible") as any;
  let baseUrl = process.env.LLM_API_BASE_URL || "";
  let apiKey = process.env.LLM_API_KEY || "";
  let model = process.env.LLM_MODEL || "";
  let extraHeaders: Record<string, string> = {};

  if (process.env.LLM_HTTP_REFERER) extraHeaders["HTTP-Referer"] = process.env.LLM_HTTP_REFERER;
  if (process.env.LLM_APP_TITLE) extraHeaders["X-Title"] = process.env.LLM_APP_TITLE;

  if (!baseUrl || !model) {
    try {
      const dbConfig = await db.dataSourceConfig.findUnique({ where: { id: "src-ai-model" } });
      if (dbConfig) {
        if (dbConfig.apiUrl) baseUrl = dbConfig.apiUrl;
        if (dbConfig.headers) {
          const parsed = JSON.parse(dbConfig.headers);
          if (parsed.selectedModel) model = parsed.selectedModel;
          if (parsed.providerId) providerId = parsed.providerId;
          if (parsed.adapter) adapter = parsed.adapter;
          if (parsed.extraHeaders) extraHeaders = { ...extraHeaders, ...parsed.extraHeaders };
        }
      }
    } catch {
      // ignore
    }
  }

  let responseText = "";
  let providerMode: "router" | "fallback" = "fallback";
  let warningMessage = "";

  if (baseUrl && model) {
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt }
    ];

    const routerResult = await callRouterChatCompletion({
      providerId,
      adapter,
      baseUrl,
      apiKey: apiKey || undefined,
      model,
      messages,
      temperature: 0.2,
      extraHeaders: Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined,
    });

    if (routerResult.ok && routerResult.content) {
      responseText = routerResult.content;
      providerMode = "router";
    } else {
      warningMessage = routerResult.error === "adapter_not_implemented"
        ? (language === "vi" 
            ? "Đang dùng câu trả lời dự phòng vì provider này cần adapter riêng chưa được triển khai." 
            : "Selected provider adapter is not implemented yet. Using fallback.")
        : (language === "vi"
            ? `Đang dùng câu trả lời dự phòng vì Router API lỗi: ${routerResult.message || "Kết nối thất bại"}.`
            : `Using fallback answer because Router API call failed: ${routerResult.message || "Connection failed"}.`);
    }
  } else {
    warningMessage = language === "vi"
      ? "Đang dùng câu trả lời dự phòng vì Router API chưa cấu hình."
      : "Using fallback answer because Router API is not configured.";
  }

  if (providerMode === "fallback") {
    // Call the local deterministic fallback
    const profile = buildStoreOperatingProfile(store);
    const risk = runRiskIntelligence(store, profile, agentResult.weather);
    const knowledge = retrieve(message, 4);

    const fallbackAns = await answerQuestion({
      role: (body.role as any) || "manager",
      question: message,
      store,
      profile,
      weather: agentResult.weather,
      plan: agentResult.plan,
      briefing: agentResult.briefing,
      risk,
      knowledge,
    });

    responseText = fallbackAns.answer;
  }

  const needsApproval = body.role === "customer";
  const draftReply = needsApproval ? responseText : undefined;

  return NextResponse.json({
    role: (body.role as any) || "manager",
    question: message,
    answer: responseText,
    sources: providerMode === "router"
      ? [
          { label: "Run Context", value: `Run ID ${run.id}` },
          { label: "Store", value: store.name },
          { label: "Weather Signal", value: weather.isLive ? "live" : "fallback" },
        ]
      : [
          { label: "Weather signal", value: weather.isLive ? "live" : "fallback" },
          { label: "Shift recommendation", value: plan.prepRecommendation },
        ],
    confidence: providerMode === "router" ? 0.95 : 0.85,
    needsApproval,
    draftReply,
    escalateToHuman: false,
    mode: providerMode === "router" ? "live" : "fallback",
    timestamp: new Date().toISOString(),

    // Spec required properties
    groundedInRun: true,
    runId: run.id,
    modelUsed: providerMode === "router" ? model : "fallback-rules",
    providerMode: providerMode,
    evidenceUsed: evidence.slice(0, 5),
    dataSourceMode: dataSourceMode,
    warning: providerMode === "fallback" ? warningMessage : undefined,
  });
}
