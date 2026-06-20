"use client";

import * as React from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  DollarSign,
  Gauge as GaugeIcon,
  Minus,
  Settings,
  ShoppingCart,
  Smile,
  TrendingDown,
  TrendingUp,
  Trophy,
  Utensils,
  Users,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgentRunResult } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Public props ────────────────────────────────────────────────────
export interface StoreHealthScoreProps {
  result: AgentRunResult | null;
  storeId: string | null;
  className?: string;
}

// ─── Deterministic pseudo-random helpers ─────────────────────────────
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic value in [min, max] derived from a string seed. */
function seededRange(seed: string, min: number, max: number): number {
  const rnd = mulberry32(hashString(seed));
  return min + rnd() * (max - min);
}

// ─── Health-score color thresholds ───────────────────────────────────
type HealthTier = "low" | "medium" | "high" | "critical";

function tierForScore(score: number): HealthTier {
  if (score >= 80) return "low"; // green
  if (score >= 60) return "medium"; // amber
  if (score >= 40) return "high"; // orange
  return "critical"; // red
}

function tierColorVar(tier: HealthTier): string {
  return `var(--risk-${tier})`;
}

function tierLabel(tier: HealthTier): string {
  switch (tier) {
    case "low":
      return "Excellent";
    case "medium":
      return "Healthy";
    case "high":
      return "At Risk";
    case "critical":
      return "Critical";
  }
}

// ─── Animated count-up hook ──────────────────────────────────────────
function useCountUp(target: number, durationMs = 1100, start?: number): number {
  const initial = start ?? Math.max(0, target * 0.55);
  const [value, setValue] = React.useState(initial);
  const prevTargetRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const isFirst = prevTargetRef.current === null;
    const fromValue = isFirst ? initial : (prevTargetRef.current as number);
    prevTargetRef.current = target;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(fromValue + (target - fromValue) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, initial]);
  return value;
}

// ─── Sparkline (inline SVG) ──────────────────────────────────────────
function Sparkline({
  data,
  color,
  width = 64,
  height = 22,
  fillOpacity = 0.12,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  fillOpacity?: number;
}) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y] as const;
  });
  const polyline = points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const areaPath =
    points.length > 1
      ? `M ${points[0][0].toFixed(2)},${height} ` +
        points.map((p) => `L ${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ") +
        ` L ${points[points.length - 1][0].toFixed(2)},${height} Z`
      : "";
  const last = points[points.length - 1];

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      {areaPath && <path d={areaPath} fill={color} opacity={fillOpacity} />}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
      <circle cx={last[0]} cy={last[1]} r={4.5} fill={color} opacity={0.18} />
    </svg>
  );
}

// ─── Circular Health Gauge ───────────────────────────────────────────
function HealthGauge({
  score,
  trend,
  previousScore,
  size = 132,
}: {
  score: number;
  trend: "up" | "down" | "flat";
  previousScore: number;
  size?: number;
}) {
  const animated = useCountUp(score, 1200, 0);
  const tier = tierForScore(score);
  const color = tierColorVar(tier);
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // 270° gauge arc — leave 90° gap at bottom for a speedometer feel.
  const arcFraction = 0.75;
  const arcLength = c * arcFraction;
  const dashLen = (animated / 100) * arcLength;
  const gap = c - dashLen;
  const rotation = 135; // start at bottom-left

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "var(--risk-low)"
      : trend === "down"
        ? "var(--risk-critical)"
        : "var(--muted-foreground)";
  const delta = Math.round(score - previousScore);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-[0deg]">
          <defs>
            <linearGradient id="healthGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.65" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="oklch(from var(--muted) l c h / 0.45)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${c - arcLength}`}
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          />
          {/* Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#healthGaugeGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dashLen} ${gap}`}
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            style={{
              transition: "stroke-dasharray 0.2s linear",
              filter: `drop-shadow(0 0 6px oklch(from ${color} l c h / 0.45))`,
            }}
          />
        </svg>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold tabular-nums leading-none">
            {Math.round(animated)}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            / 100
          </div>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
          style={{
            color,
            backgroundColor: `oklch(from ${color} l c h / 0.15)`,
          }}
        >
          {tierLabel(tier)}
        </span>
        <span
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums"
          style={{ color: trendColor }}
        >
          <TrendIcon className="h-3 w-3" />
          {delta > 0 ? `+${delta}` : delta === 0 ? "0" : delta} pts
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground">Health Score</div>
    </div>
  );
}

// ─── Sub-score horizontal bar ────────────────────────────────────────
function SubScoreBar({
  label,
  score,
  trend,
  icon: Icon,
  index,
}: {
  label: string;
  score: number;
  trend: "up" | "down" | "flat";
  icon: React.ComponentType<{ className?: string }>;
  index: number;
}) {
  const animated = useCountUp(score, 1100 + index * 60, 0);
  const tier = tierForScore(score);
  const color = tierColorVar(tier);
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor =
    trend === "up"
      ? "var(--risk-low)"
      : trend === "down"
        ? "var(--risk-critical)"
        : "var(--muted-foreground)";

  return (
    <div className="group">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums"
            style={{ color: trendColor }}
            title={`Trend: ${trend}`}
          >
            <TrendIcon className="h-3 w-3" />
          </span>
          <span
            className="w-7 text-right text-xs font-bold tabular-nums"
            style={{ color }}
          >
            {Math.round(animated)}
          </span>
        </div>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "oklch(from var(--muted) l c h / 0.4)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${animated}%`,
            background: `linear-gradient(90deg, oklch(from ${color} l c h / 0.5), ${color})`,
            transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: `0 0 8px oklch(from ${color} l c h / 0.35)`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Key metric card with sparkline ──────────────────────────────────
interface MetricCardSparkProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  deltaGood: boolean; // whether the delta is good (improvement)
  sparkData: number[];
  sparkColor: string;
  index: number;
}

function MetricCardSpark({
  icon: Icon,
  label,
  value,
  delta,
  deltaPositive,
  deltaGood,
  sparkData,
  sparkColor,
  index,
}: MetricCardSparkProps) {
  return (
    <div
      className={cn(
        "metric-card animate-fade-in-up overflow-hidden",
        deltaGood ? "metric-card-risk-low" : "metric-card-risk-high",
      )}
      style={{ animationDelay: `${index * 70}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Icon className="h-3 w-3" />
            <span className="truncate">{label}</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums leading-none">{value}</div>
        </div>
        <Sparkline data={sparkData} color={sparkColor} width={64} height={26} />
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold tabular-nums">
        {deltaPositive ? (
          <ArrowUpRight
            className={cn("h-3 w-3", deltaGood ? "text-[var(--risk-low)]" : "text-[var(--risk-critical)]")}
          />
        ) : (
          <ArrowDownRight
            className={cn("h-3 w-3", deltaGood ? "text-[var(--risk-low)]" : "text-[var(--risk-critical)]")}
          />
        )}
        <span className={deltaGood ? "text-[var(--risk-low)]" : "text-[var(--risk-critical)]"}>{delta}</span>
        <span className="font-normal text-muted-foreground">vs baseline</span>
      </div>
    </div>
  );
}

// ─── Network comparison row ──────────────────────────────────────────
function NetworkComparisonRow({
  label,
  storeValue,
  networkValue,
  betterIs,
  unit,
  formatFn,
}: {
  label: string;
  storeValue: number;
  networkValue: number;
  betterIs: "lower" | "higher";
  unit: string;
  formatFn: (v: number) => string;
}) {
  const storeBetter =
    betterIs === "higher" ? storeValue >= networkValue : storeValue <= networkValue;
  const maxVal = Math.max(storeValue, networkValue) * 1.15 || 1;
  const storePct = Math.min(100, (storeValue / maxVal) * 100);
  const netPct = Math.min(100, (networkValue / maxVal) * 100);
  const storeColor = storeBetter ? "var(--risk-low)" : "var(--risk-critical)";
  const netColor = "var(--muted-foreground)";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            storeBetter
              ? "risk-bg-low risk-text-low"
              : "risk-bg-critical risk-text-critical",
          )}
        >
          {storeBetter ? "Above avg" : "Below avg"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "oklch(from var(--muted) l c h / 0.35)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${storePct}%`,
                background: `linear-gradient(90deg, oklch(from ${storeColor} l c h / 0.5), ${storeColor})`,
                transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px] tabular-nums">
            <span className="font-semibold" style={{ color: storeColor }}>
              This store
            </span>
            <span className="font-bold" style={{ color: storeColor }}>
              {formatFn(storeValue)}
              {unit}
            </span>
          </div>
        </div>
        <div className="w-px self-stretch bg-border" />
        <div className="flex-1">
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "oklch(from var(--muted) l c h / 0.35)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${netPct}%`,
                backgroundColor: netColor,
                opacity: 0.45,
                transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px] tabular-nums">
            <span className="font-medium text-muted-foreground">Network avg</span>
            <span className="font-semibold text-muted-foreground">
              {formatFn(networkValue)}
              {unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Trend timeline (7 agent runs) ───────────────────────────────────
interface TimelineRun {
  timestamp: string;
  riskScore: number; // 0-1
  isCurrent: boolean;
}

function generateTimeline(storeId: string, currentRisk: number): TimelineRun[] {
  const seedBase = hashString(`timeline-${storeId}`);
  const rnd = mulberry32(seedBase);
  const runs: TimelineRun[] = [];
  const now = Date.now();
  // 7 runs spread over the past ~7 hours
  for (let i = 6; i >= 0; i--) {
    const t = new Date(now - i * 60 * 60 * 1000);
    let risk: number;
    if (i === 0) {
      risk = currentRisk;
    } else {
      // Past runs vary around current ± 0.18 with mild mean-reversion to ~0.45
      const noise = (rnd() - 0.5) * 0.36;
      risk = Math.max(0.05, Math.min(0.95, currentRisk + noise + (0.4 - currentRisk) * 0.1));
    }
    runs.push({
      timestamp: t.toISOString(),
      riskScore: risk,
      isCurrent: i === 0,
    });
  }
  return runs;
}

function riskTierFromScore(score: number): HealthTier {
  if (score < 0.3) return "low";
  if (score < 0.55) return "medium";
  if (score < 0.75) return "high";
  return "critical";
}

function TrendTimeline({ runs }: { runs: TimelineRun[] }) {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const lineRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      <div
        ref={lineRef}
        className="relative mx-2 mb-6 mt-3 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      >
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
          {runs.map((r, i) => {
            const tier = riskTierFromScore(r.riskScore);
            const color = tierColorVar(tier);
            const isCurrent = r.isCurrent;
            const isHover = hoverIdx === i;
            return (
              <button
                key={i}
                type="button"
                className="group relative flex flex-col items-center"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onFocus={() => setHoverIdx(i)}
                onBlur={() => setHoverIdx(null)}
                aria-label={`Run ${i + 1}: risk ${Math.round(r.riskScore * 100)}%`}
              >
                {/* Pulsing ring for current */}
                {isCurrent && (
                  <span
                    className="absolute -top-3 h-6 w-6 rounded-full animate-ping"
                    style={{ backgroundColor: `oklch(from ${color} l c h / 0.35)` }}
                  />
                )}
                <span
                  className={cn(
                    "relative rounded-full border-2 transition-all",
                    isCurrent ? "h-4 w-4" : "h-2.5 w-2.5",
                    isHover && "scale-125",
                  )}
                  style={{
                    backgroundColor: color,
                    borderColor: isCurrent ? color : "var(--background)",
                    boxShadow: isCurrent
                      ? `0 0 0 3px oklch(from ${color} l c h / 0.25)`
                      : `0 0 4px oklch(from ${color} l c h / 0.4)`,
                  }}
                />
                {/* Tick label */}
                <span
                  className={cn(
                    "absolute top-4 text-[9px] tabular-nums transition-colors",
                    isCurrent || isHover ? "font-bold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {new Date(r.timestamp).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

                {/* Hover tooltip */}
                {isHover && (
                  <div
                    className="absolute -top-12 z-10 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[10px] shadow-md"
                    role="tooltip"
                  >
                    <div className="font-semibold">
                      {new Date(r.timestamp).toLocaleString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short",
                      })}
                    </div>
                    <div className="flex items-center gap-1" style={{ color }}>
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      Risk score: {Math.round(r.riskScore * 100)}%
                    </div>
                    {r.isCurrent && <div className="text-[var(--brand)] font-semibold">● Current run</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>7 runs ago</span>
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3 w-3 text-[var(--brand)]" />
          Live now
        </span>
      </div>
    </div>
  );
}

// ─── Health score calculation (adapted to actual AgentRunResult shape) ─
function calculateHealthScore(result: AgentRunResult): number {
  // Base from plan confidence (0-1) → 0..40
  let score = result.plan.confidence * 40;
  // Lower overall risk → more health. Risk is 0-1, so (1-risk)*30 → 0..30
  score += (1 - result.plan.overallRisk) * 30;
  // Before/after improvement: withAgent vs withoutAgent averaged across metrics.
  if (result.beforeAfter.length) {
    let improvementSum = 0;
    for (const m of result.beforeAfter) {
      const base = m.withoutAgent || 1;
      const delta = (m.withAgent - m.withoutAgent) / base; // signed
      // For metrics where lower-is-better, "improvement" means withAgent < withoutAgent (negative delta).
      // Normalise so a positive improvement is always good.
      const normalised = m.betterIs === "lower" ? -delta : delta;
      improvementSum += normalised;
    }
    const avgImprovement = improvementSum / result.beforeAfter.length;
    score += Math.min(30, Math.max(0, avgImprovement * 100));
  }
  return Math.round(Math.min(100, Math.max(0, score)));
}

interface SubScore {
  label: string;
  score: number;
  trend: "up" | "down" | "flat";
  icon: React.ComponentType<{ className?: string }>;
}

function calculateSubScores(result: AgentRunResult, storeId: string): SubScore[] {
  const w = result.weather;
  const plan = result.plan;
  const byKey = (k: string) => result.beforeAfter.find((m) => m.key === k);
  const staffing = byKey("staffing");
  const delivery = byKey("delivery");
  const margin = byKey("margin");
  const waste = byKey("waste");

  // Operations Health — staffing fit blended with confidence
  const opsScore = Math.round(
    (staffing?.withAgent ?? 70) * 0.7 + plan.confidence * 100 * 0.3,
  );
  // Weather Readiness — inverse of worst weather risk
  const maxWeatherRisk = Math.max(
    w.rainRiskScore,
    w.heatRiskScore,
    w.deliveryDisruptionRisk,
    w.walkInDropRisk,
  );
  const weatherScore = Math.round((1 - maxWeatherRisk) * 100);
  // Customer Experience — delivery readiness blended with service-delay absence
  const custScore = Math.round(
    (delivery?.withAgent ?? 70) * 0.6 +
      Math.max(0, 100 - plan.serviceDelayWarnings.length * 8) * 0.4,
  );
  // Revenue Protection — margin protection blended with confidence
  const revScore = Math.round(
    (margin?.withAgent ?? 70) * 0.7 + plan.confidence * 100 * 0.3,
  );
  // Inventory Health — inverse of waste (lower waste → higher health)
  const wastePct = waste?.withAgent ?? 10;
  const invScore = Math.round(Math.max(0, Math.min(100, 100 - wastePct * 2.2)));
  // Compliance — confidence + staffing
  const compScore = Math.round(
    plan.confidence * 100 * 0.6 + (staffing?.withAgent ?? 70) * 0.4,
  );

  // Deterministic "previous" sub-scores for trend arrows
  const rnd = mulberry32(hashString(`sub-${storeId}`));
  const mkTrend = (cur: number): "up" | "down" | "flat" => {
    const noise = (rnd() - 0.4) * 10; // slight upward bias
    const prev = cur - noise;
    const d = cur - prev;
    if (d > 1.5) return "up";
    if (d < -1.5) return "down";
    return "flat";
  };

  return [
    { label: "Operations Health", score: opsScore, trend: mkTrend(opsScore), icon: Settings },
    { label: "Weather Readiness", score: weatherScore, trend: mkTrend(weatherScore), icon: Activity },
    { label: "Customer Experience", score: custScore, trend: mkTrend(custScore), icon: Users },
    { label: "Revenue Protection", score: revScore, trend: mkTrend(revScore), icon: DollarSign },
    { label: "Inventory Health", score: invScore, trend: mkTrend(invScore), icon: Utensils },
    { label: "Compliance", score: compScore, trend: mkTrend(compScore), icon: GaugeIcon },
  ];
}

// Need Settings import (added at top with other Lucide icons).

// ─── Sparkline data generators ───────────────────────────────────────
function genSalesSpark(storeId: string, base: number): number[] {
  const rnd = mulberry32(hashString(`sales-${storeId}`));
  const out: number[] = [];
  let v = base * 0.9;
  for (let i = 0; i < 7; i++) {
    // Slight upward bias
    v += (rnd() - 0.35) * base * 0.06;
    out.push(Math.max(base * 0.7, Math.min(base * 1.15, v)));
  }
  return out;
}

function genOrdersSpark(storeId: string): number[] {
  // 12-hour window with lunch (~4-5 = 12-13h) and dinner (~8-9 = 19-20h) peaks
  const rnd = mulberry32(hashString(`orders-${storeId}`));
  const baseline = 60 + rnd() * 30;
  const lunchPeak = 130 + rnd() * 40;
  const dinnerPeak = 110 + rnd() * 30;
  const shape = [
    0.45, 0.55, 0.75, 0.92, 1.0, 0.78, 0.6, 0.7, 0.88, 0.95, 0.55, 0.4,
  ];
  const peaks = [
    baseline * 0.6,
    baseline * 0.7,
    baseline * 0.95,
    lunchPeak,
    lunchPeak * 0.98,
    baseline * 1.0,
    baseline * 0.85,
    baseline * 1.05,
    dinnerPeak,
    dinnerPeak * 0.9,
    baseline * 0.7,
    baseline * 0.55,
  ];
  return shape.map((s, i) => peaks[i] * (0.92 + rnd() * 0.16));
}

function genPrepTimeSpark(storeId: string): number[] {
  const rnd = mulberry32(hashString(`prep-${storeId}`));
  const baseline = 8.5 + rnd() * 2;
  const out: number[] = [];
  for (let i = 0; i < 6; i++) {
    out.push(Math.max(5, Math.min(14, baseline + (rnd() - 0.5) * 3)));
  }
  return out;
}

function genCsatSpark(storeId: string): number[] {
  const rnd = mulberry32(hashString(`csat-${storeId}`));
  const out: number[] = [];
  let v = 4.6 + rnd() * 0.2;
  for (let i = 0; i < 7; i++) {
    v += (rnd() - 0.5) * 0.06;
    v = Math.max(4.3, Math.min(4.95, v));
    out.push(v);
  }
  return out;
}

// ─── Empty / loading state ───────────────────────────────────────────
function EmptyState({ className }: { className?: string }) {
  return (
    <Card className={cn("card-interactive overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-[var(--brand)]" />
          Store Health Score
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Real-time performance metrics · Network comparison · 7-run trend
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex flex-col items-center gap-2 lg:col-span-4">
            <Skeleton className="h-32 w-32 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="space-y-3 lg:col-span-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Skeleton className="h-32 lg:col-span-7 rounded-lg" />
          <Skeleton className="h-32 lg:col-span-5 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ──────────────────────────────────────────────────
export function StoreHealthScore({ result, storeId, className }: StoreHealthScoreProps) {
  // Memoise all derived data so it stays stable across re-renders.
  const derived = React.useMemo(() => {
    if (!result || !storeId) return null;

    const score = calculateHealthScore(result);
    // Deterministic "previous run" score so trend is meaningful & stable per store.
    const prevDelta = seededRange(`prev-score-${storeId}`, -6, 4);
    const previousScore = Math.max(0, Math.min(100, Math.round(score - prevDelta)));
    const trend: "up" | "down" | "flat" =
      score - previousScore > 1 ? "up" : score - previousScore < -1 ? "down" : "flat";

    const subScores = calculateSubScores(result, storeId);

    // Sparkline datasets
    const salesBase = 3200 + seededRange(`sales-base-${storeId}`, 0, 1800);
    const salesSpark = genSalesSpark(storeId, salesBase);
    const ordersSpark = genOrdersSpark(storeId);
    const prepSpark = genPrepTimeSpark(storeId);
    const csatSpark = genCsatSpark(storeId);

    // Metric card values
    const salesToday = salesSpark[salesSpark.length - 1];
    const salesForecast = salesBase * 0.97;
    const salesDeltaPct = ((salesToday - salesForecast) / salesForecast) * 100;

    const ordersNow = Math.round(ordersSpark[ordersSpark.length - 1]);
    const ordersBaseline = 80;
    const ordersDeltaPct = ((ordersNow - ordersBaseline) / ordersBaseline) * 100;

    const prepNow = prepSpark[prepSpark.length - 1];
    const prepBaseline = 10;
    const prepDeltaPct = ((prepNow - prepBaseline) / prepBaseline) * 100;

    const csatNow = csatSpark[csatSpark.length - 1];
    const csatBaseline = 4.5;
    const csatDeltaPct = ((csatNow - csatBaseline) / csatBaseline) * 100;

    // Network comparison
    const totalStores = 20;
    // Rank derived from store risk + storeId hash: lower risk → better rank
    const rankNoise = Math.floor(seededRange(`rank-${storeId}`, 0, 8));
    const rank = Math.max(1, Math.min(totalStores, Math.round((1 - result.plan.overallRisk) * 14) + rankNoise));
    const networkRiskAvg = 0.42;
    const networkConfAvg = 0.68;
    const networkRespAvg = 380; // ms
    const storeRespMs = Math.round(220 + seededRange(`resp-${storeId}`, 0, 280));
    const storeRisk = result.plan.overallRisk;
    const storeConf = result.plan.confidence;

    // Timeline
    const timeline = generateTimeline(storeId, result.plan.overallRisk);

    return {
      score,
      previousScore,
      trend,
      subScores,
      salesSpark,
      ordersSpark,
      prepSpark,
      csatSpark,
      salesToday,
      salesDeltaPct,
      ordersNow,
      ordersDeltaPct,
      prepNow,
      prepDeltaPct,
      csatNow,
      csatDeltaPct,
      rank,
      totalStores,
      networkRiskAvg,
      networkConfAvg,
      networkRespAvg,
      storeRespMs,
      storeRisk,
      storeConf,
      timeline,
      generatedAt: result.generatedAt,
      storeName: result.storeName,
    };
  }, [result, storeId]);

  if (!derived) {
    return <EmptyState className={className} />;
  }

  return (
    <Card className={cn("card-interactive overflow-hidden border-[var(--brand)]/25", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-[var(--brand)]" />
              Store Health Score
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {derived.storeName} · Updated{" "}
              {new Date(derived.generatedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <Badge
            variant="outline"
            className="gap-1 border text-[10px] font-semibold uppercase tracking-wide"
          >
            <span className="status-dot status-live" />
            Live
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Gauge + Sub-scores ─────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="flex animate-fade-in-up items-center justify-center lg:col-span-4 lg:justify-start">
            <HealthGauge
              score={derived.score}
              trend={derived.trend}
              previousScore={derived.previousScore}
            />
          </div>
          <div className="space-y-2.5 lg:col-span-8">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Health Score Breakdown
              </div>
              <div className="text-[10px] text-muted-foreground">6 dimensions</div>
            </div>
            {derived.subScores.map((s, i) => (
              <SubScoreBar
                key={s.label}
                label={s.label}
                score={s.score}
                trend={s.trend}
                icon={s.icon}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* ── Key Metrics Row ───────────────────────────────────── */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Key Performance Metrics
            </div>
            <div className="text-[10px] text-muted-foreground">vs baseline · sparkline</div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCardSpark
              index={0}
              icon={DollarSign}
              label="Sales Today"
              value={`$${(derived.salesToday / 1000).toFixed(1)}k`}
              delta={`${derived.salesDeltaPct >= 0 ? "+" : ""}${derived.salesDeltaPct.toFixed(1)}%`}
              deltaPositive={derived.salesDeltaPct >= 0}
              deltaGood={derived.salesDeltaPct >= 0}
              sparkData={derived.salesSpark}
              sparkColor="var(--brand)"
            />
            <MetricCardSpark
              index={1}
              icon={ShoppingCart}
              label="Orders / Hour"
              value={`${derived.ordersNow}`}
              delta={`${derived.ordersDeltaPct >= 0 ? "+" : ""}${derived.ordersDeltaPct.toFixed(0)}%`}
              deltaPositive={derived.ordersDeltaPct >= 0}
              deltaGood={derived.ordersDeltaPct >= 0}
              sparkData={derived.ordersSpark}
              sparkColor="var(--chart-2)"
            />
            <MetricCardSpark
              index={2}
              icon={Clock}
              label="Avg Prep Time"
              value={`${derived.prepNow.toFixed(1)}m`}
              delta={`${derived.prepDeltaPct >= 0 ? "+" : ""}${derived.prepDeltaPct.toFixed(0)}%`}
              deltaPositive={derived.prepDeltaPct >= 0}
              deltaGood={derived.prepDeltaPct <= 0}
              sparkData={derived.prepSpark}
              sparkColor="var(--chart-3)"
            />
            <MetricCardSpark
              index={3}
              icon={Smile}
              label="CSAT Score"
              value={derived.csatNow.toFixed(2)}
              delta={`${derived.csatDeltaPct >= 0 ? "+" : ""}${derived.csatDeltaPct.toFixed(1)}%`}
              deltaPositive={derived.csatDeltaPct >= 0}
              deltaGood={derived.csatDeltaPct >= 0}
              sparkData={derived.csatSpark}
              sparkColor="var(--chart-5)"
            />
          </div>
        </div>

        {/* ── Network Comparison + Trend Timeline ──────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Network comparison */}
          <div className="rounded-lg border bg-card/60 p-3.5 lg:col-span-7">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-[var(--brand)]" />
                <span className="text-xs font-semibold">Network Comparison</span>
              </div>
              <Badge
                variant="outline"
                className="gap-1 border text-[10px] font-bold tabular-nums"
              >
                <Trophy className="h-3 w-3 text-[var(--brand)]" />
                #{derived.rank}
                <span className="font-normal text-muted-foreground">of {derived.totalStores}</span>
              </Badge>
            </div>
            <div className="space-y-3">
              <NetworkComparisonRow
                label="Risk Score"
                storeValue={derived.storeRisk}
                networkValue={derived.networkRiskAvg}
                betterIs="lower"
                unit=""
                formatFn={(v) => `${Math.round(v * 100)}%`}
              />
              <NetworkComparisonRow
                label="Confidence"
                storeValue={derived.storeConf}
                networkValue={derived.networkConfAvg}
                betterIs="higher"
                unit=""
                formatFn={(v) => `${Math.round(v * 100)}%`}
              />
              <NetworkComparisonRow
                label="Response Time"
                storeValue={derived.storeRespMs}
                networkValue={derived.networkRespAvg}
                betterIs="lower"
                unit="ms"
                formatFn={(v) => `${Math.round(v)}`}
              />
            </div>
          </div>

          {/* Trend timeline */}
          <div className="rounded-lg border bg-card/60 p-3.5 lg:col-span-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-[var(--brand)]" />
                <span className="text-xs font-semibold">7-Run Trend</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "var(--risk-low)" }}
                />
                Low
                <span
                  className="ml-1 inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "var(--risk-medium)" }}
                />
                Med
                <span
                  className="ml-1 inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "var(--risk-high)" }}
                />
                High
                <span
                  className="ml-1 inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "var(--risk-critical)" }}
                />
                Crit
              </div>
            </div>
            <TrendTimeline runs={derived.timeline} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StoreHealthScore;
