"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Lightbulb,
  Radio,
  Database,
  Clock,
  ShieldAlert,
  AlertOctagon,
  Info,
  Eye,
  Package,
  Flame,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ServerCog,
  Signal,
  CalendarClock,
  CircleDot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  RealTimeMetrics,
  AnomalyAlert,
  StrategicInsight,
  OperationEvent,
} from "@/lib/operations/realTimeEventSchema";
import { useT, useLang } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";

interface LiveOpsData {
  metrics: RealTimeMetrics;
  alerts: AnomalyAlert[];
  insights: StrategicInsight[];
  events: OperationEvent[];
  sources: { id: string; name: string; mode: string; eventCount: number }[];
}

const REFRESH_INTERVAL_S = 60;
const TZ = "Asia/Ho_Chi_Minh";

/* ─── Formatting helpers ─── */
function formatICT(
  iso: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      ...opts,
    });
  } catch {
    return iso;
  }
}

function formatICTFull(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: TZ,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function nowICT(now: number): string {
  try {
    return new Date(now).toLocaleTimeString("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

/* ─── Live clock hook (ticks every second) ─── */
function useLiveClock(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* ─── Countdown hook — resets when resetKey changes ─── */
function useCountdown(durationS: number, resetKey: string): number {
  const [remaining, setRemaining] = React.useState(durationS);
  React.useEffect(() => {
    queueMicrotask(() => {
      setRemaining(durationS);
    });
  }, [resetKey, durationS]);
  React.useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => (r <= 1 ? durationS : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [durationS]);
  return remaining;
}

/* ─── Deterministic sparkline path generator ─── */
function makeSparklinePath(seed: string, trend: number): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 0xffffffff;
  };
  const n = 14;
  const w = 44;
  const hgt = 18;
  const pts: string[] = [];
  let v = 0.5;
  const drift = Math.max(-0.05, Math.min(0.05, trend * 0.004));
  for (let i = 0; i < n; i++) {
    v += (rand() - 0.5) * 0.22 + drift;
    v = Math.max(0.08, Math.min(0.92, v));
    const x = (i / (n - 1)) * w;
    const y = hgt - v * hgt;
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

/* ─── Status type & colour maps ─── */
type MetricStatus = "normal" | "warning" | "critical";

const STATUS_DOT: Record<MetricStatus, string> = {
  normal: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
};
const STATUS_TEXT: Record<MetricStatus, string> = {
  normal: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-rose-600 dark:text-rose-400",
};
const STATUS_CARD: Record<MetricStatus, string> = {
  normal: "metric-card-risk-low",
  warning: "metric-card-risk-medium",
  critical: "metric-card-risk-critical",
};
const STATUS_LABEL: Record<MetricStatus, string> = {
  normal: "Normal",
  warning: "Warning",
  critical: "Critical",
};

/* ─── Mode config ─── */
function modeConfig(mode: string): {
  label: string;
  dot: string;
  badge: string;
  text: string;
} {
  switch (mode) {
    case "live":
      return {
        label: "LIVE",
        dot: "bg-emerald-500 animate-pulse-soft pulse-glow",
        badge: "risk-bg-low risk-border-low risk-text-low",
        text: "text-emerald-600 dark:text-emerald-400",
      };
    case "fallback":
      return {
        label: "FALLBACK",
        dot: "bg-amber-500",
        badge: "risk-bg-high risk-border-high risk-text-high",
        text: "text-amber-600 dark:text-amber-400",
      };
    default:
      return {
        label: "SYNTHETIC",
        dot: "bg-violet-500 animate-pulse-soft",
        badge: "bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300",
        text: "text-violet-600 dark:text-violet-400",
      };
  }
}

/* ─── Severity config for alerts ─── */
function severityConfig(sev: AnomalyAlert["severity"]): {
  container: string;
  icon: string;
  badge: string;
  iconEl: React.ReactNode;
} {
  switch (sev) {
    case "critical":
      return {
        container: "risk-gradient-critical risk-border-critical border-l-4",
        icon: "risk-text-critical",
        badge: "risk-bg-critical risk-border-critical risk-text-critical",
        iconEl: <AlertOctagon className="h-3.5 w-3.5 shrink-0" />,
      };
    case "warning":
      return {
        container: "risk-gradient-high risk-border-high border-l-4",
        icon: "risk-text-high",
        badge: "risk-bg-high risk-border-high risk-text-high",
        iconEl: <ShieldAlert className="h-3.5 w-3.5 shrink-0" />,
      };
    default:
      return {
        container: "bg-sky-500/10 border-sky-500/40 border-l-4",
        icon: "text-sky-600 dark:text-sky-400",
        badge: "bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300",
        iconEl: <Info className="h-3.5 w-3.5 shrink-0" />,
      };
  }
}

/* ─── Trend indicator with colour coding ─── */
function TrendIndicator({
  trend,
  goodWhenPositive = false,
}: {
  trend: number;
  goodWhenPositive?: boolean;
}) {
  if (Math.abs(trend) < 1) {
    return (
      <div className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
        ~0% vs baseline
      </div>
    );
  }
  const isPositive = trend > 0;
  // Good = direction matches goodWhenPositive flag
  const isGood = goodWhenPositive ? isPositive : !isPositive;
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 text-[10px] font-medium",
        isGood
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400",
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      {trend > 0 ? "+" : ""}
      {trend.toFixed(0)}% vs baseline
    </div>
  );
}

/* ─── Mini sparkline (SVG) ─── */
function Sparkline({
  path,
  status,
}: {
  path: string;
  status: MetricStatus;
}) {
  const stroke =
    status === "critical"
      ? "var(--risk-critical)"
      : status === "warning"
        ? "var(--risk-medium)"
        : "var(--risk-low)";
  const fill = `${stroke}33`;
  return (
    <svg
      width="44"
      height="18"
      viewBox="0 0 44 18"
      className="opacity-80"
      aria-hidden
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${path} L44,18 L0,18 Z`} fill={fill} stroke="none" />
    </svg>
  );
}

/* ─── Metric tile with tooltip, sparkline, status ─── */
interface MetricConfig {
  key: string;
  label: string;
  display: string;
  suffix: string;
  icon: React.ElementType;
  trend?: number;
  goodWhenPositive?: boolean;
  risk?: number;
  status: MetricStatus;
  tooltip: string;
  index: number;
}

function MetricTile({ cfg }: { cfg: MetricConfig }) {
  const {
    label,
    display,
    suffix,
    icon: Icon,
    trend,
    goodWhenPositive,
    risk,
    status,
    tooltip,
    index,
  } = cfg;
  const sparkPath = React.useMemo(
    () => makeSparklinePath(label, trend ?? risk ?? 0),
    [label, trend, risk],
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "metric-card animate-fade-in-up cursor-help p-3",
            STATUS_CARD[status],
          )}
          style={{
            animationDelay: `${index * 50}ms`,
            animationFillMode: "backwards",
          }}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <Icon className={cn("h-3 w-3", STATUS_TEXT[status])} />
              {label}
            </span>
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  STATUS_DOT[status],
                  status !== "normal" && "animate-pulse-soft",
                )}
                title={STATUS_LABEL[status]}
              />
            </span>
          </div>
          <div className="mt-1 flex items-end justify-between gap-1">
            <div className="flex items-baseline gap-0.5">
              <span
                className={cn(
                  "text-xl font-bold tabular-nums leading-none",
                  STATUS_TEXT[status],
                )}
              >
                {display}
              </span>
              {suffix && (
                <span className="text-[10px] text-muted-foreground">{suffix}</span>
              )}
            </div>
            <Sparkline path={sparkPath} status={status} />
          </div>
          {trend != null && (
            <div className="mt-1">
              <TrendIndicator trend={trend} goodWhenPositive={goodWhenPositive} />
            </div>
          )}
          {risk != null && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  status === "critical"
                    ? "bg-rose-500"
                    : status === "warning"
                      ? "bg-amber-500"
                      : "bg-emerald-500",
                )}
                style={{ width: `${Math.min(risk * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 font-semibold">
            <span>{label}</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                status === "critical"
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : status === "warning"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              )}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {tooltip}
          </p>
          <div className="flex items-center justify-between gap-2 border-t pt-1 text-[10px]">
            <span className="text-muted-foreground">Current</span>
            <span className="font-bold tabular-nums">
              {display}
              {suffix}
            </span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Alert row with severity visual hierarchy ─── */
function AlertRow({
  alert,
  index,
  acknowledged,
  onAck,
}: {
  alert: AnomalyAlert;
  index: number;
  acknowledged: boolean;
  onAck: (id: string) => void;
}) {
  const sev = severityConfig(alert.severity);
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 animate-fade-in-up transition-opacity",
        sev.container,
        acknowledged && "opacity-50",
      )}
      style={{
        animationDelay: `${index * 60}ms`,
        animationFillMode: "backwards",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex items-center gap-1.5 text-xs font-semibold", sev.icon)}>
          {sev.iconEl}
          {alert.title}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant="outline" className={cn("text-[9px] uppercase font-bold", sev.badge)}>
            {alert.severity}
          </Badge>
          <Badge variant="outline" className="text-[9px] capitalize">{alert.category}</Badge>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-foreground/80">{alert.message}</p>
      <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-background/50 px-2 py-1">
        <Eye className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] font-medium text-foreground/90">
          → {alert.recommendation}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {formatICT(alert.detectedAt)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            "h-5 gap-1 px-1.5 text-[10px] font-medium",
            acknowledged
              ? "text-muted-foreground"
              : "text-foreground/70 hover:text-foreground",
          )}
          onClick={() => onAck(alert.id)}
        >
          {acknowledged ? (
            <>
              <CheckCircle2 className="h-3 w-3" /> Acked
            </>
          ) : (
            <>
              <CircleDot className="h-3 w-3" /> Acknowledge
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ─── Insight card with confidence, impact, action ─── */
function InsightCard({ insight, index }: { insight: StrategicInsight; index: number }) {
  const horizonCls =
    insight.horizon === "today"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
      : "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40";
  const impactLevel =
    insight.confidence >= 0.7 ? "High" : insight.confidence >= 0.5 ? "Medium" : "Low";
  const impactCls =
    insight.confidence >= 0.7
      ? "risk-bg-critical risk-border-critical risk-text-critical"
      : insight.confidence >= 0.5
        ? "risk-bg-medium risk-border-medium risk-text-medium"
        : "risk-bg-low risk-border-low risk-text-low";
  const recommendedAction =
    insight.horizon === "today"
      ? "Apply before next service window"
      : "Schedule for weekly planning review";
  return (
    <div
      className="card-interactive metric-card metric-card-brand animate-fade-in-up p-3"
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: "backwards",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Lightbulb className="h-3 w-3 text-amber-500" />
          {insight.title}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline" className={cn("text-[9px] capitalize", horizonCls)}>
            {insight.horizon}
          </Badge>
          <Badge variant="outline" className={cn("text-[9px] font-bold", impactCls)}>
            {impactLevel} impact
          </Badge>
        </div>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">
        {insight.message}
      </p>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        <span className="font-medium">Evidence:</span> {insight.evidence}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="progress-bar-slim flex-1">
          <div
            className="progress-bar-fill animated"
            style={{
              width: `${insight.confidence * 100}%`,
              background:
                "linear-gradient(90deg, oklch(from var(--brand) l c h / 0.75), oklch(from var(--brand) l c h / 0.35))",
            }}
          />
        </div>
        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
          {(insight.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-md border-l-2 border-[var(--brand)] bg-[var(--brand)]/5 px-2 py-1">
        <ArrowRight className="h-3 w-3 shrink-0 text-[var(--brand)]" />
        <span className="text-[10px] font-medium text-foreground/90">
          {recommendedAction}
        </span>
      </div>
    </div>
  );
}

/* ─── Event type icon + tone ─── */
function eventTypeMeta(type: string): {
  icon: React.ElementType;
  tone: string;
} {
  const map: Record<string, { icon: React.ElementType; tone: string }> = {
    "pos-order": { icon: Package, tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
    "delivery-order": { icon: Flame, tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
    "inventory-level": { icon: Database, tone: "text-sky-600 dark:text-sky-400 bg-sky-500/10" },
    "batch-prep": { icon: Package, tone: "text-violet-600 dark:text-violet-400 bg-violet-500/10" },
    "waste-event": { icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
    "stockout-event": { icon: ShieldAlert, tone: "text-rose-600 dark:text-rose-400 bg-rose-500/10" },
    "staff-checkin": { icon: Activity, tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
    "staff-checkout": { icon: Activity, tone: "text-muted-foreground bg-muted/40" },
    "service-time": { icon: Clock, tone: "text-sky-600 dark:text-sky-400 bg-sky-500/10" },
    "complaint": { icon: AlertOctagon, tone: "text-rose-600 dark:text-rose-400 bg-rose-500/10" },
    "refund": { icon: AlertTriangle, tone: "text-rose-600 dark:text-rose-400 bg-rose-500/10" },
    "campaign-event": { icon: Sparkles, tone: "text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-500/10" },
  };
  return map[type] ?? { icon: Activity, tone: "text-muted-foreground bg-muted/40" };
}

/* ─── Event timeline item ─── */
function EventTimelineItem({
  event,
  isLast,
  index,
}: {
  event: OperationEvent;
  isLast: boolean;
  index: number;
}) {
  const meta = eventTypeMeta(event.type);
  const EvIcon = meta.icon;
  const mode = modeConfig(event.mode);
  const desc = Object.entries(event.payload)
    .slice(0, 2)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return (
    <div
      className="relative flex gap-2.5 pb-3 animate-fade-in-up"
      style={{
        animationDelay: `${Math.min(index * 25, 250)}ms`,
        animationFillMode: "backwards",
      }}
    >
      {/* timeline rail */}
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
            meta.tone,
          )}
        >
          <EvIcon className="h-3 w-3" />
        </span>
        {!isLast && (
          <span className="mt-0.5 w-px flex-1 bg-border" aria-hidden />
        )}
      </div>
      {/* content */}
      <div className="min-w-0 flex-1 rounded-md border bg-card p-1.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="font-mono text-muted-foreground">
            {formatICT(event.timestamp)}
          </span>
          <Badge variant="secondary" className="text-[9px] font-medium">
            {event.type}
          </Badge>
          {index === 0 && (
            <Badge
              variant="outline"
              className="text-[9px] font-bold risk-bg-low risk-border-low risk-text-low"
            >
              Latest
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              "ml-auto text-[9px] font-semibold gap-1",
              mode.badge,
            )}
          >
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", mode.dot)} />
            {mode.label}
          </Badge>
        </div>
        {desc && (
          <p className="mt-0.5 truncate text-[10px] text-foreground/80">{desc}</p>
        )}
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          source: <span className="font-mono">{event.source}</span>
          {event.confidence != null && (
            <> · confidence {(event.confidence * 100).toFixed(0)}%</>
          )}
        </p>
      </div>
    </div>
  );
}

/* ─── Live status bar ─── */
function LiveStatusBar({
  metrics,
  now,
  countdown,
  onRefresh,
}: {
  metrics: RealTimeMetrics;
  now: number;
  countdown: number;
  onRefresh?: () => void;
}) {
  const mc = modeConfig(metrics.mode);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full",
            mc.badge,
          )}
        >
          <Signal className="h-4 w-4" />
        </span>
        <div className="flex flex-col leading-tight">
          <span className={cn("text-xs font-bold", mc.text)}>{mc.label}</span>
          <span className="text-[10px] text-muted-foreground">Connection</span>
        </div>
      </div>

      <span className="hidden h-8 w-px bg-border sm:block" />

      {/* Last updated — large & prominent */}
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatICTFull(metrics.computedAt)}
          </span>
          <span className="text-[10px] text-muted-foreground">Last updated (ICT)</span>
        </div>
      </div>

      <span className="hidden h-8 w-px bg-border sm:block" />

      {/* Live clock */}
      <div className="flex items-center gap-2">
        <span className={cn("inline-block h-2 w-2 rounded-full", mc.dot)} />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tabular-nums text-foreground">
            {nowICT(now)}
          </span>
          <span className="text-[10px] text-muted-foreground">Live clock</span>
        </div>
      </div>

      <span className="hidden h-8 w-px bg-border sm:block" />

      {/* Next refresh countdown */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tabular-nums text-foreground">
            {countdown}s
          </span>
          <span className="text-[10px] text-muted-foreground">Next refresh</span>
        </div>
      </div>

      {/* Manual refresh */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onRefresh?.()}
        className="ml-auto gap-1.5"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </Button>
    </div>
  );
}

/* ─── Data sources strip ─── */
function DataSourcesStrip({
  sources,
}: {
  sources: LiveOpsData["sources"];
}) {
  const { lang } = useLang();
  return (
    <div className="rounded-lg border bg-muted/20 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <ServerCog className="h-3 w-3" />
        {lang === "vi" ? "Nguồn dữ liệu đang dùng" : "Active Data Sources"} ({sources.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => {
          const mc = modeConfig(s.mode);
          const modeLabel = s.mode.charAt(0).toUpperCase() + s.mode.slice(1);
          return (
            <Badge
              key={s.id}
              variant="outline"
              className={cn("gap-1.5 px-2 py-1 text-[10px] font-medium", mc.badge)}
            >
              <span className={cn("inline-block h-1.5 w-1.5 rounded-full", mc.dot)} />
              <Database className="h-2.5 w-2.5" />
              {s.name}
              <span className="text-foreground/40">·</span>
              <span className="tabular-nums">{s.eventCount}</span>
              <span className="text-foreground/40">·</span>
              <span className="font-semibold">{modeLabel}</span>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyState() {
  return (
    <Card className="card-interactive overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl shadow-md">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">Live Operations Monitor</CardTitle>
            <p className="text-xs text-muted-foreground">
              Real-time metrics · Anomaly detection · Strategic insights
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)]/20 opacity-75" />
            <span className="brand-gradient relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg">
              <Radio className="h-7 w-7 animate-pulse text-white" />
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Waiting for live operations stream</p>
            <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
              The Risk Intelligence Agent is spinning up synthetic POS, inventory,
              staffing &amp; delivery adapters. Real-time metrics, anomaly alerts and
              a strategic insight feed will appear here shortly.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-[var(--brand)]" />
            Pilot-ready · swappable for live KFC POS connectors
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Build the 10-metric config array ─── */
function buildMetricConfigs(m: RealTimeMetrics): MetricConfig[] {
  const cfgs: Omit<MetricConfig, "index">[] = [
    {
      key: "walkInTrend",
      label: "Walk-in trend",
      display: m.walkInTrend.toFixed(0),
      suffix: "%",
      icon: TrendingUp,
      trend: m.walkInTrend,
      goodWhenPositive: true,
      status:
        m.walkInTrend > 40 ? "warning"
        : m.walkInTrend < -25 ? "critical"
        : "normal",
      tooltip:
        "Walk-in traffic vs baseline hour. Surges strain prep capacity; deep drops signal weather or event disruption.",
    },
    {
      key: "deliverySurge",
      label: "Delivery surge",
      display: m.deliverySurge.toFixed(0),
      suffix: "%",
      icon: Flame,
      trend: m.deliverySurge,
      goodWhenPositive: true,
      status:
        m.deliverySurge > 50 ? "warning"
        : m.deliverySurge < -30 ? "critical"
        : "normal",
      tooltip:
        "Delivery order volume vs baseline. Surges boost revenue but strain riders; drops may indicate weather disruption.",
    },
    {
      key: "prepUtilization",
      label: "Prep utilization",
      display: (m.prepUtilization * 100).toFixed(0),
      suffix: "%",
      icon: Package,
      risk: m.prepUtilization,
      status:
        m.prepUtilization > 0.85 ? "critical"
        : m.prepUtilization > 0.7 ? "warning"
        : "normal",
      tooltip:
        "Kitchen prep capacity in use. Above 85% risks service delays; below 40% suggests overstaffing or low demand.",
    },
    {
      key: "wasteTrend",
      label: "Waste trend",
      display: m.wasteTrend.toFixed(0),
      suffix: "%",
      icon: AlertTriangle,
      trend: m.wasteTrend,
      goodWhenPositive: false,
      status:
        m.wasteTrend > 20 ? "critical"
        : m.wasteTrend > 5 ? "warning"
        : "normal",
      tooltip:
        "Food waste vs baseline. Rising waste signals over-prep or slowing demand — reduce batch sizes.",
    },
    {
      key: "stockoutProbability",
      label: "Stockout (2h)",
      display: (m.stockoutProbability * 100).toFixed(0),
      suffix: "%",
      icon: ShieldAlert,
      risk: m.stockoutProbability,
      status:
        m.stockoutProbability > 0.5 ? "critical"
        : m.stockoutProbability > 0.25 ? "warning"
        : "normal",
      tooltip:
        "Probability of a stockout in the next 2 hours. Above 50% requires immediate prep & inventory action.",
    },
    {
      key: "staffingFit",
      label: "Staffing fit",
      display: (m.staffingFit * 100).toFixed(0),
      suffix: "%",
      icon: Activity,
      risk: 1 - m.staffingFit,
      status:
        m.staffingFit < 0.5 ? "critical"
        : m.staffingFit < 0.75 ? "warning"
        : "normal",
      tooltip:
        "Staff headcount vs forecast demand. Below 50% means severe under-staffing; aim for ≥80%.",
    },
    {
      key: "serviceDelayRisk",
      label: "Service delay",
      display: (m.serviceDelayRisk * 100).toFixed(0),
      suffix: "%",
      icon: Clock,
      risk: m.serviceDelayRisk,
      status:
        m.serviceDelayRisk > 0.6 ? "critical"
        : m.serviceDelayRisk > 0.35 ? "warning"
        : "normal",
      tooltip:
        "Risk that service time exceeds SLA in the next window. Driven by prep load, staffing & order mix.",
    },
    {
      key: "marginRisk",
      label: "Margin risk",
      display: (m.marginRisk * 100).toFixed(0),
      suffix: "%",
      icon: TrendingDown,
      risk: m.marginRisk,
      status:
        m.marginRisk > 0.6 ? "critical"
        : m.marginRisk > 0.35 ? "warning"
        : "normal",
      tooltip:
        "Risk to gross margin this window from waste, discounts & delivery fees. High values need campaign adjustment.",
    },
    {
      key: "complaintRisk",
      label: "Complaint risk",
      display: (m.complaintRisk * 100).toFixed(0),
      suffix: "%",
      icon: AlertOctagon,
      risk: m.complaintRisk,
      status:
        m.complaintRisk > 0.5 ? "critical"
        : m.complaintRisk > 0.25 ? "warning"
        : "normal",
      tooltip:
        "Probability of customer complaints in the next window. Correlated with service delay & stockouts.",
    },
    {
      key: "campaignEffectiveness",
      label: "Campaign ROI",
      display: (m.campaignEffectiveness * 100).toFixed(0),
      suffix: "%",
      icon: Sparkles,
      risk: 1 - m.campaignEffectiveness,
      status:
        m.campaignEffectiveness < 0.4 ? "critical"
        : m.campaignEffectiveness < 0.65 ? "warning"
        : "normal",
      tooltip:
        "Active campaign effectiveness vs target. Below 40% — pause and re-target; above 75% — scale up.",
    },
  ];
  return cfgs.map((c, i) => ({ ...c, index: i }));
}

/* ─── Severity filter chips ─── */
type SeverityFilter = "all" | "critical" | "warning" | "info";
const SEVERITY_FILTERS: { key: SeverityFilter; label: string; cls: string }[] = [
  { key: "all", label: "All", cls: "bg-foreground/10 text-foreground" },
  { key: "critical", label: "Critical", cls: "risk-bg-critical risk-border-critical risk-text-critical" },
  { key: "warning", label: "Warning", cls: "risk-bg-high risk-border-high risk-text-high" },
  { key: "info", label: "Info", cls: "bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300" },
];

/* ─── Main component ─── */
export interface LiveOperationsMonitorProps {
  data: LiveOpsData | null;
  onRefresh?: () => void;
}

export function LiveOperationsMonitor({
  data,
  onRefresh,
}: LiveOperationsMonitorProps) {
  const t = useT();
  void t;

  const now = useLiveClock();
  const [acknowledged, setAcknowledged] = React.useState<Set<string>>(new Set());
  const [sevFilter, setSevFilter] = React.useState<SeverityFilter>("all");
  const [eventFilter, setEventFilter] = React.useState<string>("all");
  const timelineRef = React.useRef<HTMLDivElement>(null);

  // Reset acknowledged set when data storeId or window changes
  const resetKey = data ? `${data.metrics.storeId}-${data.metrics.computedAt}` : "none";
  const countdown = useCountdown(REFRESH_INTERVAL_S, resetKey);

  React.useEffect(() => {
    queueMicrotask(() => {
      setAcknowledged(new Set());
    });
  }, [data?.metrics.storeId]);

  // Auto-scroll timeline to latest (top) when events change
  React.useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = 0;
    }
  }, [data?.events.length, data?.metrics.computedAt]);

  if (!data) {
    return <EmptyState />;
  }

  const { metrics, alerts, insights, events, sources } = data;
  const metricConfigs = buildMetricConfigs(metrics);

  const filteredAlerts =
    sevFilter === "all"
      ? alerts
      : alerts.filter((a) => a.severity === sevFilter);
  const alertCounts = {
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };

  const eventTypes = Array.from(new Set(events.map((e) => e.type)));
  const filteredEvents =
    eventFilter === "all"
      ? events
      : events.filter((e) => e.type === eventFilter);
  // newest first
  const sortedEvents = [...filteredEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const visibleEvents = sortedEvents.slice(0, 30);

  const mc = modeConfig(metrics.mode);

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="card-interactive overflow-hidden">
        {/* ── Enhanced header ── */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  Live Operations Monitor
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Real-time metrics · Anomaly detection · Strategic insights
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn("gap-1.5 text-[10px] font-bold", mc.badge)}
                  >
                    <span className={cn("inline-block h-1.5 w-1.5 rounded-full", mc.dot)} />
                    {mc.label}
                  </Badge>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    Updated {formatICT(metrics.computedAt)}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    ·
                    <RefreshCw className="h-2.5 w-2.5" />
                    Next refresh in {countdown}s
                  </span>
                </div>
              </div>
            </div>
            <div className="hidden flex-col items-end gap-1 sm:flex">
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Database className="h-2.5 w-2.5" />
                {metrics.eventCount} events
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                Window {formatICT(metrics.windowStart)} → {formatICT(metrics.windowEnd)}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Live status bar ── */}
          <LiveStatusBar
            metrics={metrics}
            now={now}
            countdown={countdown}
            onRefresh={onRefresh}
          />

          {/* ── Metrics grid ── */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3 w-3 text-[var(--brand)]" />
                Real-Time Metrics
              </div>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> Normal
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" /> Warning
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" /> Critical
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {metricConfigs.map((cfg) => (
                <MetricTile key={cfg.key} cfg={cfg} />
              ))}
            </div>
          </div>

          <Separator />

          {/* ── Anomaly alerts ── */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <Zap className="h-3 w-3 text-amber-500" />
                Anomaly Alerts ({alerts.length})
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {SEVERITY_FILTERS.map((f) => {
                  const count = alertCounts[f.key];
                  const active = sevFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setSevFilter(f.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all",
                        active
                          ? cn(f.cls, "ring-1 ring-offset-1 ring-offset-background")
                          : "bg-transparent border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {f.label}
                      <span className="tabular-nums opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {filteredAlerts.length ? (
              <ScrollArea className="max-h-72 pr-1 scrollbar-thin">
                <div className="space-y-2">
                  {filteredAlerts.map((a, i) => (
                    <AlertRow
                      key={a.id}
                      alert={a}
                      index={i}
                      acknowledged={acknowledged.has(a.id)}
                      onAck={(id) =>
                        setAcknowledged((prev) => {
                          const next = new Set(prev);
                          next.add(id);
                          return next;
                        })
                      }
                    />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="metric-card metric-card-risk-low flex items-center gap-2 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-[11px] text-muted-foreground">
                  {alerts.length === 0
                    ? "No anomalies detected in the current window."
                    : "No alerts match the selected filter."}
                </span>
              </div>
            )}
          </div>

          {/* ── Strategic insights ── */}
          {insights.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <Lightbulb className="h-3 w-3 text-amber-500" />
                  Strategic Insights ({insights.length})
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {insights.map((ins, i) => (
                    <InsightCard key={ins.id} insight={ins} index={i} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Events timeline ── */}
          <Separator />
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <Database className="h-3 w-3" />
                Event Timeline ({events.length})
              </div>
              {eventTypes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEventFilter("all")}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all",
                      eventFilter === "all"
                        ? "bg-foreground/10 text-foreground border-foreground/20"
                        : "bg-transparent border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    All
                  </button>
                  {eventTypes.slice(0, 6).map((et) => {
                    const active = eventFilter === et;
                    return (
                      <button
                        key={et}
                        type="button"
                        onClick={() => setEventFilter(active ? "all" : et)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all",
                          active
                            ? "bg-foreground/10 text-foreground border-foreground/20"
                            : "bg-transparent border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {et}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {visibleEvents.length ? (
              <div
                ref={timelineRef}
                className="max-h-[260px] overflow-y-auto pr-1 scrollbar-thin"
              >
                {visibleEvents.map((e, i) => (
                  <EventTimelineItem
                    key={e.eventId}
                    event={e}
                    isLast={i === visibleEvents.length - 1}
                    index={i}
                  />
                ))}
              </div>
            ) : (
              <div className="metric-card metric-card-brand flex items-center gap-2 py-3">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  No events in the current window.
                </span>
              </div>
            )}
          </div>

          {/* ── Data sources strip ── */}
          <Separator />
          <DataSourcesStrip sources={sources} />

          {/* ── Footer note ── */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-2.5 text-[10px] text-muted-foreground">
            <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-[var(--brand)]" />
            <span>
              <strong className="text-foreground">Provenance:</strong> every metric
              carries a mode flag (LIVE / SYNTHETIC / FALLBACK). In production these
              streams come from KFC POS, inventory &amp; workforce systems — here they
              are pilot-ready synthetic adapters, swappable for live connectors.
            </span>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
