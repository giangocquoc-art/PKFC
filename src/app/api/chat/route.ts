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

function safeText(value: unknown, fallback = "Chưa có dữ liệu") {
  if (value == null || value === "") return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function formatTraceEvidence(trace: any[]) {
  return trace
    .slice(0, 8)
    .map((t) => `- ${safeText(t.agentName, "Tác nhân")} (${safeText(t.phase, "bước")}): ${safeText(t.output, safeText(t.status, "đã xử lý"))}`)
    .join("\n");
}

function isGreetingOnly(input: string) {
  return /^(hello|hi|hey|chào|xin chào|alo|agent camate|camate)[!.\s]*$/i.test(input.trim());
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

  const simulationNotice = run.isLive && opsBaselineMode === "live" ? "Không" : "Có, nếu dùng demo/fallback/simulated hãy nói rõ dựa trên dữ liệu mô phỏng.";

  // System Prompt
  const systemPrompt = `Bạn là Agent CaMate, trợ lý vận hành ca cho cửa hàng KFC.
Nhiệm vụ của bạn là trả lời câu hỏi của quản lý dựa trên dữ liệu phiên chạy hiện tại.
Chỉ dùng dữ liệu trong CONTEXT. Không bịa số liệu.
Nếu thiếu dữ liệu, nói rõ “Tôi chưa có đủ dữ liệu để kết luận”.
Văn phong: tiếng Việt, chuyên nghiệp, thân thiện, ngắn gọn, dễ dùng ngay.
Không dùng JSON. Không dùng ký tự trang trí. Không dùng markdown quá rối.
Luôn ưu tiên format:
1. Kết luận nhanh
2. Bằng chứng từ dữ liệu
3. Đề xuất hành động
4. Mức độ tin cậy

Nếu người dùng chỉ chào hỏi như “hello”, “hi”, “chào”, hãy trả lời thân thiện:
“Chào anh/chị, tôi là Agent CaMate. Tôi có thể giúp phân tích rủi ro ca, tồn kho, nhân sự, giao hàng và các việc cần quản lý duyệt dựa trên phiên chạy hiện tại.”`;

  const userPrompt = isGreetingOnly(message)
    ? `CÂU HỎI NGƯỜI DÙNG:\n${message}\n\nYÊU CẦU TRẢ LỜI:\n- Trả lời đúng câu chào mẫu trong system prompt bằng tiếng Việt.`
    : `DỮ LIỆU PHIÊN CHẠY:
- Mã phiên: ${run.id}
- Cửa hàng: ${store.name} (${store.id}), khu vực ${store.district}
- Nguồn dữ liệu: weather=${dataSourceMode.weather}, operations=${dataSourceMode.operations}, inventory=${dataSourceMode.inventory}, staffing=${dataSourceMode.staffing}
- Dữ liệu mô phỏng/demo/fallback: ${simulationNotice}
- Tín hiệu thời tiết: nhiệt độ ${safeText(weather.temperatureC)}°C; rủi ro mưa ${weather.rainRiskScore != null ? `${(weather.rainRiskScore * 100).toFixed(0)}%` : "Chưa có dữ liệu"}; rủi ro gián đoạn giao hàng ${weather.deliveryDisruptionRisk != null ? `${(weather.deliveryDisruptionRisk * 100).toFixed(0)}%` : "Chưa có dữ liệu"}
- Dự báo nhu cầu: trưa walk-in ${safeText(plan.slots?.[0]?.expectedWalkInDelta)}%, delivery ${safeText(plan.slots?.[0]?.expectedDeliveryDelta)}%; tối walk-in ${safeText(plan.slots?.[1]?.expectedWalkInDelta)}%, delivery ${safeText(plan.slots?.[1]?.expectedDeliveryDelta)}%
- Đề xuất chuẩn bị nguyên liệu: ${safeText(plan.prepRecommendation)}
- Đề xuất nhân sự: ${safeText(plan.staffingRecommendation)}
- Rủi ro giao hàng: ${safeText(plan.deliveryReadiness)}
- Việc cần quản lý duyệt: ${approvalRequests.join("; ")}
- Bằng chứng/trace ngắn gọn:
${formatTraceEvidence(trace)}

CÂU HỎI NGƯỜI DÙNG:
${message}

YÊU CẦU TRẢ LỜI:
- Trả lời bằng tiếng Việt.
- Không hiện JSON.
- Không nhắc “contextObj”.
- Không nhắc internal trace nếu không cần.
- Nếu dữ liệu là demo/mô phỏng thì nói rõ “dựa trên dữ liệu mô phỏng”.`;

  // Read Router API configuration from Server Environment or Database
  let providerId = process.env.LLM_PROVIDER_ID || "gemini";
  let adapter = (process.env.LLM_PROVIDER || "gemini") as any;
  let baseUrl = process.env.LLM_API_BASE_URL || "";
  let apiKey = process.env.LLM_API_KEY || "";
  let model = process.env.LLM_MODEL || "gemini-2.5-flash-lite";
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

  const isGemini = adapter === "gemini" || providerId === "gemini";
  if (isGemini && !baseUrl) {
    baseUrl = "https://generativelanguage.googleapis.com";
  }
  const canUseLLM = !!apiKey && !!model && (isGemini || !!baseUrl);

  let responseText = "";
  let providerMode: "router" | "fallback" = "fallback";
  let warningMessage = "";

  if (canUseLLM) {
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
      responseText = routerResult.content.trim();
      providerMode = "router";
    } else {
      warningMessage = routerResult.error === "adapter_not_implemented"
        ? "Dùng dự phòng vì adapter chưa được hỗ trợ."
        : `Dùng dự phòng vì Gemini lỗi: ${routerResult.message || "kết nối thất bại"}.`;
    }
  } else {
    warningMessage = "Dùng dự phòng vì thiếu cấu hình LLM.";
  }

  if (providerMode === "fallback") {
    console.warn("/api/chat fallback", {
      providerId,
      adapter,
      hasApiKey: !!apiKey,
      hasModel: !!model,
      hasBaseUrl: !!baseUrl,
      error: warningMessage,
    });

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

    responseText = fallbackAns.answer?.trim() || "Chào anh/chị, tôi chưa nhận được câu hỏi vận hành cụ thể. Anh/chị có thể hỏi về rủi ro ca, tồn kho, nhân sự, giao hàng hoặc việc cần duyệt trong phiên chạy hiện tại.";
  }

  const needsApproval = body.role === "customer";
  const draftReply = needsApproval ? responseText : undefined;

  return NextResponse.json({
    role: (body.role as any) || "manager",
    question: message,
    answer: responseText,
    sources: providerMode === "router"
      ? [
          { label: "Phiên chạy", value: run.id },
          { label: "Cửa hàng", value: store.name },
          { label: "Tín hiệu thời tiết", value: weather.isLive ? "live" : "fallback" },
          { label: "Đề xuất ca", value: plan.prepRecommendation },
        ]
      : [
          { label: "Phiên chạy", value: run.id },
          { label: "Cửa hàng", value: store.name },
          { label: "Tín hiệu thời tiết", value: weather.isLive ? "live" : "fallback" },
          { label: "Đề xuất ca", value: plan.prepRecommendation },
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
