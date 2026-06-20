"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Terminal,
  ShieldAlert,
  Code,
  KeyRound,
  FileCode,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
  Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function OutputApiPage() {
  const [lang, setLang] = React.useState<"vi" | "en">("vi");

  // Since P_KFC_API_KEY cannot be directly read on client side easily (unless exposed via public env),
  // we check via fetch or show configuration status dynamically.
  const [isConfigured, setIsConfigured] = React.useState<boolean>(false);
  const [authMode, setAuthMode] = React.useState<string>("checking");

  React.useEffect(() => {
    // Simple fetch to profile endpoint to see if key is required
    // (if it returns 401 with no key, then a key is configured).
    fetch("/api/p-kfc/v1/profile")
      .then((res) => {
        if (res.status === 200) {
          setAuthMode("local-demo");
          setIsConfigured(false);
        } else if (res.status === 401) {
          setAuthMode("api-key");
          setIsConfigured(true);
        }
      })
      .catch(() => {
        setAuthMode("unknown");
      });
  }, []);

  const t = {
    vi: {
      back: "← Quay lại Bàn điều khiển",
      title: "Cổng Output API P-KFC",
      subtitle: "Tài liệu kỹ thuật và mẫu thử nghiệm tích hợp cho bên thứ ba",
      introTitle: "P-KFC API là gì?",
      introDesc: "P-KFC API là API demo độc lập cho Agent CaMate, cho phép ứng dụng bên ngoài hỏi agent bằng HTTP API. Đây không phải sản phẩm chính thức của KFC.",
      authTitle: "Trạng thái Mã bảo mật (API Key)",
      authStatus: "Cấu hình hiện tại:",
      authConfigured: "Đã bật Xác thực API Key thực tế (Cấu hình trên server)",
      authDemo: "Chế độ Demo Local (Chấp nhận mọi API Key ngoài Production)",
      keyMask: "Mã API Key mô phỏng:",
      disclaimerTitle: "LƯU Ý QUAN TRỌNG",
      disclaimerDesc: "P-KFC API là API demo độc lập cho Agent CaMate. Đây không phải sản phẩm chính thức của KFC.",
      endpointsTitle: "Danh sách Điểm cuối (Endpoints)",
      authReq: "Xác thực:",
      authBearer: "Bearer token hoặc x-p-kfc-api-key",
      authNone: "Không yêu cầu",
      purpose: "Mục đích:",
      sampleTitle: "Mẫu Request Curl & Phản hồi",
    },
    en: {
      back: "← Back to Console",
      title: "P-KFC Output API Gateway",
      subtitle: "Technical documentation and test integrations for third-party clients",
      introTitle: "What is P-KFC API?",
      introDesc: "P-KFC API is an independent demo API for Agent CaMate. It lets external apps ask the agent through HTTP APIs. It is not an official KFC product.",
      authTitle: "API Key Authentication Status",
      authStatus: "Current configuration:",
      authConfigured: "Active API Key Authentication (Configured via Server Env)",
      authDemo: "Local Demo Mode (Any key accepted outside Production)",
      keyMask: "Masked API Key:",
      disclaimerTitle: "IMPORTANT NOTICE",
      disclaimerDesc: "P-KFC API is an independent demo API for Agent CaMate. It is not an official KFC product.",
      endpointsTitle: "Available Endpoints",
      authReq: "Auth:",
      authBearer: "Bearer token or x-p-kfc-api-key",
      authNone: "None",
      purpose: "Purpose:",
      sampleTitle: "Sample Curl & Payload",
    }
  }[lang];

  const endpoints = [
    {
      method: "GET",
      path: "/api/p-kfc/v1/profile",
      purposeVi: "Lấy thông tin giới thiệu và các tính năng hỗ trợ của Agent.",
      purposeEn: "Retrieve agent profile capabilities and metadata description.",
      auth: true,
      body: null,
      response: {
        ok: true,
        name: "P-KFC API",
        agent: "Agent CaMate",
        version: "v1",
        capabilities: ["storeops_plan", "ask_this_plan", "manager_briefing", "approval_review", "evidence_trace"],
        disclaimer: "Independent hackathon demo. Not an official KFC product."
      }
    },
    {
      method: "POST",
      path: "/api/p-kfc/v1/runs",
      purposeVi: "Tạo kế hoạch vận hành cho cửa hàng (Chạy pipeline của agent). Trả về runId.",
      purposeEn: "Trigger the StoreOps agent pipeline for a store, generating a run plan.",
      auth: true,
      body: { storeId: "store_001", language: "vi" },
      response: {
        ok: true,
        runId: "clxbz...",
        storeName: "KFC Nguyễn Thị Minh Khai",
        summary: "Kế hoạch đề xuất ca trưa ngày mưa...",
        actions: [{ type: "prep", recommendation: "Chuẩn bị thêm 15% gà rán" }],
        approvalRequests: [],
        evidence: ["Weather Signal Agent: Temp 29C, Rain 80%"],
        dataSourceMode: { weather: "live", operations: "demo" }
      }
    },
    {
      method: "POST",
      path: "/api/p-kfc/v1/chat",
      purposeVi: "Gửi câu hỏi hội thoại được liên kết và grounded theo runId.",
      purposeEn: "Ask the agent a question grounded in the context of a specific runId.",
      auth: true,
      body: { runId: "clxbz...", message: "Tôi nên chuẩn bị bao nhiêu phần ca trưa?", language: "vi" },
      response: {
        ok: true,
        question: "Tôi nên chuẩn bị bao nhiêu phần ca trưa?",
        answer: "Dựa trên rủi ro mưa lớn vào lúc 11:30...",
        groundedInRun: true,
        runId: "clxbz...",
        modelUsed: "gpt-5.5",
        evidenceUsed: ["Weather Signal Agent: Rain 80%"],
        dataSourceMode: { weather: "live", operations: "demo" }
      }
    },
    {
      method: "GET",
      path: "/api/p-kfc/v1/runs/{runId}",
      purposeVi: "Tải thông tin chi tiết của một phiên chạy cũ (plan, briefing, trace) từ database.",
      purposeEn: "Retrieve full historical run details (plan, briefing, trace) by runId.",
      auth: true,
      body: null,
      response: {
        ok: true,
        runId: "clxbz...",
        storeName: "KFC Nguyễn Thị Minh Khai",
        confidence: 0.95,
        briefing: {},
        plan: {},
        evidenceSummary: []
      }
    },
    {
      method: "POST",
      path: "/api/p-kfc/v1/briefings/export",
      purposeVi: "Xuất báo cáo tóm tắt ca trực dưới dạng text/markdown kèm disclaimer.",
      purposeEn: "Export the full manager shift briefing in markdown format.",
      auth: true,
      body: { runId: "clxbz..." },
      response: {
        ok: true,
        markdown: "# Manager Briefing — KFC Nguyễn Thị Minh Khai...",
        filename: "briefing-kfc-minh-khai-2026-06-20.md",
        disclaimer: "Independent hackathon demo. Not an official KFC product."
      }
    },
    {
      method: "POST",
      path: "/api/p-kfc/v1/chat/completions",
      purposeVi: "Điểm cuối tương thích chuẩn OpenAI Chat Completions để tích hợp SDK bên thứ ba.",
      purposeEn: "OpenAI-compatible chat completion gateway grounded in targeted store context.",
      auth: true,
      body: {
        messages: [{ role: "user", content: "Chuẩn bị nhân sự thế nào nếu trời mưa?" }],
        model: "p-kfc-agent",
        metadata: { runId: "clxbz...", language: "vi" }
      },
      response: {
        id: "chatcmpl-v9x1b...",
        object: "chat.completion",
        created: 178201202,
        model: "p-kfc-agent",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Đề xuất tăng cường 1 nhân sự đóng gói..." },
            finish_reason: "stop"
          }
        ],
        metadata: {
          runId: "clxbz...",
          dataSourceMode: { weather: "live" },
          approvalRequired: true
        }
      }
    },
    {
      method: "GET",
      path: "/api/p-kfc/v1/openapi.json",
      purposeVi: "Tải file OpenAPI 3.1.0 schema mô tả toàn bộ cấu trúc API.",
      purposeEn: "Download raw OpenAPI 3.1.0 JSON schema for API client generators.",
      auth: false,
      body: null,
      response: { openapi: "3.1.0", info: { title: "P-KFC API" } }
    }
  ];

  return (
    <div className="min-h-screen bg-[#FFF5F6] text-neutral-900 p-6 md:p-8 font-sans">
      {/* Top Navigation Header */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#F1D5D9] pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-6 w-12 items-center justify-center rounded bg-[#E4002B] text-white font-black text-[10px] tracking-wide">P-KFC</span>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Developer Portal</span>
          </div>
          <h1 className="text-3xl font-black text-neutral-900 flex items-center gap-2">
            {t.title}
          </h1>
          <p className="text-sm text-neutral-500 font-medium mt-1">{t.subtitle}</p>
        </div>
        <div className="flex gap-2.5 shrink-0 self-start md:self-auto">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 px-4 h-10 text-sm font-bold text-neutral-700 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t.back}
          </Link>
          <Button
            onClick={() => setLang((l) => (l === "en" ? "vi" : "en"))}
            className="bg-[#E4002B] hover:bg-[#B00020] text-white font-extrabold text-xs px-4 h-10 shadow-sm"
          >
            {lang === "en" ? "Tiếng Việt" : "English"}
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Intro and Auth info */}
        <div className="space-y-6 lg:col-span-1">
          {/* Card: Intro */}
          <Card className="border-[#F1D5D9] bg-white shadow-sm overflow-hidden">
            <div className="h-2 bg-[#E4002B]" />
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Globe className="h-5 w-5 text-[#E4002B]" />
                {t.introTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600 leading-relaxed font-medium">
                {t.introDesc}
              </p>
            </CardContent>
          </Card>

          {/* Card: Auth Status */}
          <Card className="border-[#F1D5D9] bg-white shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#E4002B]" />
                {t.authTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs text-neutral-400 font-bold block uppercase">{t.authStatus}</span>
                <div className="flex items-center gap-2 mt-1.5">
                  {authMode === "api-key" ? (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-1 text-[10px] py-1 px-2.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      Active Key Auth
                    </Badge>
                  ) : authMode === "local-demo" ? (
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold gap-1 text-[10px] py-1 px-2.5 rounded-full">
                      <AlertCircle className="h-3 w-3" />
                      Local Demo Mode
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-neutral-500 text-[10px] py-1 px-2.5 rounded-full">Checking status...</Badge>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-2 font-medium">
                  {authMode === "api-key" ? t.authConfigured : t.authDemo}
                </p>
              </div>

              <Separator />

              <div className="p-3.5 rounded-xl border border-neutral-100 bg-[#FFF5F6] flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Lock className="h-4 w-4 text-[#E4002B]" />
                  <div className="leading-none">
                    <span className="text-[9px] font-bold text-neutral-400 block uppercase tracking-wider">{t.keyMask}</span>
                    <code className="text-xs font-mono font-bold text-neutral-800">pkfc_live_7a3d9...9fbc</code>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-neutral-200 text-neutral-500 bg-white font-medium">Masked</Badge>
              </div>

              <div className="rounded-lg bg-neutral-50 border p-3 font-mono text-[10px] text-neutral-600 space-y-1">
                <div className="font-bold text-neutral-800">Authorization Headers:</div>
                <div>1. Authorization: Bearer pkfc_live_...</div>
                <div>2. x-p-kfc-api-key: pkfc_live_...</div>
              </div>
            </CardContent>
          </Card>

          {/* OpenAPI JSON Card */}
          <Card className="border-[#F1D5D9] bg-white shadow-sm">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-sky-500" />
                  <span className="text-sm font-bold">OpenAPI Specification</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs font-bold gap-1" asChild>
                  <a href="/api/p-kfc/v1/openapi.json" target="_blank">
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
              <p className="text-xs text-neutral-500 font-medium">
                {lang === "vi" 
                  ? "Tải schema OpenAPI 3.1.0 dạng JSON để tự động tạo SDK client."
                  : "Download raw OpenAPI 3.1.0 JSON schema to generate API client SDKs."}
              </p>
            </CardContent>
          </Card>

          {/* Disclaimer Banner */}
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <strong className="text-xs text-amber-800 block mb-0.5">{t.disclaimerTitle}</strong>
              <p className="text-[11px] text-neutral-500 font-medium">
                {t.disclaimerDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column - Endpoints list */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-black text-neutral-900 border-b pb-2 mb-4">
            {t.endpointsTitle}
          </h2>

          <div className="space-y-4">
            {endpoints.map((ep, idx) => (
              <Card key={idx} className="border-[#F1D5D9] bg-white shadow-sm overflow-hidden">
                <CardHeader className="p-4 bg-neutral-50/50 flex flex-row items-center justify-between gap-4 border-b">
                  <div className="flex items-center gap-2 font-mono">
                    <Badge className={
                      ep.method === "GET" 
                        ? "bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-[10px]" 
                        : "bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px]"
                    }>
                      {ep.method}
                    </Badge>
                    <span className="font-extrabold text-neutral-800 text-sm">{ep.path}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-semibold text-neutral-500 border-neutral-200">
                    {t.authReq} {ep.auth ? "API Key" : t.authNone}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="text-xs text-neutral-600 font-medium leading-relaxed">
                    <strong>{t.purpose} </strong>
                    {lang === "vi" ? ep.purposeVi : ep.purposeEn}
                  </div>

                  {/* Sample Payload */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-neutral-400 font-extrabold block uppercase tracking-wider">
                      {t.sampleTitle}
                    </span>
                    <div className="rounded-lg bg-neutral-950 p-3.5 font-mono text-xs text-neutral-300 overflow-x-auto space-y-3">
                      <div>
                        <div className="text-neutral-500 text-[10px] mb-1 font-bold"># HTTP REQUEST</div>
                        <span className="text-pink-400">{ep.method}</span> <span className="text-sky-400">{ep.path}</span>
                      </div>
                      
                      {ep.body && (
                        <div>
                          <div className="text-neutral-500 text-[10px] mb-1 font-bold"># BODY PAYLOAD</div>
                          <pre className="text-emerald-400 whitespace-pre-wrap">{JSON.stringify(ep.body, null, 2)}</pre>
                        </div>
                      )}
                      
                      <div>
                        <div className="text-neutral-500 text-[10px] mb-1 font-bold"># JSON RESPONSE</div>
                        <pre className="text-amber-300 whitespace-pre-wrap">{JSON.stringify(ep.response, null, 2)}</pre>
                      </div>
                    </div>
                  </div>

                  {/* Sample curl command */}
                  {ep.auth && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-neutral-400 font-extrabold block uppercase tracking-wider">
                        Sample Curl Code
                      </span>
                      <div className="rounded-lg border bg-neutral-50 p-3 font-mono text-[10px] text-neutral-600 select-all whitespace-pre-wrap relative pr-10">
                        <Terminal className="absolute right-3 top-3 h-4 w-4 text-neutral-400" />
                        {ep.method === "POST" 
                          ? `curl -X POST http://localhost:3000${ep.path} \\\n  -H "Authorization: Bearer pkfc_live_7a3d9b8c2f1e0d4c6b5a9fbc" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(ep.body || {})}'`
                          : `curl -X GET http://localhost:3000${ep.path.replace("{runId}", "clxbz12345")} \\\n  -H "x-p-kfc-api-key: pkfc_live_7a3d9b8c2f1e0d4c6b5a9fbc"`
                        }
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
