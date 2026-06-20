"use client";

import * as React from "react";
import {
  Store,
  Clock,
  Radio,
  AlertTriangle,
  Activity,
  Lightbulb,
  ChefHat,
  Megaphone,
  ShieldCheck,
  Loader2,
  Building2,
  ShoppingBag,
  Home,
  Train,
  MapPin,
  TrendingUp,
  Snowflake,
  PackageOpen,
  Users,
  Timer,
  Soup,
  Trash2,
  Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type {
  StoreOperatingProfile,
  TimeWindow,
  ChannelMix,
  StoreRisk,
  OperatingStoreType,
  MonitoredMetric,
} from "@/lib/storeProfile/storeOperatingProfile";
import { OPERATING_TYPE_LABELS } from "@/lib/storeProfile/storeOperatingProfile";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Static configuration                                              */
/* ------------------------------------------------------------------ */

const INTENSITY_STYLES: Record<TimeWindow["intensity"], string> = {
  peak: "bg-rose-500/80 text-white",
  high: "bg-orange-500/75 text-white",
  moderate: "bg-amber-500/70 text-amber-950",
  low: "bg-sky-500/60 text-sky-950",
  prep: "bg-violet-500/70 text-white",
};

const INTENSITY_TRACK_STYLES: Record<TimeWindow["intensity"], string> = {
  peak: "bg-rose-500",
  high: "bg-orange-500",
  moderate: "bg-amber-500",
  low: "bg-sky-500",
  prep: "bg-violet-500",
};

const INTENSITY_LABEL_STYLES: Record<TimeWindow["intensity"], string> = {
  peak: "text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10",
  high: "text-orange-600 dark:text-orange-400 border-orange-500/40 bg-orange-500/10",
  moderate: "text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10",
  low: "text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10",
  prep: "text-violet-600 dark:text-violet-400 border-violet-500/40 bg-violet-500/10",
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  "dine-in": Store,
  takeaway: ChefHat,
  delivery: Radio,
  "online-order": Activity,
};

const CHANNEL_COLORS: Record<string, string> = {
  "dine-in": "oklch(0.6 0.18 27)", // brand
  takeaway: "oklch(0.65 0.15 150)", // green
  delivery: "oklch(0.6 0.18 230)", // blue
  "online-order": "oklch(0.62 0.16 300)", // violet
};

const RISK_ICONS: Record<string, React.ElementType> = {
  "over-prep": Soup,
  stockout: PackageOpen,
  "understaff-peak": Users,
  "delivery-delay": Timer,
  "wrong-campaign-channel": Megaphone,
  "complaint-slow": Receipt,
};

const METRIC_ICONS: Record<string, React.ElementType> = {
  weather: CloudIcon,
  "walk-in": Store,
  delivery: Radio,
  takeaway: ChefHat,
  inventory: PackageOpen,
  "batch-prep": Soup,
  waste: Trash2,
  stockout: AlertTriangle,
  staff: Users,
  "service-time": Timer,
  complaints: Receipt,
  refund: Receipt,
};

function CloudIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M17.5 19a4.5 4.5 0 0 0 0-9h-1.8A7 7 0 1 0 4 15.3" />
      <path d="M8 19h9.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Operating-type meta                                               */
/* ------------------------------------------------------------------ */

const OPERATING_TYPE_META: Record<
  OperatingStoreType,
  { icon: React.ElementType; emoji: string; description: string; characteristics: string[] }
> = {
  "urban-center": {
    icon: Building2,
    emoji: "🏙️",
    description: "High-volume downtown store — office-worker lunch surge + delivery.",
    characteristics: ["Lunch-skewed demand", "Walk-in collapses in rain", "Heavy delivery surge"],
  },
  mall: {
    icon: ShoppingBag,
    emoji: "🏬",
    description: "In-mall store — shelter effect keeps footfall steady in rain.",
    characteristics: ["Shelter effect on rain", "Family dine-in heavy", "Aligned to mall hours"],
  },
  residential: {
    icon: Home,
    emoji: "🏘️",
    description: "Neighborhood store — dinner peak + family delivery.",
    characteristics: ["Dinner-skewed demand", "Family combo orders", "Delivery packaging buffer"],
  },
  commuter: {
    icon: Train,
    emoji: "🚉",
    description: "Transit hub store — rush-hour takeaway + delivery delays.",
    characteristics: ["Rush-hour batches", "Takeaway campaign fit", "Traffic-sensitive delivery"],
  },
  suburban: {
    icon: MapPin,
    emoji: "🌄",
    description: "Outer-district store — delivery-dominant, slow replenishment.",
    characteristics: ["Delivery-dominant", "Slow replenishment", "Long rider distances"],
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function riskColor(p: number): string {
  if (p >= 0.4) return "risk-text-high";
  if (p >= 0.25) return "risk-text-medium";
  return "risk-text-low";
}

function riskBg(p: number): string {
  if (p >= 0.4) return "risk-bg-high risk-border-high";
  if (p >= 0.25) return "risk-bg-medium risk-border-medium";
  return "risk-bg-low risk-border-low";
}

function useCurrentHour(): number {
  const [hour, setHour] = React.useState(() => {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  });
  React.useEffect(() => {
    const id = window.setInterval(() => {
      const now = new Date();
      setHour(now.getHours() + now.getMinutes() / 60);
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return hour;
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    return `${days} d ago`;
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/*  24h Timeline visualization                                         */
/* ------------------------------------------------------------------ */

function TimeWindowsTimeline({ windows }: { windows: TimeWindow[] }) {
  const currentHour = useCurrentHour();
  const currentPct = (currentHour / 24) * 100;

  return (
    <div className="space-y-2">
      {/* The bar itself */}
      <div className="relative h-9 w-full overflow-hidden rounded-lg border bg-muted/30">
        {/* Hour grid lines */}
        {[6, 12, 18].map((h) => (
          <div
            key={h}
            className="absolute top-0 bottom-0 border-l border-dashed border-foreground/10"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}
        {/* Time window segments */}
        {windows.map((tw) => {
          const leftPct = (tw.startHour / 24) * 100;
          const widthPct = ((tw.endHour - tw.startHour) / 24) * 100;
          return (
            <Tooltip key={tw.id}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "absolute top-0 bottom-0 flex items-center justify-center overflow-hidden border-r border-background/40 transition-all hover:brightness-110",
                    INTENSITY_STYLES[tw.intensity],
                  )}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                >
                  <span className="truncate px-1 text-[9px] font-bold uppercase tracking-wide">
                    {tw.label}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="font-semibold">{tw.label}</div>
                <div className="text-muted-foreground">
                  {tw.startHour.toString().padStart(2, "0")}:00–
                  {tw.endHour.toString().padStart(2, "0")}:00 · {tw.intensity}
                </div>
                <div className="mt-0.5 max-w-[200px] text-[11px] text-muted-foreground">
                  {tw.focus}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {/* Current-time indicator */}
        <div
          className="absolute top-0 bottom-0 z-10 w-0.5 bg-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.6)]"
          style={{ left: `${currentPct}%` }}
        >
          <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 rounded-sm bg-foreground" />
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1 py-0.5 text-[8px] font-bold text-background">
            NOW
          </div>
        </div>
      </div>

      {/* Hour axis */}
      <div className="relative flex justify-between text-[9px] font-medium text-muted-foreground">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>

      {/* Segment labels */}
      <div className="flex flex-wrap gap-1">
        {windows.map((tw) => (
          <Badge
            key={tw.id}
            variant="outline"
            className={cn("gap-1 text-[9px] uppercase", INTENSITY_LABEL_STYLES[tw.intensity])}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", INTENSITY_TRACK_STYLES[tw.intensity])} />
            {tw.label}
            <span className="opacity-70">
              {tw.startHour.toString().padStart(2, "0")}–{tw.endHour.toString().padStart(2, "0")}
            </span>
          </Badge>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Channel Mix donut chart                                            */
/* ------------------------------------------------------------------ */

function ChannelDonut({ channels }: { channels: ChannelMix[] }) {
  const size = 160;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute cumulative offsets via prefix sums (no mutable accumulator).
  const total = channels.reduce((acc, c) => acc + c.share, 0) || 1;
  const fractions = channels.map((c) => c.share / total);
  const prefixSums = fractions.reduce<number[]>((acc, f, i) => {
    acc.push((acc[i - 1] ?? 0) + f);
    return acc;
  }, []);
  const segments = channels.map((c, i) => {
    const fraction = fractions[i];
    const dash = fraction * circumference;
    const offset = -((prefixSums[i] ?? 0) - fraction) * circumference;
    return { channel: c, dash, offset, fraction };
  });

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="oklch(from var(--muted) l c h / 0.35)"
            strokeWidth={stroke}
          />
          {/* Segments */}
          {segments.map(({ channel, dash, offset }) => (
            <Tooltip key={channel.channel}>
              <TooltipTrigger asChild>
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={CHANNEL_COLORS[channel.channel] ?? "oklch(0.5 0 0)"}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                  className="transition-opacity hover:opacity-80"
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="font-semibold capitalize">{channel.channel}</div>
                <div className="text-muted-foreground">
                  {(channel.share * 100).toFixed(0)}% · {channel.weatherSensitivity} weather sensitivity
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Channel Mix
          </span>
          <span className="text-lg font-bold tabular-nums">100%</span>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-1.5">
        {channels.map((c) => {
          const Icon = CHANNEL_ICONS[c.channel] ?? Radio;
          const sensColor =
            c.weatherSensitivity === "high"
              ? "risk-text-high"
              : c.weatherSensitivity === "medium"
                ? "risk-text-medium"
                : "risk-text-low";
          return (
            <div
              key={c.channel}
              className="flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: CHANNEL_COLORS[c.channel] ?? "oklch(0.5 0 0)" }}
                />
                <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-[11px] font-medium capitalize">{c.channel}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold tabular-nums">{(c.share * 100).toFixed(0)}%</span>
                <Badge variant="outline" className={cn("h-4 px-1 text-[8px] uppercase", sensColor)}>
                  {c.weatherSensitivity}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Risk card                                                          */
/* ------------------------------------------------------------------ */

function RiskCard({ risk, index }: { risk: StoreRisk; index: number }) {
  const Icon = RISK_ICONS[risk.id] ?? AlertTriangle;
  const colorClass = riskColor(risk.baseProbability);
  const bgClass = riskBg(risk.baseProbability);
  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "card-interactive relative flex flex-col gap-1.5 rounded-lg border p-2.5 animate-fade-in-up",
          bgClass,
          `animate-delay-${Math.min(800, 100 * (index + 1))}`,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Icon className={cn("h-3.5 w-3.5", colorClass)} />
            <span className="text-[11px] font-semibold leading-tight">{risk.label}</span>
          </div>
          <span className={cn("text-sm font-bold tabular-nums", colorClass)}>
            {(risk.baseProbability * 100).toFixed(0)}%
          </span>
        </div>
        <div className="progress-bar-slim">
          <div
            className={cn(
              "progress-bar-fill",
              risk.baseProbability >= 0.4
                ? "bg-[var(--risk-high)]"
                : risk.baseProbability >= 0.25
                  ? "bg-[var(--risk-medium)]"
                  : "bg-[var(--risk-low)]",
            )}
            style={{ width: `${risk.baseProbability * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">
                <TrendingUp className="h-2.5 w-2.5" />×{risk.weatherAmplifier.toFixed(1)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Weather amplifier — risk multiplied by this factor when weather hits.
            </TooltipContent>
          </Tooltip>
          <span className="text-[9px] text-muted-foreground">base × weather</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */
/*  Monitored metric tile                                             */
/* ------------------------------------------------------------------ */

function MetricTile({ metric, index }: { metric: MonitoredMetric; index: number }) {
  const Icon = METRIC_ICONS[metric.id] ?? Activity;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "card-interactive flex items-center gap-1.5 rounded-md border bg-card p-1.5 animate-fade-in-up",
              metric.required ? "border-foreground/15" : "border-muted",
              `animate-delay-${Math.min(800, 100 * (index + 1))}`,
            )}
          >
            <Icon className={cn("h-3 w-3 shrink-0", metric.required ? "text-[var(--brand)]" : "text-muted-foreground")} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-semibold leading-tight">{metric.label}</div>
              <div className="text-[9px] text-muted-foreground">
                {metric.freshness} · {metric.source}
              </div>
            </div>
            {metric.required ? (
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
            ) : (
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="font-semibold">{metric.label}</div>
          <div className="text-muted-foreground">
            Source: {metric.source} · Freshness: {metric.freshness}
          </div>
          <div className="text-muted-foreground">
            {metric.required ? "Required — agent blocks without it." : "Optional — augments decisions."}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                        */
/* ------------------------------------------------------------------ */

export function StoreOperatingProfilePanel({
  profile,
  loading,
}: {
  profile: StoreOperatingProfile | null;
  loading: boolean;
}) {
  if (loading || !profile) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4 text-[var(--brand)]" />
            Store Operating Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const typeMeta = OPERATING_TYPE_META[profile.operatingType];
  const TypeIcon = typeMeta.icon;

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="overflow-hidden border-[var(--brand)]/20">
        <CardHeader className="pb-3">
          {/* Enhanced header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl brand-gradient text-white shadow-sm">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  Store Operating Profile
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Built before any decision agent runs · classifies the store to tailor every recommendation
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Generated {relativeTime(profile.generatedAt)} for <span className="font-semibold text-foreground">{profile.storeName}</span>
                </p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 gap-1 border-[var(--brand)]/40 text-[var(--brand)]">
              <TypeIcon className="h-3 w-3" />
              {OPERATING_TYPE_LABELS[profile.operatingType]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Store Type Card */}
          <div className="card-interactive rounded-lg border bg-card p-3 animate-fade-in-up">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg brand-gradient-vivid text-2xl text-white shadow-sm">
                {typeMeta.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <TypeIcon className="h-3.5 w-3.5 text-[var(--brand)]" />
                  <span className="text-sm font-bold">{OPERATING_TYPE_LABELS[profile.operatingType]}</span>
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] uppercase">{profile.storeType}</Badge>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{typeMeta.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {typeMeta.characteristics.map((c) => (
                    <Badge key={c} variant="outline" className="gap-1 text-[9px]">
                      <span className="h-1 w-1 rounded-full bg-[var(--brand)]" />
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Time windows — 24h timeline */}
          <div className="animate-fade-in-up animate-delay-100">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3 w-3" />
              Key Time Windows · 24h Timeline
            </div>
            <TimeWindowsTimeline windows={profile.timeWindows} />
          </div>

          <Separator />

          {/* Channel mix (donut) + Key risks (cards) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="animate-fade-in-up animate-delay-200">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <Radio className="h-3 w-3" />
                Channel Mix
              </div>
              <ChannelDonut channels={profile.channelMix} />
            </div>
            <div className="animate-fade-in-up animate-delay-300">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                Key Risks ({profile.keyRisks.length})
                <span className="font-normal normal-case text-muted-foreground/70">· base × weather amplifier</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {profile.keyRisks.map((r, i) => (
                  <RiskCard key={r.id} risk={r} index={i} />
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Prep Philosophy callout + Campaign Bias */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border-l-4 border-[var(--brand)] bg-[var(--brand)]/5 p-3 animate-fade-in-up animate-delay-200">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand)]">
                <ChefHat className="h-3 w-3" />
                Prep Philosophy
              </div>
              <p className="mt-1 text-[11px] leading-snug">{profile.prepPhilosophy}</p>
            </div>
            <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-500/5 p-3 animate-fade-in-up animate-delay-300">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                <Megaphone className="h-3 w-3" />
                Campaign Bias
              </div>
              <p className="mt-1 text-[11px] leading-snug">{profile.campaignBias}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {profile.primaryChannels.map((c) => (
                  <Badge key={c} variant="secondary" className="text-[9px] capitalize">
                    <Radio className="h-2 w-2" />
                    {c}
                  </Badge>
                ))}
                <Badge variant="outline" className="gap-1 text-[9px]">
                  <Snowflake className="h-2 w-2" />
                  Tailored by store type
                </Badge>
              </div>
            </div>
          </div>

          {/* Monitored metrics */}
          <div className="animate-fade-in-up animate-delay-300">
            <div className="mb-2 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3 w-3" />
                Monitored Metrics ({profile.monitoredMetrics.length})
              </div>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" /> Required
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /> Optional
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {profile.monitoredMetrics.map((m, i) => (
                <MetricTile key={m.id} metric={m} index={i} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Operating rules */}
          <div className="animate-fade-in-up animate-delay-400">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              Operating Rules
            </div>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {profile.operatingRules.map((rule, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-md border bg-card px-2 py-1.5 text-[11px] leading-snug"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[8px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom callout */}
          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2 text-[10px] text-muted-foreground">
            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-[var(--brand)]" />
            <span>
              This profile is generated before any decision agent runs. Every downstream agent (Demand, Inventory, Prep,
              Staffing, Campaign, Task Automation) consumes it so decisions are tailored to the store type — not generic.
            </span>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
