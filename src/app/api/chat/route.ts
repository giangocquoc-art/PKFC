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
import { AGENT_CAMATE_RUNTIME_POLICY } from "@/lib/agent/runtimePolicy";

/** Helper to clean mojibake from texts */
function cleanMojibake(str: string): string {
  if (!str || typeof str !== "string") return str;
  return str
    .replace(/KFC LÃª Lai/g, "KFC Lê Lai")
    .replace(/LÃª Lai/g, "Lê Lai")
    .replace(/LÃª/g, "Lê")
    .replace(/Quáºn 1/g, "Quận 1")
    .replace(/Quáºn/g, "Quận")
    .replace(/Rá»§i ro/g, "Rủi ro")
    .replace(/Rá»§i/g, "Rủi")
    .replace(/ChÆ°a cÃ³/g, "Chưa có")
    .replace(/ChÆ°a/g, "Chưa")
    .replace(/cÃ³/g, "có")
    .replace(/(\d{2}:\d{2})â(\d{2}:\d{2})/g, "$1–$2")
    .replace(/11:30â13:30/g, "11:30–13:30")
    .replace(/11:30â13:00/g, "11:30–13:00");
}

/** Recursively clean mojibake from nested objects */
function deepCleanMojibake<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    return cleanMojibake(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepCleanMojibake) as unknown as T;
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      cleaned[key] = deepCleanMojibake((obj as any)[key]);
    }
    return cleaned as T;
  }
  return obj;
}

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

function isGreetingOnly(input: string) {
  return /^(hello|hi|hey|chào|xin chào|alo|agent camate|camate|chao)[!.\s]*$/i.test(input.trim());
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
    return new NextResponse(
      JSON.stringify({
        answer: "Yêu cầu không hợp lệ. Vui lòng thử lại.",
        providerMode: "fallback",
        modelUsed: "fallback-rules",
        confidence: 0,
        sources: [],
        warning: "Invalid JSON body / Yêu cầu không hợp lệ."
      }),
      { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  const runId = body.runId;
  const message = body.message || body.question;

  if (!message) {
    return new NextResponse(
      JSON.stringify({
        answer: "Tin nhắn trống. Vui lòng nhập câu hỏi.",
        providerMode: "fallback",
        modelUsed: "fallback-rules",
        confidence: 0,
        sources: [],
        warning: "Message is required."
      }),
      { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  // If no runId, return a friendly Vietnamese warning message instead of a blank page or blank fallback
  if (!runId) {
    return new NextResponse(
      JSON.stringify({
        answer: "Hiện tại em chưa có dữ liệu phiên chạy này. Anh/chị vui lòng bấm nút Chạy phân tích ca trên bảng điều khiển trước để em có dữ liệu hỗ trợ nhé!",
        providerMode: "fallback",
        modelUsed: "fallback-rules",
        confidence: 0,
        sources: [],
        warning: "Thiếu phiên chạy"
      }),
      { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
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
    return new NextResponse(
      JSON.stringify({
        answer: "Không thể kết nối cơ sở dữ liệu để lấy thông tin phiên chạy. Vui lòng thử lại.",
        providerMode: "fallback",
        modelUsed: "fallback-rules",
        confidence: 0,
        sources: [],
        warning: "Database query failed."
      }),
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  if (!run) {
    return new NextResponse(
      JSON.stringify({
        answer: "Hiện tại em chưa có dữ liệu phiên chạy này. Anh/chị vui lòng bấm nút Chạy phân tích ca trên bảng điều khiển trước để em có dữ liệu hỗ trợ nhé!",
        providerMode: "fallback",
        modelUsed: "fallback-rules",
        confidence: 0,
        sources: [],
        warning: "Run not found."
      }),
      { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  // Reconstruct and deep clean context from Mojibake
  const rawAgentResult = reconstructRun(run);
  const agentResult = deepCleanMojibake(rawAgentResult);

  const plan = agentResult.plan;
  const trace = agentResult.trace;
  const weather = agentResult.weather;
  const opsBaselineMode = agentResult.opsBaselineMode ?? "none";

  const store = SEED_STORES.find((s) => s.id === run.storeId) || SEED_STORES[0];

  // If user only greeted, return a friendly guideline response immediately without hitting Gemini
  if (isGreetingOnly(message)) {
    return new NextResponse(
      JSON.stringify({
        answer: "Chào anh/chị! Em là CaMate, trợ lý vận hành ca cho cửa hàng. Em có thể hỗ trợ anh/chị nhận định rủi ro ca, chuẩn bị nguyên liệu, điều phối nhân sự, chuẩn bị giao hàng hoặc kiểm tra các tác vụ cần phê duyệt trong ca trực hiện tại. Anh/chị cần em hỗ trợ gì cho ca trực này ạ?",
        providerMode: "fallback",
        modelUsed: "greeting-detector",
        confidence: 1.0,
        sources: []
      }),
      { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  // Map store type to Vietnamese
  const storeTypeMap: Record<string, string> = {
    "urban-street": "Đường phố đô thị",
    "mall": "Trung tâm thương mại",
    "residential": "Khu dân cư",
    "suburban": "Ngoại ô",
    "office-area": "Khu văn phòng"
  };
  const storeTypeVi = storeTypeMap[store.storeType] || store.storeType;

  // Extract top 3 risks sorted by weight descending
  const topRisks = (plan.risks || [])
    .slice()
    .sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0))
    .slice(0, 3)
    .map((r: any) => `- ${r.factor} (ảnh hưởng: ${(r.weight * 100).toFixed(0)}%): ${r.reasoning}`)
    .join("\n");

  // Determine approvals status
  const approvalStep = trace.find((t: any) => t.phase === "approval" || t.agentName === "Approval Workflow" || t.agentName === "Approval Guardrail");
  const approvalRequired = approvalStep?.structuredOutput?.approvalRequired ? "Có" : "Không";
  const approvalStatus = approvalStep?.structuredOutput?.approvalRequired ? "Chờ duyệt (Pending)" : "Không yêu cầu (Not-required)";

  // Trace evidence (up to 5 key steps, summarized to a single line each, avoiding technical trace jargon)
  const keyTraceSteps = trace
    .filter((t: any) => ["observe", "classify", "diagnose", "plan", "approval"].includes(t.phase))
    .slice(-5);
  const traceEvidence = keyTraceSteps
    .map((t: any) => `- ${t.agentName}: ${t.output.length > 90 ? t.output.slice(0, 90) + "..." : t.output}`)
    .join("\n");

  // Build dataSourceMode label for prompt
  const dataSourceMode = {
    weather: run.isLive ? "Thực tế" : "Dự phòng",
    operations: opsBaselineMode === "live" ? "Sponsor API" : opsBaselineMode === "csv" ? "Tải lên từ CSV" : "Mô phỏng",
  };

  // Compile system prompt combining runtime policy with clean context parameters
  const systemPrompt = `${AGENT_CAMATE_RUNTIME_POLICY}

DỮ LIỆU CONTEXT PHIÊN CHẠY HIỆN TẠI:
- Cửa hàng: ${store.name} (${store.id}), loại hình ${storeTypeVi}, quận ${store.district}
- Nguồn dữ liệu hoạt động: Thời tiết: ${dataSourceMode.weather}, Vận hành: ${dataSourceMode.operations}
- Tín hiệu thời tiết: nhiệt độ ${weather.temperatureC}°C, lượng mưa ${weather.precipitationMm || 0}mm, rủi ro mưa ${(weather.rainRiskScore * 100).toFixed(0)}%, rủi ro giảm lượng khách trực tiếp ${(weather.walkInDropRisk * 100).toFixed(0)}%, rủi ro gián đoạn giao hàng ${(weather.deliveryDisruptionRisk * 100).toFixed(0)}%
- Dự báo biến động nhu cầu: trưa (walk-in: ${plan.slots?.[0]?.expectedWalkInDelta}%, delivery: ${plan.slots?.[0]?.expectedDeliveryDelta}%), tối (walk-in: ${plan.slots?.[1]?.expectedWalkInDelta}%, delivery: ${plan.slots?.[1]?.expectedDeliveryDelta}%)
- Rủi ro tổng thể: ${(plan.overallRisk * 100).toFixed(0)}% (độ tin cậy của thuật toán: ${(plan.confidence * 100).toFixed(0)}%)
- Top 3 rủi ro chi tiết:
${topRisks || "Không phát hiện rủi ro lớn nào"}
- Khuyến nghị chuẩn bị nguyên liệu: ${plan.prepRecommendation}
- Khuyến nghị tồn kho: ${plan.inventoryRecommendation}
- Khuyến nghị nhân sự: ${plan.staffingRecommendation}
- Khuyến nghị độ sẵn sàng giao hàng: ${plan.deliveryReadiness}
- Yêu cầu phê duyệt hành động nhạy cảm: ${approvalRequired} (Trạng thái: ${approvalStatus})
- Bằng chứng vết chạy (Trace):
${traceEvidence}
`;

  const userPrompt = `Hãy trả lời câu hỏi sau đây từ quản lý cửa hàng:
"${message}"`;

  // Read Router API configuration
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
    const routerResult = await callRouterChatCompletion({
      providerId,
      adapter,
      baseUrl,
      apiKey: apiKey || undefined,
      model,
      messages: [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt }
      ],
      temperature: 0.2,
      extraHeaders: Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined,
    });

    if (routerResult.ok && routerResult.content) {
      responseText = routerResult.content.trim();
      providerMode = "router";
    } else {
      warningMessage = "Đang dùng chế độ dự phòng vì Gemini chưa phản hồi.";
    }
  } else {
    warningMessage = "Đang dùng chế độ dự phòng vì kết nối AI chưa sẵn sàng.";
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

    const cleanFallback = fallbackAns.answer?.trim() || "Chào anh/chị, em chưa có dữ liệu cụ thể để trả lời câu hỏi này. Anh/chị vui lòng thử lại sau.";
    responseText = `Hiện em đang dùng chế độ dự phòng vì kết nối AI chưa sẵn sàng. Dựa trên dữ liệu phiên chạy hiện tại, em có thể đưa ra nhận định sơ bộ như sau:\n\n${cleanFallback}`;
  }

  // Sanitize any leftover mojibakes from text
  const cleanAnswer = cleanMojibake(responseText);

  // Return strictly whitelisted fields
  const responseObj = {
    answer: cleanAnswer,
    providerMode: providerMode,
    modelUsed: providerMode === "router" ? model : "fallback-rules",
    confidence: providerMode === "router" ? 0.95 : 0.85,
    sources: [
      { label: "Phiên chạy", value: run.id },
      { label: "Cửa hàng", value: store.name },
      { label: "Thời tiết", value: weather.isLive ? "Thực tế" : "Mô phỏng" },
      { label: "Vận hành", value: opsBaselineMode === "live" ? "Dữ liệu thực tế" : "Dữ liệu mô phỏng" },
    ],
    warning: providerMode === "fallback" ? warningMessage : undefined,
  };

  return new NextResponse(JSON.stringify(responseObj), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
