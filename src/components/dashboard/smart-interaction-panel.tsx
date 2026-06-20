"use client";

import * as React from "react";
import {
  Bot,
  Send,
  User,
  Headphones,
  Users,
  ShoppingBag,
  Loader2,
  AlertCircle,
  ShieldCheck,
  CornerDownRight,
  Sparkles,
  MessageSquare,
  BookOpen,
  BarChart3,
  HelpCircle,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { InteractionRole } from "@/lib/interactions/smartInteractionAgent";
import { useT, useLang } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
  sources?: { label: string; value: string }[];
  confidence?: number;
  needsApproval?: boolean;
  draftReply?: string;
  escalateToHuman?: boolean;
  mode?: string;
  timestamp: string;
}

/* ─── Suggestion category icons ─── */
function suggestionIcon(text: string) {
  if (/prep|batch|cook|fry/i.test(text)) return Package;
  if (/waste|risk|stock/i.test(text)) return AlertCircle;
  if (/store|compare|which/i.test(text)) return BarChart3;
  if (/rain|weather|continue/i.test(text)) return Zap;
  if (/priority|shift|packaging/i.test(text)) return HelpCircle;
  if (/order|late|delay|missing|refund/i.test(text)) return MessageSquare;
  return BookOpen;
}

/* ─── Import Package from lucide (used by suggestionIcon) ─── */
import { Package } from "lucide-react";
import { fetchJson } from "@/lib/client/fetchJson";

const ROLE_CONFIG: Record<InteractionRole, {
  labelEn: string;
  labelVi: string;
  shortLabelEn: string;
  shortLabelVi: string;
  icon: React.ElementType;
  color: string;
  activeBg: string;
  placeholderEn: string;
  placeholderVi: string;
  suggestionsEn: string[];
  suggestionsVi: string[];
  descriptionEn: string;
  descriptionVi: string;
}> = {
  manager: {
    labelEn: "Manager Chat",
    labelVi: "Hội thoại Quản lý",
    shortLabelEn: "Manager",
    shortLabelVi: "Quản lý",
    icon: Headphones,
    color: "text-[var(--brand)]",
    activeBg: "bg-[var(--brand)] text-white shadow-md shadow-[var(--brand)]/20",
    placeholderEn: "Type your question about prep, staffing, or risks...",
    placeholderVi: "Nhập câu hỏi về lượng chế biến, nhân sự hoặc rủi ro ca...",
    suggestionsEn: [],
    suggestionsVi: [],
    descriptionEn: "Strategic decisions & risk analysis",
    descriptionVi: "Quyết định chiến lược & Phân tích rủi ro",
  },
  staff: {
    labelEn: "Staff Assistant",
    labelVi: "Trợ lý Nhân viên",
    shortLabelEn: "Staff",
    shortLabelVi: "Nhân viên",
    icon: Users,
    color: "text-violet-600",
    activeBg: "bg-violet-600 text-white shadow-md shadow-violet-600/20",
    placeholderEn: "Type your question about shift tasks or prep priorities...",
    placeholderVi: "Nhập câu hỏi về nhiệm vụ ca hoặc thứ tự ưu tiên...",
    suggestionsEn: [],
    suggestionsVi: [],
    descriptionEn: "Operational guidance & tasks",
    descriptionVi: "Hướng dẫn vận hành & Nhiệm vụ",
  },
  customer: {
    labelEn: "Customer Support",
    labelVi: "Hỗ trợ khách hàng",
    shortLabelEn: "Customer",
    shortLabelVi: "Khách hàng",
    icon: ShoppingBag,
    color: "text-teal-600",
    activeBg: "bg-teal-600 text-white shadow-md shadow-teal-600/20",
    placeholderEn: "Type customer query draft...",
    placeholderVi: "Nhập phản hồi nháp cho khách hàng...",
    suggestionsEn: [],
    suggestionsVi: [],
    descriptionEn: "Draft replies & escalation",
    descriptionVi: "Soạn phản hồi & Chuyển tiếp ca",
  },
};

/* ─── Typing indicator ─── */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5">
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand)]" style={{ animationDelay: "0ms" }} />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand)]" style={{ animationDelay: "150ms" }} />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand)]" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

/* ─── Source attribution ─── */
function SourceAttribution({ sources }: { sources: { label: string; value: string }[] }) {
  const { lang } = useLang();
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-2 rounded-md border border-border/50 bg-background/50 p-1.5">
      <div className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ExternalLink className="h-2.5 w-2.5" />
        {lang === "vi" ? "Nguồn đối chiếu" : "Sources"}
      </div>
      <div className="flex flex-wrap gap-1">
        {sources.map((s, j) => (
          <Badge key={j} variant="secondary" className="gap-0.5 text-[9px]">
            <CornerDownRight className="h-2 w-2" />
            <span className="font-medium">{s.label}:</span> {s.value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/* ─── LLM Badge ─── */
function LLMBadge({ mode, confidence }: { mode?: string; confidence?: number }) {
  const { lang } = useLang();
  const isLive = mode === "live";
  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        className={cn(
          "gap-1 text-[9px] font-semibold",
          isLive ? "risk-bg-low risk-border-low risk-text-low" : "risk-bg-medium risk-border-medium risk-text-medium",
        )}
      >
        <Sparkles className="h-2.5 w-2.5" />
        {isLive 
          ? (lang === "vi" ? "Mô hình AI" : "Powered by LLM") 
          : (lang === "vi" ? "Chế độ dự phòng" : "Fallback Mode")}
      </Badge>
      {confidence != null && (
        <span className="text-[9px] text-muted-foreground">
          {(confidence * 100).toFixed(0)}% {lang === "vi" ? "độ tin cậy" : "confidence"}
        </span>
      )}
    </div>
  );
}

export interface SmartInteractionPanelProps {
  storeId: string | null;
  runId?: string;
  className?: string;
  isDemo?: boolean;
}

export function SmartInteractionPanel({ storeId, runId, className, isDemo }: SmartInteractionPanelProps) {
  const t = useT();
  const [role, setRole] = React.useState<InteractionRole>("manager");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const [activeModel, setActiveModel] = React.useState<string | null>(null);
  const [hasRouterConfig, setHasRouterConfig] = React.useState(false);
  const [lastResponseMode, setLastResponseMode] = React.useState<"router" | "fallback" | null>(null);
  const [lastResponseModel, setLastResponseModel] = React.useState<string | null>(null);

  const { lang } = useLang();

  React.useEffect(() => {
    // Check if Router API is configured on the server
    const checkConfig = async () => {
      try {
        const res = await fetch("/api/admin/model-provider/config");
        const data = await res.json();
        if (data.ok && data.config && data.config.baseUrl && data.config.model) {
          setActiveModel(data.config.model);
          setHasRouterConfig(true);
        }
      } catch {
        // ignore
      }
    };
    checkConfig();
  }, []);

  React.useEffect(() => {
    queueMicrotask(() => {
      setMessages([]);
    });
  }, [storeId, role]);


  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = React.useCallback(async (text: string) => {
    if (!text.trim() || !storeId || loading) return;
    const userMsg: ChatMessage = { role: "user", text, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const data = await fetchJson<{
        answer: string;
        sources?: { label: string; value: string }[];
        confidence?: number;
        needsApproval?: boolean;
        draftReply?: string;
        escalateToHuman?: boolean;
        mode?: string;
        providerMode?: "router" | "fallback";
        modelUsed?: string;
      }>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, runId, role, question: text, language: lang }),
      });

      if (data.providerMode) {
        setLastResponseMode(data.providerMode);
      }
      if (data.modelUsed) {
        setLastResponseModel(data.modelUsed);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: data.answer,
          sources: data.sources,
          confidence: data.confidence,
          needsApproval: data.needsApproval,
          draftReply: data.draftReply,
          escalateToHuman: data.escalateToHuman,
          mode: data.mode,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }, [storeId, role, loading, runId, lang]);

  const cfg = ROLE_CONFIG[role];
  const activeLabel = lang === "vi" ? cfg.labelVi : cfg.labelEn;
  const activeShortLabel = lang === "vi" ? cfg.shortLabelVi : cfg.shortLabelEn;
  const activePlaceholder = lang === "vi" ? cfg.placeholderVi : cfg.placeholderEn;
  const activeSuggestions = lang === "vi" ? cfg.suggestionsVi : cfg.suggestionsEn;
  const activeDescription = lang === "vi" ? cfg.descriptionVi : cfg.descriptionEn;

  const currentMode = lastResponseMode || (hasRouterConfig ? "router" : "fallback");
  const displayModel = lastResponseModel || activeModel;

  const isRouterActive = currentMode === "router";
  const modeLabel = lang === "vi"
    ? (isRouterActive ? "Chế độ trả lời: Router API" : "Chế độ trả lời: Quy tắc dự phòng")
    : (isRouterActive ? "Answer mode: Router API" : "Answer mode: Fallback Rules");

  return (
    <Card className={cn("card-interactive overflow-hidden flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-[#E4002B]" />
              {lang === "vi" ? "Hỏi Trợ lý CaMate" : "Ask Agent CaMate"}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeDescription} · {activeLabel}
            </p>
            {/* Status bar */}
            {runId && (
              <div className="mt-2 flex flex-wrap gap-1.5 items-center text-[10px]">
                {/* Mode indicator */}
                <Badge variant="outline" className={cn(
                  "text-[9px] font-bold px-1.5 h-4 flex items-center shrink-0",
                  isRouterActive 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}>
                  {modeLabel}
                </Badge>

                {/* Model name */}
                {isRouterActive && displayModel && (
                  <span className="text-neutral-400 font-semibold shrink-0">
                    {lang === "vi" ? "Mô hình" : "Model"}: {displayModel}
                  </span>
                )}

                {/* Fallback warning badge */}
                {!isRouterActive && (
                  <Badge variant="outline" className="text-[9px] font-bold bg-amber-50 text-amber-700 border-amber-200 gap-1 h-4 px-1.5 shrink-0">
                    {lang === "vi" ? "Mô phỏng bằng quy tắc" : "Rule Simulation"}
                  </Badge>
                )}

                {/* Demo warning badge */}
                {isDemo && (
                  <Badge variant="destructive" className="text-[9px] font-bold bg-red-100 text-red-700 border-red-200 h-4 px-1.5 shrink-0">
                    {lang === "vi" ? "Đang dùng dữ liệu demo/mô phỏng" : "Using simulated/demo data"}
                  </Badge>
                )}
              </div>
            )}
          </div>
          {runId && <LLMBadge mode={messages.length > 0 ? messages[messages.length - 1].mode : (isRouterActive ? "live" : "fallback")} />}
        </div>
        {/* ── Role selector — pill-style buttons with icons ── */}
        <div className="mt-3 flex gap-1.5">
          {(Object.keys(ROLE_CONFIG) as InteractionRole[]).map((r) => {
            const rc = ROLE_CONFIG[r];
            const Icon = rc.icon;
            const isActive = role === r;
            return (
              <button
                key={r}
                disabled={!runId}
                onClick={() => setRole(r)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all duration-200",
                  isActive
                    ? rc.activeBg
                    : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                  !runId && "opacity-50 cursor-not-allowed",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {lang === "vi" ? rc.shortLabelVi : rc.shortLabelEn}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <ScrollArea className="h-[360px] pr-3">
          <div ref={scrollRef} className="flex flex-col gap-3">
            {/* ── Empty state when no run has occurred ── */}
            {!runId ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center animate-fade-in">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="max-w-[280px]">
                  <p className="text-sm font-bold text-neutral-800">
                    {lang === "vi" ? "Chưa có dữ liệu để trả lời" : "No data to answer"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed font-semibold">
                    {lang === "vi"
                      ? "Chưa có dữ liệu để trả lời. Hãy chạy phân tích ca trước."
                      : "Please run the shift analysis first before asking the assistant."}
                  </p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-8 text-center animate-fade-in-up">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <cfg.icon className={cn("h-6 w-6", cfg.color)} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{activeLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lang === "vi"
                      ? "Đặt câu hỏi — Trợ lý sẽ trả lời dựa trên kế hoạch ca trực đang chạy và tài liệu SOP cửa hàng."
                      : "Ask a question — the assistant answers using the current shift plan and SOP documents."}
                  </p>
                </div>
              </div>
            ) : null}

            {/* ── Chat messages ── */}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2.5 animate-fade-in-up",
                  m.role === "user" ? "flex-row-reverse" : "",
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm",
                  m.role === "user"
                    ? "bg-[#E4002B] text-white"
                    : "bg-muted text-[#E4002B]",
                )}>
                  {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>

                {/* Message bubble */}
                <div className={cn(
                  "max-w-[80%] rounded-2xl p-3 text-sm",
                  m.role === "user"
                    ? "bg-[#E4002B] text-white rounded-tr-sm"
                    : "bg-muted rounded-tl-sm",
                )}>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>

                  {/* Agent extras */}
                  {m.role === "agent" && (
                    <div className="mt-2 space-y-2">
                      {/* Draft reply */}
                      {m.draftReply && (
                        <div className="rounded-lg border-l-2 border-amber-400 bg-amber-500/10 p-2">
                          <div className="flex items-center gap-1 text-xs font-semibold text-amber-700">
                            <ShieldCheck className="h-3 w-3" /> {lang === "vi" ? "Nháp câu trả lời (cần duyệt)" : "Draft reply (needs approval)"}
                          </div>
                          <p className="mt-1 text-[11px] text-foreground/80">{m.draftReply}</p>
                        </div>
                      )}

                      {/* Escalation notice */}
                      {m.escalateToHuman && (
                        <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-600">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>
                            {lang === "vi" 
                              ? "Chuyển tiếp đến nhân sự — không đủ dữ liệu để trả lời một cách tự tin."
                              : "Escalating to human — not enough data to answer confidently."}
                          </span>
                        </div>
                      )}

                      {/* Source attribution */}
                      <SourceAttribution sources={m.sources ?? []} />

                      {/* LLM badge + confidence */}
                      <div className="flex items-center justify-between">
                        <LLMBadge mode={m.mode} confidence={m.confidence} />
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(m.timestamp).toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* ── Typing indicator ── */}
            {loading && (
              <div className="flex gap-2.5 animate-fade-in-up">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Bot className="h-3.5 w-3.5 text-[#E4002B]" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted p-3">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Grounded runId label inside the panel if present */}
        {runId && (
          <div className="text-[10px] font-bold text-neutral-400 text-center pb-1">
            {lang === "vi" ? "Đang bám theo phiên chạy: " : "Grounded in run: "}
            <span className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-600">{runId}</span>
          </div>
        )}

        {/* ── Chat input area ── */}
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2 rounded-xl border bg-card p-1.5 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-[#E4002B]/30"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              lang === "vi"
                ? "Nhập câu hỏi của bạn tại đây..."
                : "Type your question here..."
            }
            disabled={loading || !storeId || !runId}
            className="border-0 shadow-none focus-visible:ring-0 text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={loading || !storeId || !runId || !input.trim()}
            className="shrink-0 rounded-lg h-8 w-8 bg-[#E4002B] hover:bg-[#B00020] text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
