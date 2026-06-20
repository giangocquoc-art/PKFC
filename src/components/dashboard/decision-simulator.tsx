"use client";

import * as React from "react";
import {
  FlaskConical,
  Loader2,
  RotateCcw,
  Play,
  CloudRain,
  Sun,
  Bike,
  Footprints,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Info,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/language-provider";
import { riskLevel, riskColorClass, riskBgClass } from "./shared";
import type { RiskLevel } from "./shared";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client/fetchJson";

interface SimResult {
  original: { rainRiskScore: number; heatRiskScore: number; deliveryDisruptionRisk: number; walkInDropRisk: number; overallRisk: number };
  overridden: { rainRiskScore: number; heatRiskScore: number; deliveryDisruptionRisk: number; walkInDropRisk: number; overallRisk: number };
  plan: {
    overallRisk: number;
    confidence: number;
    storeRiskSummary: string;
    prepRecommendation: string;
    staffingRecommendation: string;
    deliveryReadiness: string;
    campaignRecommendation: string;
    slots: { slot: string; windowLabel: string; expectedWalkInDelta: number; expectedDeliveryDelta: number; prepBatchDelta: number; staffingDelta: number }[];
  };
  briefing: { headline: string; tldr: string[]; topActions: string[] };
  beforeAfter: { key: string; label: string; withoutAgent: number; withAgent: number; unit: string; betterIs: string }[];
  isLive: boolean;
  note: string;
}

type SliderKey = "rainRiskScore" | "heatRiskScore" | "deliveryDisruptionRisk" | "walkInDropRisk";

interface SliderConfig {
  key: SliderKey;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const SLIDERS: SliderConfig[] = [
  {
    key: "rainRiskScore",
    label: "Rủi ro Mưa",
    icon: CloudRain,
    color: "text-blue-500",
    description: "Xác suất lượng mưa đáng kể làm gián đoạn lượng khách ăn tại chỗ và giao hàng chặng cuối. Lấy từ dự báo lượng mưa Open-Meteo.",
  },
  {
    key: "heatRiskScore",
    label: "Rủi ro Nắng nóng",
    icon: Sun,
    color: "text-orange-500",
    description: "Rủi ro do nhiệt độ cực cao làm giảm lượt khách ghé và gây quá tải thiết bị bếp. Được tính toán từ nhiệt độ cảm nhận.",
  },
  {
    key: "deliveryDisruptionRisk",
    label: "Rủi ro Giao hàng",
    icon: Bike,
    color: "text-teal-500",
    description: "Mức độ gián đoạn dự kiến đối với đối tác giao hàng (tài xế) do mưa, ngập đường hoặc tầm nhìn kém. Được tính trọng số lớn nhất trong rủi ro tổng thể.",
  },
  {
    key: "walkInDropRisk",
    label: "Khách vào giảm",
    icon: Footprints,
    color: "text-violet-500",
    description: "Lượng khách ăn tại chỗ / ghé mua mang đi dự kiến sụt giảm do thời tiết bất lợi. Cao hơn ở các cửa hàng trong trung tâm thương mại & văn phòng khi có giông bão.",
  },
];

// ═══════════════════════════════════════════════════════════════
// useCountUp — animates a number from its previous value to target
// ═══════════════════════════════════════════════════════════════
function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = React.useState(target);
  const fromRef = React.useRef(target);
  const startRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

function CountUp({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const animated = useCountUp(value);
  return (
    <span className={cn("tabular-nums", className)}>{animated.toFixed(0)}{suffix}</span>
  );
}

// ═══════════════════════════════════════════════════════════════
// RiskLegend — color spectrum legend (green → amber → orange → red)
// ═══════════════════════════════════════════════════════════════
function RiskLegend() {
  const items: { label: string; range: string; cls: string; dot: string }[] = [
    { label: "Low", range: "0–30%", cls: "risk-text-low", dot: "bg-[var(--risk-low)]" },
    { label: "Medium", range: "30–50%", cls: "risk-text-medium", dot: "bg-[var(--risk-medium)]" },
    { label: "High", range: "50–70%", cls: "risk-text-high", dot: "bg-[var(--risk-high)]" },
    { label: "Critical", range: "70–100%", cls: "risk-text-critical", dot: "bg-[var(--risk-critical)]" },
  ];
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Info className="h-3 w-3" />
        Risk Color Legend
      </div>
      {/* Continuous gradient bar */}
      <div
        className="mb-2 h-2 w-full rounded-full"
        style={{
          background:
            "linear-gradient(90deg, var(--risk-low) 0%, var(--risk-medium) 33%, var(--risk-high) 66%, var(--risk-critical) 100%)",
        }}
      />
      <div className="grid grid-cols-4 gap-1">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col items-center gap-0.5 text-center">
            <span className="flex items-center gap-1">
              <span className={cn("inline-block h-2 w-2 rounded-full", it.dot)} />
              <span className={cn("text-[10px] font-bold", it.cls)}>{it.label}</span>
            </span>
            <span className="text-[9px] text-muted-foreground">{it.range}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SliderCard — enhanced risk slider with gradient track, large
// value, risk-level label, min/max labels, and tooltip
// ═══════════════════════════════════════════════════════════════
function SliderCard({
  config,
  value,
  onChange,
}: {
  config: SliderConfig;
  value: number;
  onChange: (v: number) => void;
}) {
  const Icon = config.icon;
  const level = riskLevel(value) as RiskLevel;
  const pct = Math.round(value * 100);

  const levelLabelMap: Record<RiskLevel, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  };

  return (
    <div className="rounded-lg border bg-card p-3 transition-colors hover:border-[var(--brand)]/30">
      {/* Header: label + tooltip + large value */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", config.color)} />
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-1 text-xs font-medium">
                  {config.label}
                  <Info className="h-3 w-3 text-muted-foreground/70" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px]">
                <p className="text-xs leading-snug">{config.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {/* Risk-level pill */}
        <Badge
          variant="outline"
          className={cn("h-5 px-1.5 text-[10px] font-bold", riskBgClass(level), riskColorClass(level))}
        >
          {levelLabelMap[level]}
        </Badge>
      </div>

      {/* Large value display */}
      <div className="mb-2 flex items-baseline gap-1">
        <span className={cn("text-3xl font-black leading-none tabular-nums", riskColorClass(level))}>
          {pct}
        </span>
        <span className={cn("text-sm font-bold", riskColorClass(level))}>%</span>
      </div>

      {/* Slider with gradient track */}
      <div className="relative py-1">
        {/* Gradient track background — sits behind the (transparent) slider track */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-90"
          style={{
            background:
              "linear-gradient(90deg, var(--risk-low) 0%, var(--risk-medium) 33%, var(--risk-high) 66%, var(--risk-critical) 100%)",
          }}
        />
        <Slider
          value={[pct]}
          onValueChange={(v) => onChange(v[0] / 100)}
          min={0}
          max={100}
          step={5}
          className="relative [&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-track]]:ring-1 [&_[data-slot=slider-track]]:ring-black/5 [&_[data-slot=slider-range]]:bg-transparent"
        />
      </div>

      {/* Min / Max labels */}
      <div className="mt-1 flex justify-between text-[9px] font-medium text-muted-foreground">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ComparisonRow — Live vs Simulated delta row
// ═══════════════════════════════════════════════════════════════
function ComparisonRow({
  label,
  live,
  simulated,
}: {
  label: string;
  live: number;
  simulated: number;
}) {
  const liveLevel = riskLevel(live) as RiskLevel;
  const simLevel = riskLevel(simulated) as RiskLevel;
  const deltaPct = (simulated - live) * 100;
  const changed = Math.abs(deltaPct) >= 0.5;
  // For risk scores: lower is better → negative delta = improvement (green), positive = worse (red)
  const isImprovement = deltaPct < 0;
  const isWorse = deltaPct > 0;

  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center gap-2 rounded-md px-2 py-1.5 text-xs odd:bg-muted/30 hover:bg-accent/40 transition-colors">
      <span className="font-medium text-foreground">{label}</span>
      <span className={cn("text-center font-bold tabular-nums", riskColorClass(liveLevel))}>
        <CountUp value={live * 100} suffix="%" />
      </span>
      <span className={cn("text-center font-bold tabular-nums", riskColorClass(simLevel))}>
        <CountUp value={simulated * 100} suffix="%" />
      </span>
      <span
        className={cn(
          "flex items-center justify-center gap-0.5 text-center font-bold tabular-nums",
          !changed && "text-muted-foreground",
          changed && isImprovement && "risk-text-low",
          changed && isWorse && "risk-text-high",
        )}
      >
        {changed ? (
          <>
            {isWorse ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {deltaPct > 0 ? "+" : ""}
            {deltaPct.toFixed(0)}%
          </>
        ) : (
          <>
            <Minus className="h-3 w-3" />0%
          </>
        )}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════
export function DecisionSimulator({ storeId }: { storeId: string | null }) {
  const t = useT();
  const [overrides, setOverrides] = React.useState<Record<SliderKey, number>>({
    rainRiskScore: 0.6,
    heatRiskScore: 0.3,
    deliveryDisruptionRisk: 0.5,
    walkInDropRisk: 0.5,
  });
  const [result, setResult] = React.useState<SimResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  // Track the overrides used to compute the current result, so we can show a
  // "re-run needed" pulse when sliders have changed since the last run.
  const [lastRunOverrides, setLastRunOverrides] = React.useState<Record<SliderKey, number> | null>(null);

  React.useEffect(() => {
    queueMicrotask(() => {
      setOverrides({ rainRiskScore: 0.6, heatRiskScore: 0.3, deliveryDisruptionRisk: 0.5, walkInDropRisk: 0.5 });
      setResult(null);
      setLastRunOverrides(null);
    });
  }, [storeId]);

  const runSimulation = React.useCallback(async () => {
    if (!storeId || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, overrides }),
      });
      if (!res.ok) throw new Error(`simulate failed: ${res.status}`);
      const data: SimResult = await fetchJson(res.url);
      setResult(data);
      setLastRunOverrides(overrides);
      toast.success("Simulation complete — see how the plan changes");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }, [storeId, overrides, loading]);

  const reset = React.useCallback(() => {
    setOverrides({ rainRiskScore: 0.6, heatRiskScore: 0.3, deliveryDisruptionRisk: 0.5, walkInDropRisk: 0.5 });
    setResult(null);
    setLastRunOverrides(null);
  }, []);

  // Detect if sliders have changed since the last successful run
  const slidersDirty = React.useMemo(() => {
    if (!lastRunOverrides) return false;
    return (Object.keys(overrides) as SliderKey[]).some(
      (k) => Math.abs(overrides[k] - lastRunOverrides[k]) > 0.001,
    );
  }, [overrides, lastRunOverrides]);

  const confidenceLevel = result ? (result.plan.confidence >= 0.75 ? "High" : result.plan.confidence >= 0.5 ? "Medium" : "Low") : null;
  const confLevelCls = result
    ? riskLevel(1 - result.plan.confidence)
    : "low";

  return (
    <Card className="overflow-hidden border-[var(--brand)]/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4 text-[var(--brand)]" />
              Decision Simulator — What-If Explorer
            </CardTitle>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              Adjust risk sliders → see how the plan changes.
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      <Info className="h-2.5 w-2.5" />
                      NOT persisted
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[300px]">
                    <p className="text-xs leading-snug">
                      This simulator runs the full agent pipeline with your custom risk values but
                      <strong> does not write to the database</strong>. The live action plan shown
                      in the Operations view is unaffected. Close this panel or hit Reset to discard.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={reset} className="h-7 gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sliders */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SLIDERS.map((s) => (
            <SliderCard
              key={s.key}
              config={s}
              value={overrides[s.key]}
              onChange={(v) => setOverrides((prev) => ({ ...prev, [s.key]: v }))}
            />
          ))}
        </div>

        {/* Risk legend */}
        <RiskLegend />

        {/* Run Simulation button — prominent, brand gradient, pulse when dirty */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={runSimulation}
                disabled={loading || !storeId}
                className={cn(
                  "relative w-full gap-2 overflow-hidden border-0 text-white shadow-md transition-all",
                  "brand-gradient-vivid hover:shadow-lg hover:brightness-110",
                  !storeId && "opacity-60",
                )}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="h-4 w-4" />
                )}
                {loading ? "Simulating…" : "Run Simulation"}
                {!loading && slidersDirty && (
                  <span className="absolute right-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/90">
                    <Zap className="h-3 w-3" />
                    Re-run
                  </span>
                )}
                {/* Pulse ring when sliders changed since last run */}
                {!loading && slidersDirty && (
                  <span className="absolute inset-0 -z-0 animate-ping rounded-md bg-white/20" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px]">
              <p className="text-xs leading-snug">
                Re-runs the 8-agent pipeline using your overridden risk values. The simulated plan,
                briefing, and impact metrics below will refresh. Takes ~3–6 seconds.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {!storeId && (
          <p className="text-center text-[10px] text-muted-foreground">Select a store to enable simulation.</p>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3 animate-fade-in-up">
            <Separator />

            {/* Confidence + summary bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" />
                <span className="font-semibold">Simulated confidence</span>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 cursor-help text-muted-foreground/70" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[300px]">
                      <p className="text-xs leading-snug">
                        Confidence is the agent&apos;s self-reported score: weighted blend of weather
                        data freshness (live vs fallback), source coverage (rain + heat + delivery +
                        walk-in all available), and rule-base agreement with the LLM recommendation.
                        Higher = more trustworthy simulated plan.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "tabular-nums text-[10px] font-bold",
                    riskBgClass(confLevelCls as RiskLevel),
                    riskColorClass(confLevelCls as RiskLevel),
                  )}
                >
                  {confidenceLevel} · {(result.plan.confidence * 100).toFixed(0)}%
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  Overall risk: <span className={cn("font-bold", riskColorClass(riskLevel(result.overridden.overallRisk) as RiskLevel))}>{(result.overridden.overallRisk * 100).toFixed(0)}%</span>
                </span>
              </div>
            </div>

            {/* ═══ Comparison table: Live Plan vs Simulated Plan ═══ */}
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <ArrowRight className="h-3 w-3" />
                Live Plan vs Simulated Plan
              </div>
              <div className="overflow-hidden rounded-lg border">
                {/* Header row */}
                <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 bg-muted/60 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <span>Risk Factor</span>
                  <span className="text-center">Live</span>
                  <span className="text-center">Simulated</span>
                  <span className="text-center">Delta</span>
                </div>
                <ComparisonRow label="Overall" live={result.original.overallRisk} simulated={result.overridden.overallRisk} />
                <ComparisonRow label="Rain" live={result.original.rainRiskScore} simulated={result.overridden.rainRiskScore} />
                <ComparisonRow label="Heat" live={result.original.heatRiskScore} simulated={result.overridden.heatRiskScore} />
                <ComparisonRow label="Delivery" live={result.original.deliveryDisruptionRisk} simulated={result.overridden.deliveryDisruptionRisk} />
                <ComparisonRow label="Walk-in" live={result.original.walkInDropRisk} simulated={result.overridden.walkInDropRisk} />
              </div>
              <p className="mt-1 text-[9px] text-muted-foreground">
                <span className="risk-text-low">▼ green</span> = improvement (lower risk) ·{" "}
                <span className="risk-text-high">▲ red</span> = worse (higher risk)
              </p>
            </div>

            {/* Simulated briefing */}
            <div className="rounded-lg brand-gradient p-3 text-white">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/80">
                <Sparkles className="h-3 w-3" />
                Simulated Briefing Headline
              </div>
              <p className="mt-1 text-sm font-semibold leading-snug">{result.briefing.headline}</p>
            </div>

            {/* Simulated plan deltas */}
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Simulated Slot Plan</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {result.plan.slots.map((s) => (
                  <div key={s.slot} className="rounded-md border bg-card p-2">
                    <div className="text-xs font-semibold capitalize">{s.slot} · {s.windowLabel}</div>
                    <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                      <span>walk-in <span className="font-semibold text-foreground">{s.expectedWalkInDelta >= 0 ? "+" : ""}{s.expectedWalkInDelta}%</span></span>
                      <span>delivery <span className="font-semibold text-foreground">{s.expectedDeliveryDelta >= 0 ? "+" : ""}{s.expectedDeliveryDelta}%</span></span>
                      <span>prep <span className="font-semibold text-foreground">{s.prepBatchDelta >= 0 ? "+" : ""}{s.prepBatchDelta}%</span></span>
                      <span>staff <span className="font-semibold text-foreground">{s.staffingDelta >= 0 ? "+" : ""}{s.staffingDelta}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top simulated actions */}
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Simulated Top Actions</div>
              <ol className="space-y-1">
                {result.briefing.topActions.slice(0, 3).map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[9px] font-bold text-white">{i + 1}</span>
                    <span className="pt-0.5">{a}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Before/after mini comparison */}
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Simulated Impact</div>
              <div className="space-y-1.5">
                {result.beforeAfter.slice(0, 4).map((m) => {
                  const improved = m.betterIs === "lower" ? m.withAgent < m.withoutAgent : m.withAgent > m.withoutAgent;
                  return (
                    <div key={m.key} className="flex items-center justify-between gap-2 rounded-md border bg-card p-1.5 text-[11px]">
                      <span className="font-medium">{m.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{m.withoutAgent.toFixed(0)}{m.unit}</span>
                        <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className={cn("font-bold tabular-nums", improved ? "risk-text-low" : "risk-text-high")}>{m.withAgent.toFixed(0)}{m.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border bg-amber-500/5 p-2 text-[10px] text-muted-foreground">
              <FlaskConical className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
              <span>{result.note}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
