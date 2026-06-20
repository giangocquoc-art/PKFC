import { NextResponse } from "next/server";
import { requirePkfcApiKey } from "@/lib/pkfc/auth";
import { db } from "@/lib/db";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import { runStoreOpsAgent } from "@/lib/agent/runStoreOpsAgent";
import { buildStoreOperatingProfile } from "@/lib/storeProfile/storeOperatingProfile";
import { runRiskIntelligence } from "@/lib/operations/riskIntelligenceAgent";
import { answerQuestion } from "@/lib/interactions/smartInteractionAgent";
import { retrieve } from "@/lib/knowledge/documentIntelligenceAgent";
import { callRouterChatCompletion } from "@/lib/llm/routerChatClient";
import type { AgentRunResult } from "@/lib/types";

export const dynamic = "force-dynamic";

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
  const auth = requirePkfcApiKey(req);
  if (!auth.ok && auth.errorResponse) {
    return auth.errorResponse;
  }

  let body: {
    model?: string;
    messages?: Array<{ role: string; content: string }>;
    metadata?: {
      storeId?: string;
      runId?: string;
      language?: "vi" | "en";
    };
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

  const { messages, metadata } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "missing_messages",
      message: "Messages array is required.",
    }, { status: 400 });
  }

  const lastUserMessage = messages[messages.length - 1]?.content || "";
  const language = metadata?.language || "vi";

  // Determine which run ID to ground in
  let targetRunId = metadata?.runId;

  // If no run ID provided, scan messages content or get the latest run
  if (!targetRunId) {
    const textToScan = messages.map((m) => m.content).join(" ");
    const match = textToScan.match(/grounded in run:?\s*([a-z0-9\-]+)/i) || textToScan.match(/runId[:=\s]+([a-z0-9\-]+)/i);
    if (match) {
      targetRunId = match[1];
    }
  }

  let runRecord;
  try {
    if (targetRunId) {
      runRecord = await db.agentRun.findUnique({ where: { id: targetRunId } });
    } else {
      runRecord = await db.agentRun.findFirst({ orderBy: { triggeredAt: "desc" } });
    }

    // If no run exists at all, run pipeline for the default store to bootstrap
    if (!runRecord) {
      const defaultStore = SEED_STORES[0];
      const newRun = await runStoreOpsAgent(defaultStore);
      runRecord = await db.agentRun.findUnique({ where: { id: newRun.runId } });
    }
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: "db_error",
      message: `Database error: ${err.message}`
    }, { status: 500 });
  }

  if (!runRecord) {
    return NextResponse.json({
      ok: false,
      error: "run_not_found",
      message: "No active run context found."
    }, { status: 404 });
  }

  const agentResult = reconstructRun(runRecord);
  const plan = agentResult.plan;
  const trace = agentResult.trace;
  const weather = agentResult.weather;
  const opsBaselineMode = agentResult.opsBaselineMode ?? "none";

  const store = SEED_STORES.find((s) => s.id === runRecord.storeId) || SEED_STORES[0];

  const dataSourceMode = {
    weather: runRecord.isLive ? "live" : "fallback",
    operations: opsBaselineMode,
    inventory: opsBaselineMode,
    staffing: opsBaselineMode,
  };

  // Check if any approval required actions exist in the trace
  let approvalRequired = false;
  for (const step of trace) {
    if (step.structuredOutput && step.structuredOutput.approvalRequired) {
      approvalRequired = true;
      break;
    }
  }

  const signals = [
    `Weather: Temp ${weather.temperatureC}°C, Rain risk ${(weather.rainRiskScore * 100).toFixed(0)}%, Delivery disruption risk ${(weather.deliveryDisruptionRisk * 100).toFixed(0)}%`,
    `Lunch expected walk-in delta: ${plan.slots[0]?.expectedWalkInDelta}%, delivery delta: ${plan.slots[0]?.expectedDeliveryDelta}%`,
    `Dinner expected walk-in delta: ${plan.slots[1]?.expectedWalkInDelta}%, delivery delta: ${plan.slots[1]?.expectedDeliveryDelta}%`,
  ];

  const actions = [
    `Prep recommendation: ${plan.prepRecommendation}`,
    `Staffing recommendation: ${plan.staffingRecommendation}`,
    `Delivery readiness: ${plan.deliveryReadiness}`,
    `Campaign recommendation: ${plan.campaignRecommendation}`,
  ];

  const approvalRequests: string[] = [];
  for (const step of trace) {
    if (step.structuredOutput && step.structuredOutput.approvalRequired) {
      approvalRequests.push(JSON.stringify(step.structuredOutput));
    }
  }
  if (approvalRequests.length === 0) {
    approvalRequests.push("None");
  }

  const evidence = trace
    .filter((t) => t.phase === "collect" || t.phase === "analyze" || t.dataSource === "live" || t.dataSource === "fallback")
    .map((t) => `${t.agentName}: ${t.output}`);

  const traceSummary = trace.map((t) => `Step ${t.step}: ${t.agentName} (${t.phase}) - Status: ${t.status}`);

  const contextObj = {
    runId: runRecord.id,
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

  const systemPrompt = language === "vi"
    ? "Bạn là Agent CaMate, trợ lý đồng quản lý ca cho cửa hàng KFC. Chỉ trả lời dựa trên CONTEXT của phiên chạy hiện tại. Không được bịa số liệu, không được tự thêm dữ liệu ngoài context. Nếu context không đủ, hãy nói rõ là chưa đủ dữ liệu. Các hành động nhạy cảm luôn là bản nháp cần quản lý duyệt. P-KFC API là API demo độc lập cho Agent CaMate."
    : "You are Agent CaMate, a StoreOps Decision Agent for KFC shift managers. Answer only from the CURRENT RUN CONTEXT. Do not invent numbers, demand, weather, staffing, inventory, approval status, or real KFC data. If the context is insufficient, say so. Sensitive actions are draft recommendations requiring manager approval. P-KFC API is an independent demo API.";

  const userPrompt = `
CURRENT RUN CONTEXT:
${JSON.stringify(contextObj, null, 2)}

MANAGER QUESTION:
${lastUserMessage}
  `;

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

  if (baseUrl && model) {
    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt }
    ];

    const routerResult = await callRouterChatCompletion({
      providerId,
      adapter,
      baseUrl,
      apiKey: apiKey || undefined,
      model,
      messages: chatMessages,
      temperature: 0.2,
      extraHeaders: Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined,
    });

    if (routerResult.ok && routerResult.content) {
      responseText = routerResult.content;
      providerMode = "router";
    }
  }

  if (providerMode === "fallback") {
    const profile = buildStoreOperatingProfile(store);
    const risk = runRiskIntelligence(store, profile, agentResult.weather);
    const knowledge = retrieve(lastUserMessage, 4);

    const fallbackAns = await answerQuestion({
      role: "manager",
      question: lastUserMessage,
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

  const completionId = `chatcmpl-${Math.random().toString(36).substring(2, 15)}`;

  return NextResponse.json({
    id: completionId,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "p-kfc-agent",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: responseText },
        finish_reason: "stop"
      }
    ],
    metadata: {
      runId: runRecord.id,
      dataSourceMode,
      approvalRequired,
      disclaimer: "Independent hackathon demo. Not an official KFC product."
    }
  });
}
