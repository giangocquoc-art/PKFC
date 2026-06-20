"use client";

import * as React from "react";
import {
  ArrowLeftRight,
  Star,
  Trophy,
  Trash2,
  GitCompare,
  Download,
  CloudRain,
  Cloud,
  Sun,
  CloudSun,
  Cloudy,
  ListChecks,
  Plus,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Flag,
  Zap,
  FileText,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentRunResult, WeatherSignal } from "@/lib/types";
import { SEED_STORES } from "@/lib/stores/seed-stores";
import {
  ConfidenceBadge,
  LiveBadge,
  riskLevel,
  storeTypeIcon,
  storeTypeLabel,
} from "./shared";
import { cn } from "@/lib/utils";

// Per-store-type header band palette (no indigo/blue).
const STORE_TYPE_HEADER: Record<string, string> = {
  "urban-street": "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  mall: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
  residential: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  suburban: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30",
  "office-area": "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

// Priority palette for action items (1 = most urgent).
const ACTION_PRIORITY_CLS = [
  "bg-rose-500/20 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/40",
  "bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40",
  "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40",
  "bg-sky-500/20 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/40",
];

function lookupStore(storeId: string) {
  return SEED_STORES.find((s) => s.id === storeId);
}

/* ─── Cell urgency status ─── */
type CellStatus = "good" | "warning" | "critical";

const CELL_BG: Record<CellStatus, string> = {
  good: "bg-emerald-500/10",
  warning: "bg-amber-500/10",
  critical: "bg-rose-500/10",
};
const CELL_TEXT: Record<CellStatus, string> = {
  good: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  critical: "text-rose-700 dark:text-rose-300",
};
const CELL_BAR: Record<CellStatus, string> = {
  good: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
};
const CELL_DOT: Record<CellStatus, string> = {
  good: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
};
const CELL_EMOJI: Record<CellStatus, string> = {
  good: "🟢",
  warning: "🟡",
  critical: "🔴",
};

// ─── Risk gauge ────────────────────────────────────────────────────────
function RiskGauge({ score, size = 56 }: { score: number; size?: number }) {
  const level = riskLevel(score);
  const pct = Math.min(100, Math.max(0, score * 100));
  const stroke = 5;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const colorVar =
    level === "low"
      ? "var(--risk-low)"
      : level === "medium"
        ? "var(--risk-medium)"
        : level === "high"
          ? "var(--risk-high)"
          : "var(--risk-critical)";
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="oklch(from var(--muted) l c h / 0.4)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colorVar}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-base font-bold tabular-nums leading-none", `risk-text-${level}`)}>
          {pct.toFixed(0)}
        </span>
        <span className="text-[8px] uppercase tracking-wider text-muted-foreground">risk</span>
      </div>
    </div>
  );
}

// ─── Risk trend arrow (status-derived) ─────────────────────────────────
function RiskTrendArrow({ score }: { score: number }) {
  const level = riskLevel(score);
  if (level === "critical" || level === "high") {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
        <TrendingUp className="h-3 w-3" /> Elevated
      </span>
    );
  }
  if (level === "medium") {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
        <Minus className="h-3 w-3" /> Watch
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
      <TrendingDown className="h-3 w-3" /> Contained
    </span>
  );
}

// ─── Weather mini-tile ─────────────────────────────────────────────────
function WeatherMini({ weather }: { weather: WeatherSignal }) {
  const { precipitationMm, cloudCover, temperatureC, rainRiskScore, apparentTempC } = weather;
  let Icon = Sun;
  let tint = "text-amber-500";
  if (precipitationMm > 0.5 || rainRiskScore > 0.6) {
    Icon = CloudRain;
    tint = "risk-text-high";
  } else if (cloudCover > 75) {
    Icon = Cloudy;
    tint = "text-muted-foreground";
  } else if (cloudCover > 35) {
    Icon = CloudSun;
    tint = "text-muted-foreground";
  } else if (temperatureC > 33) {
    Icon = Sun;
    tint = "risk-text-high";
  }
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1">
      <Icon className={cn("h-4 w-4", tint)} />
      <div className="flex flex-col leading-none">
        <span className="text-xs font-bold tabular-nums">{temperatureC.toFixed(0)}°C</span>
        <span className="text-[9px] text-muted-foreground">feels {apparentTempC.toFixed(0)}°</span>
      </div>
    </div>
  );
}

// ─── Mini risk bar ─────────────────────────────────────────────────────
function MiniBar({
  label,
  value,
  max,
  suffix = "%",
  betterIs = "lower",
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  betterIs?: "lower" | "higher";
}) {
  const w = Math.min(100, (value / max) * 100);
  const isHigh = value > max * 0.66;
  const isMed = value > max * 0.33;
  const good = betterIs === "lower" ? !isHigh : isHigh;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">
          {value.toFixed(0)}
          {suffix}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            good ? "bg-emerald-500" : isMed ? "bg-amber-500" : "bg-rose-500",
          )}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}

// ─── Store column card ─────────────────────────────────────────────────
function StoreColumn({ result, index }: { result: AgentRunResult; index: number }) {
  const { plan, weather, briefing } = result;
  const lunch = plan.slots[0];
  const dinner = plan.slots[1];
  const store = lookupStore(result.storeId);
  const storeType = store?.storeType ?? "urban-street";
  const headerCls = STORE_TYPE_HEADER[storeType] ?? STORE_TYPE_HEADER["urban-street"];
  const topActions = briefing.topActions.slice(0, 3);
  const riskLvl = riskLevel(plan.overallRisk);
  const riskBadgeCls =
    riskLvl === "critical" ? "risk-bg-critical risk-border-critical risk-text-critical"
    : riskLvl === "high" ? "risk-bg-high risk-border-high risk-text-high"
    : riskLvl === "medium" ? "risk-bg-medium risk-border-medium risk-text-medium"
    : "risk-bg-low risk-border-low risk-text-low";

  return (
    <div
      className="card-interactive flex min-w-[280px] flex-1 flex-col overflow-hidden rounded-lg border bg-card animate-fade-in-up"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "backwards" }}
    >
      {/* Header band: store type + name + gauge */}
      <div className={cn("flex items-start justify-between gap-2 border-b p-3", headerCls)}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base leading-none">{storeTypeIcon(storeType)}</span>
            <span className="truncate text-sm font-bold text-foreground">{briefing.storeName}</span>
          </div>
          <p className="mt-1 truncate text-[10px] uppercase tracking-wide opacity-80">
            {storeTypeLabel(storeType)}
            {store?.district ? ` · ${store.district}` : ""}
          </p>
          <div className="mt-1.5">
            <RiskTrendArrow score={plan.overallRisk} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <RiskGauge score={plan.overallRisk} size={56} />
          <Badge variant="outline" className={cn("text-[9px] font-bold uppercase", riskBadgeCls)}>
            {riskLvl} risk
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {/* Status badges + weather */}
        <div className="flex flex-wrap items-center gap-1.5">
          <WeatherMini weather={weather} />
          <LiveBadge isLive={result.isLive} />
          <ConfidenceBadge confidence={plan.confidence} />
        </div>

        {/* Mini risk bars */}
        <div className="space-y-1.5">
          <MiniBar label="Rain risk" value={weather.rainRiskScore * 100} max={100} />
          <MiniBar label="Delivery disruption" value={weather.deliveryDisruptionRisk * 100} max={100} />
          <MiniBar label="Walk-in drop" value={weather.walkInDropRisk * 100} max={100} />
          <MiniBar label="Heat risk" value={weather.heatRiskScore * 100} max={100} />
        </div>

        {/* Top 3 action items — priority-coloured */}
        <div className="rounded-md bg-muted/40 p-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <ListChecks className="h-3 w-3" /> Top actions
          </div>
          <ol className="space-y-1.5">
            {topActions.length === 0 && (
              <li className="text-[11px] italic text-muted-foreground">No actions recommended.</li>
            )}
            {topActions.map((a, i) => (
              <li key={i} className="flex gap-1.5 text-[11px] leading-snug">
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                    ACTION_PRIORITY_CLS[i] ?? ACTION_PRIORITY_CLS[3],
                  )}
                  title={`Priority ${i + 1}`}
                >
                  {i + 1}
                </span>
                <span className="text-foreground/90">{a}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Lunch / dinner deltas */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md border bg-card p-2">
            <div className="font-semibold">Lunch</div>
            <p className="mt-0.5 text-muted-foreground">
              walk-in{" "}
              <span className="tabular-nums font-medium text-foreground">
                {lunch.expectedWalkInDelta >= 0 ? "+" : ""}
                {lunch.expectedWalkInDelta}%
              </span>
              <br />
              prep{" "}
              <span className="tabular-nums font-medium text-foreground">
                {lunch.prepBatchDelta >= 0 ? "+" : ""}
                {lunch.prepBatchDelta}%
              </span>
            </p>
          </div>
          <div className="rounded-md border bg-card p-2">
            <div className="font-semibold">Dinner</div>
            <p className="mt-0.5 text-muted-foreground">
              walk-in{" "}
              <span className="tabular-nums font-medium text-foreground">
                {dinner.expectedWalkInDelta >= 0 ? "+" : ""}
                {dinner.expectedWalkInDelta}%
              </span>
              <br />
              staff{" "}
              <span className="tabular-nums font-medium text-foreground">
                {dinner.staffingDelta >= 0 ? "+" : ""}
                {dinner.staffingDelta}
              </span>
            </p>
          </div>
        </div>

        {/* Campaign focus */}
        <div className="rounded-md border-l-2 border-[var(--brand)] bg-[var(--brand)]/5 p-2 text-[11px]">
          <div className="font-semibold text-[var(--brand)]">Campaign focus</div>
          <p className="mt-0.5 leading-snug">{plan.campaignRecommendation.split(".")[0]}.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Comparison table ──────────────────────────────────────────────────
type ComparisonRow = {
  label: string;
  icon: React.ElementType;
  getValues: (r: AgentRunResult) => number;
  format: (v: number) => string;
  betterIs?: "lower" | "higher";
  /** Absolute urgency of a value. */
  status: (v: number) => CellStatus;
  /** Normalised 0-100 for the mini bar gauge. */
  barPct: (v: number) => number;
};

const NUMERIC_ROWS: ComparisonRow[] = [
  {
    label: "Rủi ro Tổng thể",
    icon: AlertTriangle,
    getValues: (r) => r.plan.overallRisk * 100,
    format: (v) => `${v.toFixed(0)}%`,
    betterIs: "lower",
    status: (v) => (v >= 60 ? "critical" : v >= 30 ? "warning" : "good"),
    barPct: (v) => v,
  },
  {
    label: "Rủi ro Mưa",
    icon: CloudRain,
    getValues: (r) => r.weather.rainRiskScore * 100,
    format: (v) => `${v.toFixed(0)}%`,
    betterIs: "lower",
    status: (v) => (v >= 60 ? "critical" : v >= 30 ? "warning" : "good"),
    barPct: (v) => v,
  },
  {
    label: "Rủi ro Nắng nóng",
    icon: Sun,
    getValues: (r) => r.weather.heatRiskScore * 100,
    format: (v) => `${v.toFixed(0)}%`,
    betterIs: "lower",
    status: (v) => (v >= 60 ? "critical" : v >= 30 ? "warning" : "good"),
    barPct: (v) => v,
  },
  {
    label: "Rủi ro Giao hàng",
    icon: CloudRain,
    getValues: (r) => r.weather.deliveryDisruptionRisk * 100,
    format: (v) => `${v.toFixed(0)}%`,
    betterIs: "lower",
    status: (v) => (v >= 60 ? "critical" : v >= 30 ? "warning" : "good"),
    barPct: (v) => v,
  },
  {
    label: "Khách vào giảm",
    icon: TrendingDown,
    getValues: (r) => r.weather.walkInDropRisk * 100,
    format: (v) => `${v.toFixed(0)}%`,
    betterIs: "lower",
    status: (v) => (v >= 60 ? "critical" : v >= 30 ? "warning" : "good"),
    barPct: (v) => v,
  },
  {
    label: "Biến động Prep Trưa",
    icon: Zap,
    getValues: (r) => r.plan.slots[0].prepBatchDelta,
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`,
    status: (v) => (v < -15 ? "critical" : v < 0 ? "warning" : "good"),
    barPct: (v) => Math.min(100, Math.abs(v) * 2),
  },
  {
    label: "Biến động Nhân sự Tối",
    icon: ListChecks,
    getValues: (r) => r.plan.slots[1].staffingDelta,
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`,
    status: (v) => (v < -2 ? "critical" : v < 0 ? "warning" : "good"),
    barPct: (v) => Math.min(100, Math.abs(v) * 20),
  },
  {
    label: "Độ tin cậy",
    icon: Award,
    getValues: (r) => r.plan.confidence * 100,
    format: (v) => `${v.toFixed(0)}%`,
    betterIs: "higher",
    status: (v) => (v < 50 ? "critical" : v < 70 ? "warning" : "good"),
    barPct: (v) => v,
  },
];

function findBestWorst(
  values: number[],
  betterIs: "lower" | "higher",
): { bestIdx: number; worstIdx: number } {
  if (values.length < 2) return { bestIdx: -1, worstIdx: -1 };
  let bestIdx = 0;
  let worstIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (betterIs === "lower") {
      if (values[i] < values[bestIdx]) bestIdx = i;
      if (values[i] > values[worstIdx]) worstIdx = i;
    } else {
      if (values[i] > values[bestIdx]) bestIdx = i;
      if (values[i] < values[worstIdx]) worstIdx = i;
    }
  }
  if (values[bestIdx] === values[worstIdx]) return { bestIdx: -1, worstIdx: -1 };
  return { bestIdx, worstIdx };
}

function ComparisonTable({ results }: { results: AgentRunResult[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-[140px] bg-card">Metric</TableHead>
            {results.map((r) => {
              const t = lookupStore(r.storeId)?.storeType ?? "";
              return (
                <TableHead key={r.storeId} className="min-w-[120px] text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[11px] leading-none">{storeTypeIcon(t)}</span>
                    <span className="block max-w-[110px] truncate font-semibold">
                      {r.briefing.storeName}
                    </span>
                  </div>
                </TableHead>
              );
            })}
            <TableHead className="min-w-[130px] text-center bg-muted/30">
              <div className="flex flex-col items-center gap-0.5">
                <Trophy className="h-3 w-3 fill-amber-400 text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Winner</span>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {NUMERIC_ROWS.map((row) => {
            const RowIcon = row.icon;
            const values = results.map(row.getValues);
            const { bestIdx, worstIdx } = row.betterIs
              ? findBestWorst(values, row.betterIs)
              : { bestIdx: -1, worstIdx: -1 };
            const winnerResult = bestIdx >= 0 ? results[bestIdx] : null;
            return (
              <TableRow key={row.label}>
                <TableCell className="sticky left-0 z-10 bg-card font-medium">
                  <span className="flex items-center gap-1.5">
                    <RowIcon className="h-3 w-3 text-muted-foreground" />
                    {row.label}
                  </span>
                </TableCell>
                {values.map((v, i) => {
                  const isBest = i === bestIdx;
                  const isWorst = i === worstIdx;
                  const st = row.status(v);
                  return (
                    <TableCell
                      key={i}
                      className={cn(
                        "text-center align-middle",
                        isBest
                          ? "bg-emerald-500/20"
                          : isWorst
                            ? "bg-rose-500/20"
                            : CELL_BG[st],
                      )}
                    >
                      <div className="flex flex-col items-center gap-1 py-0.5">
                        <div className="flex items-center justify-center gap-1">
                          {isBest && (
                            <Trophy className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500" />
                          )}
                          {isWorst && (
                            <AlertTriangle className="h-3 w-3 shrink-0 text-rose-500" />
                          )}
                          <span
                            className={cn(
                              "font-bold tabular-nums",
                              isBest
                                ? "text-emerald-700 dark:text-emerald-300"
                                : isWorst
                                  ? "text-rose-700 dark:text-rose-300"
                                  : CELL_TEXT[st],
                            )}
                          >
                            {row.format(v)}
                          </span>
                        </div>
                        {/* mini risk meter */}
                        <div className="h-1 w-12 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width] duration-700 ease-out",
                              isBest
                                ? "bg-emerald-500"
                                : isWorst
                                  ? "bg-rose-500"
                                  : CELL_BAR[st],
                            )}
                            style={{ width: `${row.barPct(v)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  );
                })}
                {/* Winner column cell */}
                <TableCell className="text-center align-middle bg-muted/20">
                  {winnerResult ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <Trophy className="h-3 w-3 fill-amber-400 text-amber-500" />
                      <span className="max-w-[90px] truncate">
                        {winnerResult.briefing.storeName}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Tie</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {/* Campaign Focus — text row */}
          <TableRow>
            <TableCell className="sticky left-0 z-10 bg-card font-medium">
              <span className="flex items-center gap-1.5">
                <Flag className="h-3 w-3 text-muted-foreground" />
                Campaign Focus
              </span>
            </TableCell>
            {results.map((r) => (
              <TableCell
                key={r.storeId}
                className="max-w-[150px] text-center text-[10px] leading-snug text-muted-foreground"
              >
                {r.plan.campaignRecommendation.split(".")[0]}.
              </TableCell>
            ))}
            <TableCell className="text-center text-[10px] text-muted-foreground bg-muted/20">—</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Markdown export (enhanced) ────────────────────────────────────────
function exportMarkdown(results: AgentRunResult[]) {
  const lines: string[] = [];
  const ts = new Date().toLocaleString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" });
  lines.push(`# Agent CaMate — Multi-Store Comparison`);
  lines.push(``);
  lines.push(`_Generated ${ts} (ICT)_`);
  lines.push(``);
  lines.push(`> Agentic pipeline applied to ${results.length} stores with different contexts → materially different operational decisions.`);
  lines.push(``);

  // ── Executive Summary ──
  lines.push(`## Executive Summary`);
  lines.push(``);
  const riskiest = [...results].sort((a, b) => b.plan.overallRisk - a.plan.overallRisk)[0];
  const safest = [...results].sort((a, b) => a.plan.overallRisk - b.plan.overallRisk)[0];
  const mostConfident = [...results].sort((a, b) => b.plan.confidence - a.plan.confidence)[0];
  const leastConfident = [...results].sort((a, b) => a.plan.confidence - b.plan.confidence)[0];
  const liveCount = results.filter((r) => r.isLive).length;
  lines.push(`- **Stores compared:** ${results.length}`);
  lines.push(`- **Riskiest store:** ${riskiest.storeName} (${(riskiest.plan.overallRisk * 100).toFixed(0)}% overall risk)`);
  lines.push(`- **Safest store:** ${safest.storeName} (${(safest.plan.overallRisk * 100).toFixed(0)}% overall risk)`);
  lines.push(`- **Most confident:** ${mostConfident.storeName} (${(mostConfident.plan.confidence * 100).toFixed(0)}%)`);
  lines.push(`- **Least confident:** ${leastConfident.storeName} (${(leastConfident.plan.confidence * 100).toFixed(0)}%)`);
  lines.push(`- **Data sources:** ${liveCount} LIVE · ${results.length - liveCount} FALLBACK`);
  lines.push(``);

  // ── Overview ──
  lines.push(`## Overview`);
  lines.push(``);
  lines.push(`| Store | Type | District | Overall Risk | Confidence | Data Source |`);
  lines.push(`|---|---|---|---|---|---|`);
  results.forEach((r) => {
    const store = lookupStore(r.storeId);
    lines.push(
      `| ${r.storeName} | ${storeTypeLabel(store?.storeType ?? "")} | ${store?.district ?? "—"} | ${(r.plan.overallRisk * 100).toFixed(0)}% | ${(r.plan.confidence * 100).toFixed(0)}% | ${r.isLive ? "LIVE" : "FALLBACK"} |`,
    );
  });
  lines.push(``);

  // ── Risk Comparison with urgency ──
  lines.push(`## Risk Comparison (urgency-coded)`);
  lines.push(``);
  lines.push(`_🟢 good · 🟡 warning · 🔴 critical — lower is better for all risk metrics_`);
  lines.push(``);
  lines.push(`| Store | Rain | Heat | Delivery | Walk-in |`);
  lines.push(`|---|---|---|---|---|`);
  results.forEach((r) => {
    const cell = (v: number) => {
      const e = v >= 60 ? "🔴" : v >= 30 ? "🟡" : "🟢";
      return `${e} ${(v * 100).toFixed(0)}%`;
    };
    lines.push(
      `| ${r.storeName} | ${cell(r.weather.rainRiskScore)} | ${cell(r.weather.heatRiskScore)} | ${cell(r.weather.deliveryDisruptionRisk)} | ${cell(r.weather.walkInDropRisk)} |`,
    );
  });
  lines.push(``);

  // ── Winners per metric ──
  lines.push(`## Metric Winners`);
  lines.push(``);
  lines.push(`| Metric | Winner | Score |`);
  lines.push(`|---|---|---|`);
  NUMERIC_ROWS.forEach((row) => {
    if (!row.betterIs) return;
    const values = results.map(row.getValues);
    const { bestIdx } = findBestWorst(values, row.betterIs);
    if (bestIdx < 0) {
      lines.push(`| ${row.label} | Tie (all equal) | — |`);
      return;
    }
    lines.push(`| ${row.label} | 🏆 ${results[bestIdx].storeName} | ${row.format(values[bestIdx])} |`);
  });
  lines.push(``);

  // ── Per-Store Recommendations ──
  lines.push(`## Per-Store Recommendations`);
  results.forEach((r) => {
    const lunch = r.plan.slots[0];
    const dinner = r.plan.slots[1];
    lines.push(``);
    lines.push(`### ${r.storeName}`);
    lines.push(``);
    lines.push(`- **Store type:** ${storeTypeLabel(lookupStore(r.storeId)?.storeType ?? "")}`);
    lines.push(`- **Overall risk:** ${(r.plan.overallRisk * 100).toFixed(0)}% · **Confidence:** ${(r.plan.confidence * 100).toFixed(0)}% · **Source:** ${r.isLive ? "LIVE" : "FALLBACK"}`);
    lines.push(
      `- **Weather:** ${r.weather.temperatureC.toFixed(0)}°C (feels ${r.weather.apparentTempC.toFixed(0)}°), rain risk ${(r.weather.rainRiskScore * 100).toFixed(0)}%, delivery disruption ${(r.weather.deliveryDisruptionRisk * 100).toFixed(0)}%`,
    );
    lines.push(
      `- **Lunch:** walk-in ${lunch.expectedWalkInDelta >= 0 ? "+" : ""}${lunch.expectedWalkInDelta}%, prep ${lunch.prepBatchDelta >= 0 ? "+" : ""}${lunch.prepBatchDelta}%`,
    );
    lines.push(
      `- **Dinner:** walk-in ${dinner.expectedWalkInDelta >= 0 ? "+" : ""}${dinner.expectedWalkInDelta}%, staff ${dinner.staffingDelta >= 0 ? "+" : ""}${dinner.staffingDelta}`,
    );
    lines.push(`- **Campaign:** ${r.plan.campaignRecommendation}`);
    lines.push(``);
    lines.push(`**Top Priority Actions:**`);
    lines.push(``);
    r.briefing.topActions.slice(0, 3).forEach((a, i) => {
      const priority = i === 0 ? "🔴 P1" : i === 1 ? "🟡 P2" : "🟢 P3";
      lines.push(`${i + 1}. ${priority} — ${a}`);
    });
  });
  lines.push(``);
  lines.push(`---`);
  lines.push(`_Generated by Agent CaMate — Agentic F&amp;B Operations Dashboard_`);

  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agent-camate-comparison-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Empty state ───────────────────────────────────────────────────────
function EmptyState() {
  return (
    <Card className="card-interactive border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="brand-gradient flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg">
          <GitCompare className="h-8 w-8 text-white" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Add stores to compare</p>
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
            Click the{" "}
            <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-0.5 font-medium text-foreground">
              <Plus className="h-3 w-3" /> Add to compare
            </span>{" "}
            button on any store&apos;s result, or run{" "}
            <span className="font-medium text-foreground">&ldquo;Run 3-store compare&rdquo;</span>{" "}
            to auto-compare urban, residential &amp; suburban highlights side by side.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5">
            <Trophy className="h-2.5 w-2.5 fill-amber-400 text-amber-500" /> Best value highlighted
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5 text-rose-500" /> Worst value flagged
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5">
            <Download className="h-2.5 w-2.5" /> Export to Markdown
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export interface CompareViewProps {
  results: AgentRunResult[];
  onClear: () => void;
}

export function CompareView({ results, onClear }: CompareViewProps) {
  if (results.length === 0) return <EmptyState />;
  if (results.length === 1) return null;

  const liveCount = results.filter((r) => r.isLive).length;
  const avgRisk =
    results.reduce((s, r) => s + r.plan.overallRisk, 0) / results.length;

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="card-interactive overflow-hidden border-[var(--brand)]/30">
        {/* ── Enhanced header ── */}
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md">
                <GitCompare className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  Store Comparison
                  <Badge
                    variant="outline"
                    className="tabular-nums gap-1 border-[var(--brand)]/40 text-[var(--brand)]"
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    {results.length} stores
                  </Badge>
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Side-by-side: the same agentic pipeline applied to different store contexts →
                  different operational decisions.
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        liveCount === results.length
                          ? "bg-emerald-500"
                          : liveCount === 0
                            ? "bg-amber-500"
                            : "bg-sky-500",
                      )}
                    />
                    {liveCount}/{results.length} live
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold",
                      avgRisk >= 0.6
                        ? "risk-bg-critical risk-border-critical risk-text-critical"
                        : avgRisk >= 0.3
                          ? "risk-bg-medium risk-border-medium risk-text-medium"
                          : "risk-bg-low risk-border-low risk-text-low",
                    )}
                  >
                    Avg risk {(avgRisk * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportMarkdown(results)}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Export .md
              </Button>
              <Button size="sm" variant="destructive" onClick={onClear} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Store cards row ── */}
          <ScrollArea className="w-full scrollbar-thin">
            <div className="flex gap-3 pb-2">
              {results.map((r, i) => (
                <StoreColumn key={r.storeId} result={r} index={i} />
              ))}
            </div>
          </ScrollArea>

          {/* ── Comparison matrix ── */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <Trophy className="h-3 w-3 fill-amber-400 text-amber-500" />
                Metric-by-metric breakdown
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium">
                <span className="inline-flex items-center gap-1">
                  <Trophy className="h-2.5 w-2.5 fill-amber-400 text-amber-500" /> Best
                </span>
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5 text-rose-500" /> Worst
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/60" /> Good
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/60" /> Warning
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-rose-500/60" /> Critical
                </span>
              </div>
            </div>
            <ComparisonTable results={results} />
          </div>

          {/* ── Demo story ── */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
            <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
            <span>
              <strong className="text-foreground">Demo story:</strong> notice how an urban CBD
              store, a residential store, and an outer suburban store receive materially different
              prep, staffing &amp; campaign recommendations from the <em>same</em> agent pipeline —
              because their store type, delivery share, and rider-distance risk differ. That is the
              hyperlocal value.
            </span>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
