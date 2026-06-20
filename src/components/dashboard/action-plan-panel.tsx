"use client";

import * as React from "react";
import {
  Sun,
  Moon,
  Package,
  ChefHat,
  Users,
  Bike,
  Truck,
  Megaphone,
  AlertTriangle,
  PackageX,
  Timer,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  Gauge,
  Sparkles,
  Clock,
  ListChecks,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CloudRain,
  Thermometer,
  Droplets,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ActionPlan, SlotPlan, RiskExplanation } from "@/lib/types";
import {
  RiskBadge,
  ConfidenceBadge,
  riskLevel,
  riskColorClass,
  riskBgClass,
  formatTime,
  type RiskLevel,
} from "./shared";
import { cn } from "@/lib/utils";

// ─── Animated count-up hook ────────────────────────────────────────────
function useCountUp(target: number, durationMs = 800, start?: number): number {
  const initial = start ?? target * 0.6;
  const [value, setValue] = React.useState(initial);
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const from = initial;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, initial]);
  return value;
}

// ─── Animated bar fill hook ────────────────────────────────────────────
function useMounted(delay = 0): boolean {
  const [m, setM] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setM(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return m;
}

// ─── DeltaPill — compact signed delta badge ───────────────────────────
function DeltaPill({
  value,
  suffix = "%",
  invert = false,
}: {
  value: number;
  suffix?: string;
  invert?: boolean;
}) {
  const positive = value > 0;
  const good = invert ? value < 0 : value > 0;
  const Icon = positive ? TrendingUp : value < 0 ? TrendingDown : null;
  const color =
    value === 0
      ? "text-muted-foreground bg-muted"
      : good
        ? "risk-text-low risk-bg-low risk-border-low"
        : "risk-text-high risk-bg-high risk-border-high";
  return (
    <Badge variant="outline" className={cn("border font-semibold tabular-nums gap-1", color)}>
      {Icon && <Icon className="h-3 w-3" />}
      {value > 0 ? "+" : ""}
      {value}
      {suffix}
    </Badge>
  );
}

// ─── Large delta display for slot cards ───────────────────────────────
function LargeDelta({
  value,
  suffix = "%",
  invert = false,
  icon: Icon,
  label,
}: {
  value: number;
  suffix?: string;
  invert?: boolean;
  icon: React.ElementType;
  label: string;
}) {
  const good = invert ? value < 0 : value > 0;
  const neutral = value === 0;
  const Arrow = value > 0 ? ArrowUp : value < 0 ? ArrowDown : null;
  const colorClass = neutral
    ? "text-muted-foreground"
    : good
      ? "risk-text-low"
      : "risk-text-high";
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn("flex items-baseline gap-0.5 text-lg font-bold tabular-nums leading-tight", colorClass)}>
        {value > 0 ? "+" : ""}
        {value}
        <span className="text-xs font-medium opacity-70">{suffix}</span>
        {Arrow && <Arrow className="h-3.5 w-3.5" />}
      </div>
    </div>
  );
}

// ─── Risk gauge (small SVG circular) ──────────────────────────────────
function RiskGauge({ score, size = 56 }: { score: number; size?: number }) {
  const level = riskLevel(score);
  const stroke = 5;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const animatedScore = useCountUp(score * 100, 900, 0);
  const dash = (animatedScore / 100) * c;
  const colorVar =
    level === "low"
      ? "var(--risk-low)"
      : level === "medium"
        ? "var(--risk-medium)"
        : level === "high"
          ? "var(--risk-high)"
          : "var(--risk-critical)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
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
          style={{ transition: "stroke-dasharray 0.1s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-sm font-bold tabular-nums leading-none", riskColorClass(level))}>
          {animatedScore.toFixed(0)}
          <span className="text-[8px] font-semibold opacity-70">%</span>
        </span>
      </div>
    </div>
  );
}

// ─── Summary stat tile ────────────────────────────────────────────────
function SummaryStat({
  icon: Icon,
  label,
  children,
  accent = "text-[var(--brand)]",
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="metric-card rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3 w-3", accent)} />
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

// ─── Confidence mini-bar ──────────────────────────────────────────────
function ConfidenceBar({ confidence }: { confidence: number }) {
  const mounted = useMounted(150);
  const pct = Math.round(confidence * 100);
  const level = riskLevel(1 - confidence);
  const barClass =
    level === "low"
      ? "risk-bar-low"
      : level === "medium"
        ? "risk-bar-medium"
        : level === "high"
          ? "risk-bar-high"
          : "risk-bar-critical";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-1">
        <span className={cn("text-lg font-bold tabular-nums leading-tight", riskColorClass(level))}>
          {pct}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">%</span>
      </div>
      <div className="progress-bar-slim">
        <div
          className={cn("h-full rounded-full", barClass)}
          style={{
            width: mounted ? `${pct}%` : "0%",
            transition: "width 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Risk factor card ─────────────────────────────────────────────────
function RiskFactorCard({ factor, weight, reasoning, index }: RiskExplanation & { index: number }) {
  const mounted = useMounted(180 + index * 80);
  const level = riskLevel(weight);
  const weightPct = Math.round(weight * 100);
  const barClass =
    level === "low"
      ? "risk-bar-low"
      : level === "medium"
        ? "risk-bar-medium"
        : level === "high"
          ? "risk-bar-high"
          : "risk-bar-critical";
  const FactorIcon = factor.toLowerCase().includes("rain")
    ? CloudRain
    : factor.toLowerCase().includes("heat")
      ? Thermometer
      : factor.toLowerCase().includes("delivery")
        ? Truck
        : factor.toLowerCase().includes("walk") || factor.toLowerCase().includes("staff")
          ? Users
          : factor.toLowerCase().includes("flood") || factor.toLowerCase().includes("drain")
            ? Droplets
            : ShieldAlert;
  return (
    <div
      className={cn(
        "card-interactive rounded-lg border p-3 animate-fade-in-up",
        riskBgClass(level),
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", riskBgClass(level))}>
            <FactorIcon className={cn("h-3.5 w-3.5", riskColorClass(level))} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold truncate">{factor}</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">{reasoning}</p>
          </div>
        </div>
        <div className={cn("text-base font-bold tabular-nums shrink-0", riskColorClass(level))}>
          {weightPct}
          <span className="text-[10px] font-medium opacity-70">%</span>
        </div>
      </div>
      <div className="mt-2 progress-bar-slim">
        <div
          className={cn("h-full rounded-full", barClass)}
          style={{
            width: mounted ? `${weightPct}%` : "0%",
            transition: "width 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Slot card with color-coded left border ───────────────────────────
function SlotCard({ slot, plan }: { slot: SlotPlan; plan: ActionPlan }) {
  const Icon = slot.slot === "lunch" ? Sun : Moon;
  // Per-slot risk proxy: max absolute delta across prep / walk-in / delivery / staffing
  const slotRiskScore = Math.min(
    1,
    Math.max(
      Math.abs(slot.prepBatchDelta) / 100,
      Math.abs(slot.expectedWalkInDelta) / 100,
      Math.abs(slot.expectedDeliveryDelta) / 100,
      Math.abs(slot.staffingDelta) / 20,
    ) + slot.warnings.length * 0.08,
  );
  const slotLevel = riskLevel(slotRiskScore);
  const borderClass =
    slotLevel === "low"
      ? "border-l-[var(--risk-low)]"
      : slotLevel === "medium"
        ? "border-l-[var(--risk-medium)]"
        : slotLevel === "high"
          ? "border-l-[var(--risk-high)]"
          : "border-l-[var(--risk-critical)]";

  // Campaign focus tag: derive from the largest delta direction
  const focusTag =
    slot.expectedDeliveryDelta < -5
      ? "Delivery boost"
      : slot.expectedWalkInDelta < -10
        ? "Walk-in recovery"
        : slot.prepBatchDelta < -10
          ? "Prep throttle"
          : "Hold the line";

  return (
    <div
      className={cn(
        "card-interactive rounded-lg border border-l-4 bg-card p-4 animate-fade-in-up",
        borderClass,
      )}
      style={{ animationDelay: `${slot.slot === "lunch" ? 80 : 160}ms`, animationFillMode: "backwards" }}
    >
      {/* Window header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md brand-gradient text-white">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold capitalize">{slot.slot}</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">{slot.windowLabel}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <RiskBadge score={slotRiskScore} />
          <Badge variant="outline" className="gap-1 text-[10px] border-brand/40 bg-brand/5 text-[var(--brand)]">
            <Megaphone className="h-2.5 w-2.5" />
            {focusTag}
          </Badge>
        </div>
      </div>

      <Separator className="my-3" />

      {/* Big metric tiles */}
      <div className="grid grid-cols-2 gap-3">
        <LargeDelta
          value={slot.prepBatchDelta}
          invert
          icon={ChefHat}
          label="Prep batch Δ"
        />
        <LargeDelta
          value={slot.staffingDelta}
          suffix=""
          icon={Users}
          label="Staffing Δ"
        />
        <LargeDelta
          value={slot.expectedWalkInDelta}
          icon={Users}
          label="Walk-in Δ"
        />
        <LargeDelta
          value={slot.expectedDeliveryDelta}
          icon={Truck}
          label="Delivery Δ"
        />
      </div>

      <Separator className="my-3" />

      {/* Secondary deltas */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Packaging</span>
        <DeltaPill value={slot.packagingDelta} />
        <span className="text-muted-foreground ml-1">Readiness</span>
        <DeliveryReadinessPill slot={slot} />
      </div>

      {slot.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {slot.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 rounded-md risk-bg-high risk-border-high border p-2 text-[11px]"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 risk-text-high" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryReadinessPill({ slot }: { slot: SlotPlan }) {
  // Delivery readiness: inverse of |delivery delta| + warning penalty
  const disruption = Math.min(100, Math.abs(slot.expectedDeliveryDelta) + slot.warnings.length * 8);
  const ready = 100 - disruption;
  const level: RiskLevel = ready >= 70 ? "low" : ready >= 40 ? "medium" : ready >= 20 ? "high" : "critical";
  return (
    <Badge variant="outline" className={cn("border gap-1 tabular-nums", riskBgClass(level), riskColorClass(level))}>
      <Truck className="h-3 w-3" />
      {ready}%
    </Badge>
  );
}

// ─── Top action card ──────────────────────────────────────────────────
interface TopAction {
  number: number;
  category: string;
  icon: React.ElementType;
  priority: "critical" | "high" | "medium" | "low";
  text: string;
  impact: string;
  accent: string;
}

function TopActionCard({ action }: { action: TopAction }) {
  const priorityClass =
    action.priority === "critical"
      ? "risk-bg-critical risk-border-critical risk-text-critical"
      : action.priority === "high"
        ? "risk-bg-high risk-border-high risk-text-high"
        : action.priority === "medium"
          ? "risk-bg-medium risk-border-medium risk-text-medium"
          : "risk-bg-low risk-border-low risk-text-low";
  return (
    <div
      className="card-interactive rounded-lg border bg-card p-3 animate-fade-in-up"
      style={{ animationDelay: `${action.number * 70}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md brand-gradient text-white text-xs font-bold tabular-nums">
          {action.number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("border gap-1 text-[10px] font-bold uppercase tracking-wide", priorityClass)}>
              {action.priority}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px] border-brand/30 bg-brand/5 text-[var(--brand)]">
              <action.icon className="h-2.5 w-2.5" />
              {action.category}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed">{action.text}</p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Sparkles className="h-2.5 w-2.5 text-[var(--brand)]" />
            Expected impact: <span className="text-foreground font-medium">{action.impact}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Warning list (kept for backward compat) ──────────────────────────
function WarningList({
  title,
  icon: Icon,
  items,
  level = "high",
}: {
  title: string;
  icon: React.ElementType;
  items: string[];
  level?: "high" | "critical";
}) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", riskColorClass(level))} />
        {title}
        <Badge variant="outline" className={cn("border tabular-nums", riskBgClass(level), riskColorClass(level))}>
          {items.length}
        </Badge>
      </div>
      <div className="space-y-1">
        {items.map((w, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-1.5 rounded-md border p-2 text-xs",
              riskBgClass(level),
              riskColorClass(level),
            )}
          >
            <Icon className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="text-foreground">{w}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Campaign callout ─────────────────────────────────────────────────
function CampaignCallout({ plan }: { plan: ActionPlan }) {
  const level = riskLevel(plan.overallRisk);
  const weatherTag =
    level === "critical"
      ? "Severe-weather surge"
      : level === "high"
        ? "Rain-shield boost"
        : level === "medium"
          ? "Demand-stabilize"
          : "Always-on promo";
  const channel =
    plan.slots.some((s) => s.expectedDeliveryDelta < -5) ? "Delivery apps"
      : plan.slots.some((s) => s.expectedWalkInDelta < -10) ? "Walk-in & dine-in"
        : "All channels";
  const budgetMultiplier =
    level === "critical" ? "2.0×" : level === "high" ? "1.5×" : level === "medium" ? "1.2×" : "1.0×";
  return (
    <div
      className={cn(
        "rounded-lg border p-4 animate-fade-in-up",
        riskBgClass(level),
        riskColorClass(level),
      )}
      style={{ animationDelay: "120ms", animationFillMode: "backwards" }}
    >
      <div className="flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", riskBgClass(level))}>
          <Megaphone className={cn("h-5 w-5", riskColorClass(level))} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold">Campaign focus</span>
            <Badge variant="outline" className={cn("border gap-1 text-[10px]", riskBgClass(level), riskColorClass(level))}>
              {weatherTag}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-foreground/90">{plan.campaignRecommendation}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1 text-[10px] border-brand/30 bg-brand/5 text-[var(--brand)]">
              <ArrowRight className="h-2.5 w-2.5" />
              {channel}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px] border-brand/30 bg-brand/5 text-[var(--brand)]">
              <Gauge className="h-2.5 w-2.5" />
              Budget {budgetMultiplier}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Derive top actions from the plan ─────────────────────────────────
function deriveTopActions(plan: ActionPlan): TopAction[] {
  const overallLevel = riskLevel(plan.overallRisk);
  const basePriority: TopAction["priority"] =
    overallLevel === "critical" || overallLevel === "high"
      ? "critical"
      : overallLevel === "medium"
        ? "high"
        : "medium";
  const actions: TopAction[] = [
    {
      number: 1,
      category: "Prep",
      icon: ChefHat,
      priority: basePriority,
      text: plan.prepRecommendation,
      impact: "Protects throughput & reduces waste",
      accent: "text-[var(--brand)]",
    },
    {
      number: 2,
      category: "Inventory",
      icon: Package,
      priority: overallLevel === "critical" ? "critical" : "high",
      text: plan.inventoryRecommendation,
      impact: "Avoids stockout on key SKUs",
      accent: "text-amber-600 dark:text-amber-400",
    },
    {
      number: 3,
      category: "Staffing",
      icon: Users,
      priority: overallLevel === "critical" ? "high" : "medium",
      text: plan.staffingRecommendation,
      impact: "Right-sized crew for the window",
      accent: "text-violet-600 dark:text-violet-400",
    },
    {
      number: 4,
      category: "Delivery",
      icon: Bike,
      priority: overallLevel === "high" || overallLevel === "critical" ? "high" : "medium",
      text: plan.deliveryReadiness,
      impact: "Maintains delivery SLA in weather",
      accent: "text-teal-600 dark:text-teal-400",
    },
    {
      number: 5,
      category: "Campaign",
      icon: Megaphone,
      priority: "low",
      text: plan.campaignRecommendation,
      impact: "Stabilises demand via promo",
      accent: "text-rose-600 dark:text-rose-400",
    },
  ];
  return actions;
}

// ─── Main panel ───────────────────────────────────────────────────────
export function ActionPlanPanel({ plan }: { plan: ActionPlan }) {
  const sortedRisks = React.useMemo(
    () => [...plan.risks].sort((a, b) => b.weight - a.weight),
    [plan.risks],
  );
  const topActions = React.useMemo(() => deriveTopActions(plan), [plan]);

  // Peak risk time: the slot with the higher computed risk
  const peakSlot = React.useMemo(() => {
    const scored = plan.slots.map((s) => {
      const score = Math.min(
        1,
        Math.max(
          Math.abs(s.prepBatchDelta) / 100,
          Math.abs(s.expectedWalkInDelta) / 100,
          Math.abs(s.expectedDeliveryDelta) / 100,
          Math.abs(s.staffingDelta) / 20,
        ) + s.warnings.length * 0.08,
      );
      return { slot: s, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.slot ?? plan.slots[0];
  }, [plan.slots]);

  const generatedLabel = formatTime(plan.generatedAt);
  const overallLevel = riskLevel(plan.overallRisk);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg brand-gradient text-white shadow-sm">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base leading-tight">Daily Action Plan</CardTitle>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                Prep · Staffing · Delivery · Campaign
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Targeting <span className="font-semibold text-foreground">{plan.planningDate}</span> · generated{" "}
                <span className="tabular-nums">{generatedLabel}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <RiskBadge score={plan.overallRisk} label="Overall risk" className="text-sm px-2.5 py-1" />
            <ConfidenceBadge confidence={plan.confidence} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats row */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryStat icon={Gauge} label="Overall Risk" accent={riskColorClass(overallLevel)}>
            <div className="flex items-center gap-2">
              <RiskGauge score={plan.overallRisk} size={44} />
              <div className="min-w-0">
                <div className={cn("text-xs font-bold uppercase tracking-wide", riskColorClass(overallLevel))}>
                  {overallLevel}
                </div>
                <div className="text-[10px] text-muted-foreground">store risk</div>
              </div>
            </div>
          </SummaryStat>
          <SummaryStat icon={Sparkles} label="Confidence" accent="text-[var(--brand)]">
            <ConfidenceBar confidence={plan.confidence} />
          </SummaryStat>
          <SummaryStat icon={ListChecks} label="Top Actions" accent="text-[var(--brand)]">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tabular-nums leading-tight">{topActions.length}</span>
              <span className="text-[10px] text-muted-foreground">prioritised</span>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {topActions.filter((a) => a.priority === "critical" || a.priority === "high").length} high-priority
            </div>
          </SummaryStat>
          <SummaryStat icon={Clock} label="Peak Risk Time" accent={riskColorClass(overallLevel)}>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tabular-nums leading-tight capitalize">{peakSlot?.slot}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">{peakSlot?.windowLabel}</div>
          </SummaryStat>
        </div>

        {/* Risk summary */}
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <ShieldAlert className="h-3 w-3 text-[var(--brand)]" />
            Store risk summary
          </div>
          <p className="mt-1 text-sm leading-relaxed">{plan.storeRiskSummary}</p>
        </div>

        {/* Risk factors */}
        {sortedRisks.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5 text-[var(--brand)]" />
                Risk factors
              </div>
              <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                sorted by weight
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 max-h-72 overflow-y-auto pr-1">
              {sortedRisks.map((r, i) => (
                <RiskFactorCard key={`${r.factor}-${i}`} index={i} {...r} />
              ))}
            </div>
          </div>
        )}

        {/* Time slots */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-[var(--brand)]" />
            Slot plans
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plan.slots.map((s) => (
              <SlotCard key={s.slot} slot={s} plan={plan} />
            ))}
          </div>
        </div>

        {/* Campaign callout */}
        <CampaignCallout plan={plan} />

        {/* Top actions */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5 text-[var(--brand)]" />
              Top actions
            </div>
            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
              {topActions.length} recommended
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {topActions.map((a) => (
              <TopActionCard key={a.number} action={a} />
            ))}
          </div>
        </div>

        {/* Warnings */}
        {(plan.wasteWarnings.length > 0 ||
          plan.stockoutWarnings.length > 0 ||
          plan.serviceDelayWarnings.length > 0) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <WarningList title="Waste risk" icon={AlertTriangle} items={plan.wasteWarnings} level="high" />
            <WarningList title="Stockout risk" icon={PackageX} items={plan.stockoutWarnings} level="critical" />
            <WarningList title="Service delay" icon={Timer} items={plan.serviceDelayWarnings} level="high" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
