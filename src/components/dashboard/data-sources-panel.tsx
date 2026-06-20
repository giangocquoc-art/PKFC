"use client";

import * as React from "react";
import {
  Database,
  MapPin,
  CloudSun,
  CloudRain,
  History,
  Plane,
  ShoppingCart,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Circle,
  Clock,
  ArrowRight,
  Activity,
  Gauge,
  Zap,
  Server,
  Cpu,
  ShieldCheck,
  Boxes,
  ChevronDown,
  ChevronRight,
  Radio,
  HardDrive,
  Timer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DATA_SOURCE_REGISTRY,
  sourceModeSummary,
  type DataSourceEntry,
  type DataSourceMode,
} from "@/lib/dataSources/dataSourceRegistry";
import { useT } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";

// ─── Mode styles ──────────────────────────────────────────────────────
const MODE_STYLES: Record<
  DataSourceMode,
  { badge: string; dot: string; label: string; reliability: number }
> = {
  live: {
    badge: "risk-bg-low risk-border-low risk-text-low",
    dot: "bg-[var(--risk-low)] animate-pulse",
    label: "LIVE",
    reliability: 1.0,
  },
  "verified-seed": {
    badge: "bg-sky-500/15 text-sky-700 border-sky-500/40 dark:text-sky-300",
    dot: "bg-sky-500",
    label: "SEED",
    reliability: 0.95,
  },
  simulated: {
    badge: "risk-bg-medium risk-border-medium risk-text-medium",
    dot: "bg-[var(--risk-medium)]",
    label: "SIM",
    reliability: 0.7,
  },
  fallback: {
    badge: "risk-bg-high risk-border-high risk-text-high",
    dot: "bg-[var(--risk-high)]",
    label: "FALLBACK",
    reliability: 0.5,
  },
  planned: {
    badge: "bg-slate-500/15 text-slate-600 border-slate-500/40 dark:text-slate-300",
    dot: "bg-slate-400",
    label: "PLANNED",
    reliability: 0.3,
  },
  unavailable: {
    badge: "bg-rose-500/15 text-rose-700 border-rose-500/40 dark:text-rose-300",
    dot: "bg-rose-500",
    label: "N/A",
    reliability: 0.0,
  },
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  "store-directory": Database,
  geocoding: MapPin,
  "weather-current": CloudSun,
  "weather-forecast": CloudSun,
  "weather-historical": History,
  "rain-evidence": CloudRain,
  aviation: Plane,
  "operations-pos": ShoppingCart,
  "operations-inventory": ShoppingCart,
  "operations-staffing": ShoppingCart,
  llm: Cpu,
};

// ─── Data points provided per source type ─────────────────────────────
const TYPE_DATA_POINTS: Record<string, string[]> = {
  "store-directory": ["store list", "addresses", "districts"],
  geocoding: ["lat/lng"],
  "weather-current": ["temperature", "feels-like", "humidity", "pressure", "wind", "precip", "cloud"],
  "weather-forecast": ["hourly forecast", "daily forecast"],
  "weather-historical": ["historical normals", "station obs"],
  "rain-evidence": ["precip rate", "rain intensity"],
  aviation: ["wind", "pressure", "cloud", "METAR"],
  "operations-pos": ["POS demand"],
  "operations-inventory": ["inventory levels"],
  "operations-staffing": ["staff rosters"],
  llm: ["narratives", "structured JSON"],
};

function ModeBadge({ mode }: { mode: DataSourceMode }) {
  const style = MODE_STYLES[mode];
  return (
    <Badge variant="outline" className={cn("border gap-1.5 font-semibold", style.badge)}>
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", style.dot)} />
      {style.label}
    </Badge>
  );
}

// ─── Freshness helpers ────────────────────────────────────────────────
function freshnessFromIso(iso: string | null | undefined): {
  label: string;
  level: "fresh" | "stale" | "very-stale" | "unknown";
} {
  if (!iso) return { label: "—", level: "unknown" };
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return { label: "—", level: "unknown" };
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return { label: "Vừa xong", level: "fresh" };
  if (min < 5) return { label: `${min} phút trước`, level: "fresh" };
  if (min < 15) return { label: `${min} phút trước`, level: "stale" };
  if (min < 60) return { label: `${min} phút trước`, level: "very-stale" };
  const hr = Math.floor(min / 60);
  return { label: `${hr} giờ trước`, level: "very-stale" };
}

const FRESHNESS_STYLE: Record<string, string> = {
  fresh: "risk-bg-low risk-border-low risk-text-low",
  stale: "risk-bg-medium risk-border-medium risk-text-medium",
  "very-stale": "risk-bg-high risk-border-high risk-text-high",
  unknown: "bg-muted text-muted-foreground border-border",
};

// ─── Reliability meter ────────────────────────────────────────────────
function computeReliability(entries: DataSourceEntry[]): {
  pct: number;
  live: number;
  fallback: number;
  planned: number;
  total: number;
  level: "low" | "medium" | "high" | "critical";
} {
  const total = entries.length || 1;
  let weighted = 0;
  let live = 0;
  let fallback = 0;
  let planned = 0;
  entries.forEach((e) => {
    weighted += MODE_STYLES[e.mode].reliability;
    if (e.mode === "live") live++;
    else if (e.mode === "fallback") fallback++;
    else if (e.mode === "planned") planned++;
  });
  const pct = Math.round((weighted / total) * 100);
  const level = pct >= 75 ? "low" : pct >= 55 ? "medium" : pct >= 35 ? "high" : "critical";
  return { pct, live, fallback, planned, total, level: level as "low" | "medium" | "high" | "critical" };
}

function ReliabilityMeter({ entries }: { entries: DataSourceEntry[] }) {
  const r = computeReliability(entries);
  const mounted = useMounted(150);
  const barClass =
    r.level === "low"
      ? "risk-bar-low"
      : r.level === "medium"
        ? "risk-bar-medium"
        : r.level === "high"
          ? "risk-bar-high"
          : "risk-bar-critical";
  const statusLabel =
    r.fallback === 0 && r.live > 0
      ? "Tất cả trực tiếp"
      : r.fallback > 0 && r.live === 0
        ? "Tất cả dự phòng"
        : r.fallback > 0
          ? "Hỗn hợp"
          : "Ổn định";
  const statusColor =
    r.level === "low"
      ? "risk-text-low"
      : r.level === "medium"
        ? "risk-text-medium"
        : "risk-text-high";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <Gauge className="h-3.5 w-3.5 text-[var(--brand)]" />
          Độ tin cậy dữ liệu
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-bold tabular-nums", statusColor)}>{r.pct}%</span>
          <Badge variant="outline" className={cn("border gap-1 text-[10px] font-semibold", statusColor)}>
            {statusLabel}
          </Badge>
        </div>
      </div>
      <div className="mt-2 progress-bar">
        <div
          className={cn("h-full rounded-full", barClass)}
          style={{
            width: mounted ? `${r.pct}%` : "0%",
            transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        <Badge variant="outline" className="gap-1 text-[10px] risk-bg-low risk-border-low risk-text-low">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk-low)] animate-pulse" />
          {r.live} trực tiếp
        </Badge>
        {r.fallback > 0 && (
          <Badge variant="outline" className="gap-1 text-[10px] risk-bg-high risk-border-high risk-text-high">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk-high)]" />
            {r.fallback} dự phòng
          </Badge>
        )}
        {r.planned > 0 && (
          <Badge variant="outline" className="gap-1 text-[10px] bg-slate-500/15 text-slate-600 border-slate-500/40 dark:text-slate-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
            {r.planned} kế hoạch
          </Badge>
        )}
        <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
          {r.total} tổng cộng
        </Badge>
      </div>
    </div>
  );
}

function useMounted(delay = 0): boolean {
  const [m, setM] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setM(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return m;
}

// ─── Live "now" tick for cache countdown ──────────────────────────────
function useNowTick(intervalMs = 1000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ─── Provenance chain ─────────────────────────────────────────────────
function ProvenanceChain({
  liveMode,
  className,
}: {
  liveMode: boolean;
  className?: string;
}) {
  const steps = [
    { label: "Nguồn", icon: Radio, sub: liveMode ? "Open-Meteo" : "Dự phòng" },
    { label: "Bộ thích ứng", icon: Server, sub: "WeatherAdapter" },
    { label: "Lớp tín hiệu", icon: Activity, sub: "Tính rủi ro" },
    { label: "Định lượng", icon: Gauge, sub: "Trọng số blend" },
    { label: "Tác nhân AI", icon: Cpu, sub: "Hệ thống 8 tác nhân" },
  ];
  const accent = liveMode ? "risk-text-low" : "risk-text-high";
  const borderAccent = liveMode
    ? "border-[var(--risk-low)]/40 bg-[var(--risk-low)]/5"
    : "border-[var(--risk-high)]/40 bg-[var(--risk-high)]/5";
  return (
    <div className={cn("rounded-lg border bg-card p-3", className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand)]" />
        Chuỗi dấu vết kiểm chứng
        <Badge variant="outline" className={cn("ml-auto border gap-1 text-[10px]", borderAccent, accent)}>
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full", liveMode ? "bg-[var(--risk-low)] animate-pulse" : "bg-[var(--risk-high)]")} />
          {liveMode ? "Trực tiếp" : "Dự phòng"}
        </Badge>
      </div>
      <div className="mt-2.5 flex items-stretch gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <div
              className={cn(
                "flex min-w-[88px] shrink-0 flex-col items-center gap-1 rounded-md border bg-muted/30 p-2 text-center",
                borderAccent,
              )}
            >
              <s.icon className={cn("h-4 w-4", accent)} />
              <div className="text-[10px] font-bold uppercase tracking-wide leading-tight">{s.label}</div>
              <div className="text-[9px] text-muted-foreground leading-tight">{s.sub}</div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center justify-center">
                <ArrowRight className={cn("h-3.5 w-3.5 shrink-0", accent)} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Cache info ───────────────────────────────────────────────────────
function CacheInfo({
  fetchedAt,
  ttlSec = 300,
  live,
}: {
  fetchedAt?: string | null;
  ttlSec?: number;
  live: boolean;
}) {
  const now = useNowTick(1000);
  const ts = fetchedAt ? new Date(fetchedAt).getTime() : 0;
  const elapsedSec = ts ? Math.max(0, Math.floor((now - ts) / 1000)) : 0;
  const remainingSec = Math.max(0, ttlSec - elapsedSec);
  const expired = remainingSec <= 0;
  const isHit = live && !expired;
  const totalEntries = DATA_SOURCE_REGISTRY.filter((e) => (e.cacheTtlSec ?? 0) > 0).length;
  const cacheSizeKb = Math.round(totalEntries * 1.4); // synthetic size estimate
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <HardDrive className="h-3.5 w-3.5 text-[var(--brand)]" />
          Trạng thái cache
        </div>
        <Badge
          variant="outline"
          className={cn(
            "border gap-1 text-[10px] font-semibold",
            isHit
              ? "risk-bg-low risk-border-low risk-text-low"
              : expired
                ? "risk-bg-high risk-border-high risk-text-high"
                : "risk-bg-medium risk-border-medium risk-text-medium",
          )}
        >
          {isHit ? (
            <>
              <CheckCircle2 className="h-2.5 w-2.5" /> HIT
            </>
          ) : expired ? (
            <>
              <AlertTriangle className="h-2.5 w-2.5" /> MISS
            </>
          ) : (
            <>
              <Timer className="h-2.5 w-2.5" /> WARM
            </>
          )}
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">TTL</div>
          <div className="text-sm font-bold tabular-nums">{ttlSec}s</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hết hạn sau</div>
          <div
            className={cn(
              "text-sm font-bold tabular-nums",
              expired ? "risk-text-high" : remainingSec < 60 ? "risk-text-medium" : "risk-text-low",
            )}
          >
            {expired ? "hết hạn" : `${remainingSec}s`}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dung lượng</div>
          <div className="text-sm font-bold tabular-nums">{cacheSizeKb} KB</div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Boxes className="h-3 w-3" />
        <span>
          {totalEntries} nguồn lưu đệm ·{" "}
          <span className="font-medium text-foreground">GeoCache</span> +{" "}
          <span className="font-medium text-foreground">WeatherSnapshot</span> bảng
        </span>
      </div>
    </div>
  );
}

// ─── Active-store weather provenance strip ────────────────────────────
function ActiveStoreProvenance({
  provenance,
  fetchedAt,
}: {
  provenance: NonNullable<NonNullable<React.ComponentProps<typeof DataSourcesPanel>["weatherProvenance"]>>;
  fetchedAt?: string | null;
}) {
  const freshness = freshnessFromIso(fetchedAt);
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Zap className="h-3.5 w-3.5 text-[var(--brand)]" />
          Dấu vết thời tiết cửa hàng đang chọn
        </div>
        <div className="flex items-center gap-1.5">
          {fetchedAt && (
            <Badge variant="outline" className={cn("border gap-1 text-[10px]", FRESHNESS_STYLE[freshness.level])}>
              <Clock className="h-2.5 w-2.5" />
              {freshness.label}
            </Badge>
          )}
          {fetchedAt && (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {new Date(fetchedAt).toLocaleString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" })}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {provenance.contributors.map((c) => {
          const contributed = c.contributed;
          return (
            <TooltipProvider key={c.sourceId} delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1 text-[10px]",
                      contributed
                        ? c.mode === "live"
                          ? "risk-bg-low risk-border-low risk-text-low"
                          : "risk-bg-high risk-border-high risk-text-high"
                        : "bg-slate-500/10 text-slate-500 border-slate-500/30",
                    )}
                  >
                    {contributed ? (
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    ) : (
                      <Circle className="h-2.5 w-2.5" />
                    )}
                    {c.sourceName}
                    <span className="opacity-70">· {c.mode}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px]">
                  <p className="text-xs">{c.note ?? `${c.sourceName}: ${c.mode}`}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}

// ─── Source card (collapsible, click to expand) ───────────────────────
function SourceCard({ entry, isActive }: { entry: DataSourceEntry; isActive: boolean }) {
  const [open, setOpen] = React.useState(false);
  const Icon = TYPE_ICONS[entry.type] ?? Database;
  const dataPoints = TYPE_DATA_POINTS[entry.type] ?? [];
  const reliability = MODE_STYLES[entry.mode].reliability;
  const freshnessLabel = entry.mode === "live" ? "Vừa xong" : entry.mode === "verified-seed" ? "Chọn lọc" : entry.mode === "planned" ? "Kế hoạch" : entry.mode === "fallback" ? "Theo yêu cầu" : "Mô phỏng";
  const freshnessLevel =
    entry.mode === "live"
      ? "fresh"
      : entry.mode === "verified-seed"
        ? "fresh"
        : entry.mode === "planned"
          ? "very-stale"
          : "stale";
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "card-interactive rounded-lg border bg-card p-3 transition-colors",
          isActive && "border-[var(--brand)]/50 bg-[var(--brand)]/5",
        )}
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        {/* Top row: icon + name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                isActive ? "brand-gradient text-white" : "bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold truncate">{entry.name}</span>
                {entry.url && (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-foreground"
                    title={entry.url}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {isActive && (
                  <Badge variant="outline" className="gap-1 text-[9px] border-[var(--brand)]/40 bg-[var(--brand)]/10 text-[var(--brand)] font-semibold">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
                    HOẠT ĐỘNG
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-1">{entry.purpose}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <ModeBadge mode={entry.mode} />
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                open && "rotate-90",
              )}
            />
          </div>
        </div>

        {/* Quick stats row */}
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Độ tin cậy</div>
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-xs font-bold tabular-nums",
                  reliability >= 0.9
                    ? "risk-text-low"
                    : reliability >= 0.6
                      ? "risk-text-medium"
                      : reliability >= 0.3
                        ? "risk-text-high"
                        : "risk-text-critical",
                )}
              >
                {Math.round(reliability * 100)}%
              </span>
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Tần suất cập nhật</div>
            <Badge variant="outline" className={cn("border gap-1 text-[10px] px-1.5 py-0 h-5", FRESHNESS_STYLE[freshnessLevel])}>
              {freshnessLabel}
            </Badge>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Cache TTL</div>
            <div className="text-xs font-bold tabular-nums">
              {entry.cacheTtlSec === undefined ? "—" : entry.cacheTtlSec === 0 ? "∞" : `${entry.cacheTtlSec}s`}
            </div>
          </div>
        </div>

        {/* Data points provided */}
        {dataPoints.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Cung cấp:</span>
            {dataPoints.map((dp) => (
              <Badge key={dp} variant="outline" className="text-[9px] gap-1 px-1.5 py-0 h-4 font-medium text-muted-foreground">
                {dp}
              </Badge>
            ))}
          </div>
        )}

        {/* Used-in row */}
        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Activity className="h-3 w-3 text-[var(--brand)]" />
          <span className="font-semibold">Sử dụng trong:</span>
          <span className="text-foreground">{entry.usedIn}</span>
        </div>

        {/* Collapsible details */}
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-fade-in-up">
          <div className="mt-2.5 space-y-1.5 border-t pt-2.5">
            {entry.rateLimit && (
              <div className="text-[11px]">
                <span className="font-semibold text-muted-foreground">Giới hạn tần suất: </span>
                <span className="text-foreground">{entry.rateLimit}</span>
              </div>
            )}
            {entry.license && (
              <div className="text-[11px]">
                <span className="font-semibold text-muted-foreground">Bản quyền: </span>
                <span className="text-foreground">{entry.license}</span>
              </div>
            )}
            {entry.requiresApiKey && (
              <div className="text-[11px]">
                <span className="font-semibold text-muted-foreground">API key: </span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">bắt buộc</span>
              </div>
            )}
            <div className="rounded-md bg-muted/50 p-2">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <ChevronDown className="h-2.5 w-2.5" />
                Chiến lược dự phòng
              </div>
              <p className="mt-0.5 text-[11px] leading-snug">{entry.fallbackStrategy}</p>
            </div>
            <div className="flex items-start gap-1.5 rounded-md border-l-2 border-slate-300 bg-slate-500/5 p-2">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ghi chú độ tin cậy</div>
                <p className="mt-0.5 text-[11px] leading-snug">{entry.reliabilityNote}</p>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export interface DataSourcesPanelProps {
  /** Optional live weather provenance to show freshness for the active store. */
  weatherProvenance?: {
    primarySource: string;
    primaryMode: "live" | "fallback";
    contributors: { sourceId: string; sourceName: string; mode: string; contributed: boolean; note?: string }[];
  } | null;
  weatherFetchedAt?: string | null;
  className?: string;
}

export function DataSourcesPanel({ weatherProvenance, weatherFetchedAt, className }: DataSourcesPanelProps) {
  const t = useT();
  const summary = sourceModeSummary();
  const liveMode = weatherProvenance?.primaryMode === "live";
  const activeSourceId = weatherProvenance?.primarySource?.toLowerCase().includes("open-meteo")
    ? "open-meteo"
    : weatherProvenance?.primarySource?.toLowerCase().includes("camate") || weatherProvenance?.primarySource?.toLowerCase().includes("llm")
      ? "camate-llm"
      : null;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg brand-gradient text-white shadow-sm">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base leading-tight">Nguồn dữ liệu & Dấu vết kiểm chứng</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t.dataSourcesSub}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className={cn("inline-block h-1.5 w-1.5 rounded-full", liveMode ? "bg-[var(--risk-low)] animate-pulse" : "bg-[var(--risk-high)]")} />
                <span className="tabular-nums">
                  {weatherFetchedAt
                    ? `Cập nhật cuối lúc ${new Date(weatherFetchedAt).toLocaleString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" })}`
                    : "Đang chờ truy xuất đầu tiên"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Badge variant="outline" className="gap-1 text-[10px]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk-low)] animate-pulse" />
              {summary.live} trực tiếp
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
              {summary.verifiedSeed} đã xác thực
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk-medium)]" />
              {summary.simulated} mô phỏng
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
              {summary.planned} kế hoạch
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Active-store freshness strip */}
        {weatherProvenance && (
          <ActiveStoreProvenance provenance={weatherProvenance} fetchedAt={weatherFetchedAt} />
        )}

        {/* Provenance chain + reliability + cache */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <ProvenanceChain liveMode={liveMode} className="lg:col-span-2" />
          <ReliabilityMeter entries={DATA_SOURCE_REGISTRY} />
        </div>
        <CacheInfo fetchedAt={weatherFetchedAt} ttlSec={300} live={liveMode} />

        {/* Sources list */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Database className="h-3.5 w-3.5 text-[var(--brand)]" />
              {t.dataSources}
            </div>
            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
              nhấn để mở rộng
            </Badge>
          </div>
          <ScrollArea className="h-[480px] pr-3">
            <div className="flex flex-col gap-2">
              {DATA_SOURCE_REGISTRY.map((entry) => (
                <SourceCard
                  key={entry.id}
                  entry={entry}
                  isActive={activeSourceId === entry.id}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
