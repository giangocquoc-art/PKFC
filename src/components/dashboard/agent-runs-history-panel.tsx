"use client";

import * as React from "react";
import {
  History,
  Clock,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Loader2,
  FileText,
  Trash2,
  Download,
  Filter,
  ArrowUpDown,
  Activity,
  Zap,
  ShieldAlert,
  Timer,
  Inbox,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/language-provider";
import { LiveBadge, formatTime, ConfidenceBadge, riskLevel, riskColorClass } from "./shared";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client/fetchJson";

interface RunSummary {
  id: string;
  storeId: string;
  storeName: string;
  triggeredAt: string;
  confidence: number;
  isLive: boolean;
  overallRisk?: number | null;
  totalDurationMs?: number | null;
  headline?: string | null;
}

interface FullRun {
  id: string;
  storeId: string;
  storeName: string;
  triggeredAt: string;
  confidence: number;
  isLive: boolean;
  trace: unknown[];
  plan: { overallRisk?: number; storeRiskSummary?: string; slots?: { slot: string; windowLabel: string; expectedWalkInDelta: number; expectedDeliveryDelta: number }[] };
  briefing: { headline: string; tldr: string[]; topActions: string[]; confidenceLabel: string };
}

type FilterKind = "all" | "live" | "fallback";
type SortKind = "latest" | "risk" | "confidence";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} giờ trước`;
    const days = Math.floor(hrs / 24);
    return `${days} ngày trước`;
  } catch {
    return "";
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/* ------------------------------------------------------------------ */
/*  Mini risk gauge (semicircle SVG)                                  */
/* ------------------------------------------------------------------ */

function MiniRiskGauge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(1, score));
  const level = riskLevel(pct);
  const colorVar =
    level === "critical"
      ? "var(--risk-critical)"
      : level === "high"
        ? "var(--risk-high)"
        : level === "medium"
          ? "var(--risk-medium)"
          : "var(--risk-low)";
  // Semicircle: 180 degrees, 100 px wide
  const r = 32;
  const cx = 40;
  const cy = 40;
  const circ = Math.PI * r; // half circle length
  const fill = circ * pct;
  return (
    <svg width="80" height="44" viewBox="0 0 80 44" className="shrink-0">
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="oklch(from var(--muted) l c h / 0.4)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={colorVar}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground text-[11px] font-bold tabular-nums">
        {(pct * 100).toFixed(0)}%
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats summary tile                                                 */
/* ------------------------------------------------------------------ */

function StatTile({
  label,
  value,
  icon: Icon,
  accent,
  delay,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  delay: number;
}) {
  return (
    <div
      className={cn(
        "metric-card flex items-center gap-2 p-2 animate-fade-in-up",
        `animate-delay-${delay}`,
      )}
    >
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", accent)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-bold tabular-nums leading-tight">{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini timeline (last 10 runs as dots)                              */
/* ------------------------------------------------------------------ */

function MiniTimeline({ runs }: { runs: RunSummary[] }) {
  const last = runs.slice(0, 10);
  if (last.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Recent</span>
      <div className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-thin">
        {last.map((r, i) => {
          const risk = r.overallRisk ?? 0;
          const level = riskLevel(risk);
          const bg =
            level === "critical"
              ? "bg-[var(--risk-critical)]"
              : level === "high"
                ? "bg-[var(--risk-high)]"
                : level === "medium"
                  ? "bg-[var(--risk-medium)]"
                  : "bg-[var(--risk-low)]";
          const isLive = r.isLive;
          return (
            <Tooltip key={r.id}>
              <TooltipTrigger asChild>
                <div className="group flex flex-col items-center gap-0.5">
                  <span
                    className={cn(
                      "inline-block rounded-full ring-1 ring-inset ring-foreground/10 transition-transform group-hover:scale-150",
                      bg,
                      i === 0 ? "h-3 w-3" : "h-2 w-2",
                    )}
                  />
                  {isLive && (
                    <span className="h-0.5 w-2 rounded-full bg-[var(--status-live)]" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="font-semibold">#{runs.length - i} · {r.storeName}</div>
                <div className="text-muted-foreground">{relativeTime(r.triggeredAt)}</div>
                <div className="text-muted-foreground">
                  Risk: {r.overallRisk != null ? `${(r.overallRisk * 100).toFixed(0)}%` : "—"} · Conf: {(r.confidence * 100).toFixed(0)}%
                </div>
                <div className="text-muted-foreground">
                  {isLive ? "Live data" : "Fallback data"}
                  {r.totalDurationMs ? ` · ${formatDuration(r.totalDurationMs)}` : ""}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Run entry row                                                      */
/* ------------------------------------------------------------------ */

function RunRow({
  run,
  index,
  total,
  onOpen,
}: {
  run: RunSummary;
  index: number;
  total: number;
  onOpen: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const risk = run.overallRisk ?? null;
  const riskPct = risk != null ? risk * 100 : null;
  const level = risk != null ? riskLevel(risk) : null;
  const riskColor = level ? riskColorClass(level) : "text-muted-foreground";
  const riskBg =
    level === "critical"
      ? "risk-bg-critical risk-border-critical"
      : level === "high"
        ? "risk-bg-high risk-border-high"
        : level === "medium"
          ? "risk-bg-medium risk-border-medium"
          : "risk-bg-low risk-border-low";

  return (
    <div className="rounded-lg border bg-card transition-colors hover:bg-accent/30 animate-fade-in-up">
      <div className="flex items-stretch gap-0">
        {/* Run number badge column */}
        <button
          onClick={() => onOpen(run.id)}
          className={cn(
            "flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-l-lg border-r text-white",
            index === 0 ? "brand-gradient" : "bg-muted text-muted-foreground",
          )}
          title={`Mở ca #${total - index}`}
        >
          <span className="text-[8px] font-bold uppercase opacity-70">
            {index === 0 ? "HIỆN TẠI" : "Lượt"}
          </span>
          <span className="text-sm font-bold tabular-nums">
            {index === 0 ? "•" : `#${total - index}`}
          </span>
        </button>

        {/* Main row content */}
        <button
          onClick={() => onOpen(run.id)}
          className="flex min-w-0 flex-1 items-center gap-2.5 p-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-semibold">{run.storeName}</span>
              <LiveBadge isLive={run.isLive} />
              {riskPct != null && (
                <Badge variant="outline" className={cn("h-4 px-1 text-[9px] font-bold tabular-nums", riskBg, riskColor)}>
                  <ShieldAlert className="h-2.5 w-2.5" />
                  {riskPct.toFixed(0)}%
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              <span className="tabular-nums">{formatTime(run.triggeredAt)}</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{relativeTime(run.triggeredAt)}</span>
              {run.totalDurationMs != null && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <Timer className="h-2.5 w-2.5" />
                  <span className="tabular-nums">{formatDuration(run.totalDurationMs)}</span>
                </>
              )}
            </div>
            {/* Confidence mini-bar */}
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Tin cậy</span>
              <div className="progress-bar-slim h-1 w-20">
                <div
                  className={cn(
                    "progress-bar-fill h-full rounded-full",
                    run.confidence >= 0.75
                      ? "bg-[var(--risk-low)]"
                      : run.confidence >= 0.5
                        ? "bg-[var(--risk-medium)]"
                        : "bg-[var(--risk-high)]",
                  )}
                  style={{ width: `${run.confidence * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-bold tabular-nums">{(run.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Mini risk gauge */}
          {risk != null ? (
            <MiniRiskGauge score={risk} />
          ) : (
            <div className="flex h-11 w-20 shrink-0 items-center justify-center rounded-md border border-dashed text-[9px] text-muted-foreground">
              không rủi ro
            </div>
          )}

          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>

        {/* Expand button */}
        {run.headline && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex shrink-0 items-center gap-1 border-l px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent/50"
            title={expanded ? "Thu gọn tóm tắt" : "Mở rộng tóm tắt"}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 rotate-90" />}
          </button>
        )}
      </div>

      {/* Expandable summary */}
      {expanded && run.headline && (
        <div className="border-t bg-muted/30 px-3 py-2">
          <div className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-2.5 w-2.5" />
            Tóm tắt lượt chạy
          </div>
          <p className="text-[11px] leading-snug">{run.headline}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter pill                                                        */
/* ------------------------------------------------------------------ */

function FilterPill({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "view-tab-pill flex items-center gap-1.5 px-2.5 py-1 text-[10px]",
        active && "view-tab-pill-active",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
      {count != null && (
        <span
          className={cn(
            "rounded-full px-1 text-[9px] tabular-nums",
            active ? "bg-white/20" : "bg-muted-foreground/15",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient text-white shadow-sm">
        <Inbox className="h-7 w-7" />
      </div>
      <div>
        <div className="text-sm font-bold">Chưa có lượt chạy nào</div>
        <p className="mt-0.5 max-w-xs text-[11px] text-muted-foreground">
          Hãy chạy phân tích ca cho cửa hàng này để ghi nhận lịch sử kiểm toán. Mỗi lượt chạy đều được lưu trữ đầy đủ dấu vết, kế hoạch và tóm tắt để xem lại.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onRefresh} className="gap-1.5 text-xs">
        <RefreshCw className="h-3.5 w-3.5" />
        Làm mới
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                        */
/* ------------------------------------------------------------------ */

export function AgentRunsHistoryPanel({ storeId }: { storeId: string | null }) {
  const t = useT();
  const [runs, setRuns] = React.useState<RunSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedRun, setSelectedRun] = React.useState<FullRun | null>(null);
  const [loadingRun, setLoadingRun] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterKind>("all");
  const [sort, setSort] = React.useState<SortKind>("latest");
  const [clearing, setClearing] = React.useState(false);

  const loadHistory = React.useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await fetchJson<{ runs: RunSummary[] }>(`/api/agent/history?storeId=${storeId}&limit=20`);
      setRuns(data.runs ?? []);
    } catch {
      toast.error("Failed to load run history");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  React.useEffect(() => {
    if (storeId) {
      queueMicrotask(() => {
        loadHistory();
      });
    }
  }, [storeId, loadHistory]);

  const loadRun = React.useCallback(async (id: string) => {
    setLoadingRun(true);
    setOpen(true);
    try {
      const data = await fetchJson<FullRun>("/api/agent/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setSelectedRun(data);
    } catch {
      toast.error("Failed to load run");
    } finally {
      setLoadingRun(false);
    }
  }, []);

  const clearHistory = React.useCallback(async () => {
    if (!storeId) return;
    setClearing(true);
    try {
      const data = await fetchJson<{ deleted?: number }>(`/api/agent/history?storeId=${storeId}`, { method: "DELETE" });
      setRuns([]);
      toast.success(`Cleared ${data.deleted ?? 0} run${(data.deleted ?? 0) === 1 ? "" : "s"}`);
    } catch {
      toast.error("Failed to clear history");
    } finally {
      setClearing(false);
    }
  }, [storeId]);

  // Apply filter + sort.
  const visibleRuns = React.useMemo(() => {
    let list = runs;
    if (filter === "live") list = runs.filter((r) => r.isLive);
    else if (filter === "fallback") list = runs.filter((r) => !r.isLive);
    const sorted = [...list];
    if (sort === "risk") {
      sorted.sort((a, b) => (b.overallRisk ?? 0) - (a.overallRisk ?? 0));
    } else if (sort === "confidence") {
      sorted.sort((a, b) => b.confidence - a.confidence);
    } else {
      // latest — triggeredAt desc (already from API, but enforce)
      sorted.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
    }
    return sorted;
  }, [runs, filter, sort]);

  // Stats summary.
  const stats = React.useMemo(() => {
    const total = runs.length;
    const liveCount = runs.filter((r) => r.isLive).length;
    const fallbackCount = total - liveCount;
    const avgConf = total > 0 ? runs.reduce((acc, r) => acc + r.confidence, 0) / total : 0;
    const durations = runs.map((r) => r.totalDurationMs).filter((d): d is number => typeof d === "number");
    const avgDur = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    return { total, liveCount, fallbackCount, avgConf, avgDur };
  }, [runs]);

  const exportCsv = React.useCallback(() => {
    if (visibleRuns.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const header = ["#", "id", "store", "triggeredAt", "isLive", "confidence", "overallRisk", "durationMs", "headline"];
    const rows = visibleRuns.map((r, i) => [
      String(visibleRuns.length - i),
      r.id,
      `"${(r.storeName || "").replace(/"/g, '""')}"`,
      r.triggeredAt,
      r.isLive ? "live" : "fallback",
      r.confidence.toFixed(4),
      r.overallRisk != null ? r.overallRisk.toFixed(4) : "",
      r.totalDurationMs != null ? String(r.totalDurationMs) : "",
      `"${(r.headline || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-runs-${storeId ?? "store"}-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${visibleRuns.length} run${visibleRuns.length === 1 ? "" : "s"} as CSV`);
  }, [visibleRuns, storeId]);

  const liveCount = runs.filter((r) => r.isLive).length;
  const fallbackCount = runs.length - liveCount;

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="overflow-hidden border-[var(--brand)]/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl brand-gradient text-white shadow-sm">
                <History className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  Lịch sử lượt chạy
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] tabular-nums">
                    {stats.total}
                  </Badge>
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Các lượt chạy cũ được lưu trong DB kiểm toán · xem lại bất kỳ dấu vết, kế hoạch hoặc tóm tắt nào
                  {runs[0]?.storeName ? (
                    <> · <span className="font-medium text-foreground">{runs[0].storeName}</span></>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportCsv}
                    disabled={runs.length === 0}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Xuất CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Tải danh sách hiện tại dưới dạng CSV
                </TooltipContent>
              </Tooltip>
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={runs.length === 0 || clearing}
                        className="h-7 gap-1.5 text-xs hover:border-[var(--risk-high)] hover:text-[var(--risk-high)]"
                      >
                        {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Xóa
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Xóa vĩnh viễn tất cả lượt chạy đã lưu của cửa hàng này
                  </TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear run history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes all {stats.total} persisted run{stats.total === 1 ? "" : "s"} for this store from the audit database. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={clearing}>Hủy</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={clearHistory}
                      disabled={clearing}
                      className="gap-1.5 bg-[var(--risk-high)] text-white hover:bg-[var(--risk-high)]/90"
                    >
                      {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Xóa tất cả
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" variant="ghost" onClick={loadHistory} disabled={loading} className="h-7 gap-1.5 text-xs">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Làm mới
              </Button>
            </div>
          </div>

          {/* Stats summary strip */}
          {runs.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <StatTile
                label="Tổng số"
                value={stats.total}
                icon={Activity}
                accent="bg-[var(--brand)]/15 text-[var(--brand)]"
                delay={100}
              />
              <StatTile
                label="Trực tiếp"
                value={stats.liveCount}
                icon={Zap}
                accent="bg-[var(--risk-low)]/15 text-[var(--risk-low)]"
                delay={200}
              />
              <StatTile
                label="Dự phòng"
                value={stats.fallbackCount}
                icon={ShieldAlert}
                accent="bg-[var(--risk-high)]/15 text-[var(--risk-high)]"
                delay={300}
              />
              <StatTile
                label="Độ tin cậy TB"
                value={`${(stats.avgConf * 100).toFixed(0)}%`}
                icon={TrendingUp}
                accent="bg-sky-500/15 text-sky-600 dark:text-sky-400"
                delay={400}
              />
              <StatTile
                label="Thời gian TB"
                value={stats.avgDur > 0 ? formatDuration(stats.avgDur) : "—"}
                icon={Timer}
                accent="bg-violet-500/15 text-violet-600 dark:text-violet-400"
                delay={500}
              />
            </div>
          )}

          {/* Mini timeline of recent runs */}
          {runs.length > 0 && (
            <div className="mt-2">
              <MiniTimeline runs={runs} />
            </div>
          )}

          {/* Filter + sort toolbar */}
          {runs.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Filter className="h-3 w-3" />
                Bộ lọc
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <FilterPill active={filter === "all"} onClick={() => setFilter("all")} icon={Activity} label="Tất cả" count={runs.length} />
                <FilterPill active={filter === "live"} onClick={() => setFilter("live")} icon={Zap} label="Trực tiếp" count={liveCount} />
                <FilterPill active={filter === "fallback"} onClick={() => setFilter("fallback")} icon={ShieldAlert} label="Dự phòng" count={fallbackCount} />
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <ArrowUpDown className="h-3 w-3" />
                Sắp xếp
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <FilterPill active={sort === "latest"} onClick={() => setSort("latest")} icon={Clock} label="Mới nhất" />
                <FilterPill active={sort === "risk"} onClick={() => setSort("risk")} icon={ShieldAlert} label="Rủi ro cao nhất" />
                <FilterPill active={sort === "confidence"} onClick={() => setSort("confidence")} icon={TrendingUp} label="Tin cậy cao nhất" />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[320px] pr-3">
            {loading && runs.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : runs.length === 0 ? (
              <EmptyState onRefresh={loadHistory} />
            ) : visibleRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <Filter className="h-6 w-6 opacity-50" />
                <span>Không có lượt chạy nào khớp với bộ lọc hiện tại.</span>
                <Button size="sm" variant="outline" onClick={() => setFilter("all")} className="h-7 gap-1.5 text-xs">
                  Hiển thị tất cả
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {visibleRuns.map((run, i) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    index={i}
                    total={visibleRuns.length}
                    onOpen={loadRun}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Run detail dialog (preserved from prior implementation) */}
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSelectedRun(null); }}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-[var(--brand)]" />
                  {loadingRun ? "Đang tải lượt chạy…" : selectedRun ? `Lượt chạy · ${selectedRun.storeName}` : "Lượt chạy"}
                </DialogTitle>
              </DialogHeader>
              {loadingRun ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : selectedRun ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <LiveBadge isLive={selectedRun.isLive} />
                    <ConfidenceBadge confidence={selectedRun.confidence} />
                    <span className="text-[11px] text-muted-foreground">{formatTime(selectedRun.triggeredAt)}</span>
                    <Badge variant="outline" className="text-[10px]">{(selectedRun.trace as unknown[]).length} bước</Badge>
                  </div>
                  <div className="rounded-lg brand-gradient p-3 text-white">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/80">Tiêu đề</div>
                    <p className="mt-0.5 text-sm font-semibold leading-snug">{selectedRun.briefing.headline}</p>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Tóm tắt nhanh</div>
                    <ul className="space-y-0.5">
                      {selectedRun.briefing.tldr.map((item, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-xs">
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--brand)]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Hành động hàng đầu</div>
                    <ol className="space-y-1">
                      {selectedRun.briefing.topActions.map((a, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[9px] font-bold text-white">{j + 1}</span>
                          <span className="pt-0.5">{a}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {selectedRun.plan.slots && (
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Kế hoạch theo ca</div>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedRun.plan.slots.map((s) => (
                          <div key={s.slot} className="rounded-md border bg-card p-2 text-[11px]">
                            <div className="font-semibold capitalize">{s.slot} · {s.windowLabel}</div>
                            <div className="text-muted-foreground">walk-in {s.expectedWalkInDelta}% · delivery {s.expectedDeliveryDelta}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="rounded-md bg-muted/40 p-2 text-[11px]">
                    <span className="font-semibold">Tóm tắt rủi ro: </span>
                    {selectedRun.plan.storeRiskSummary ?? "N/A"}
                  </div>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
