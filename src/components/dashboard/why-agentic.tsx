"use client";

import * as React from "react";
import {
  Eye,
  Radio,
  Brain,
  ClipboardList,
  Users,
  Megaphone,
  HelpCircle,
  FileText,
  ArrowRight,
  Sparkles,
  CloudSun,
  Bot,
  Check,
  X,
  MapPin,
  Network,
  Target,
  ShieldCheck,
  Zap,
  Timer,
  Layers,
  Store,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  8-agent pipeline (color-coded by function)                        */
/* ------------------------------------------------------------------ */

type AgentFunction = "input" | "processing" | "output";

const AGENTS: Array<{
  name: string;
  icon: React.ElementType;
  role: string;
  fn: AgentFunction;
  phase: string;
}> = [
  { name: "Store Context", icon: Eye, role: "Understands the store", fn: "input", phase: "Observe" },
  { name: "Weather Signal", icon: Radio, role: "Reads micro-local signals", fn: "input", phase: "Collect" },
  { name: "Demand", icon: Brain, role: "Predicts walk-in & delivery", fn: "processing", phase: "Analyze" },
  { name: "Inventory & Prep", icon: ClipboardList, role: "Sizes prep & packaging", fn: "processing", phase: "Plan" },
  { name: "Staffing", icon: Users, role: "Sets slot staffing", fn: "processing", phase: "Plan" },
  { name: "Campaign", icon: Megaphone, role: "Picks campaign focus", fn: "processing", phase: "Recommend" },
  { name: "Risk Explanation", icon: HelpCircle, role: "Explains the why", fn: "output", phase: "Explain" },
  { name: "Manager Briefing", icon: FileText, role: "Writes the briefing", fn: "output", phase: "Explain" },
];

const FUNCTION_META: Record<
  AgentFunction,
  { label: string; color: string; ring: string; chip: string }
> = {
  input: {
    label: "Input",
    color: "text-amber-700 dark:text-amber-400",
    ring: "border-amber-500/40 bg-amber-500/10",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  processing: {
    label: "Processing",
    color: "text-violet-700 dark:text-violet-400",
    ring: "border-violet-500/40 bg-violet-500/10",
    chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  },
  output: {
    label: "Output",
    color: "text-emerald-700 dark:text-emerald-400",
    ring: "border-emerald-500/40 bg-emerald-500/10",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
};

/* ------------------------------------------------------------------ */
/*  Comparison rows                                                   */
/* ------------------------------------------------------------------ */

const TRADITIONAL_STEPS = [
  { text: "Reads city-wide forecast", ok: true },
  { text: "You interpret the weather", ok: true },
  { text: "You decide prep", ok: false, note: "Manual guess" },
  { text: "You decide staffing", ok: false, note: "Yesterday's pattern" },
  { text: "You decide campaign", ok: false, note: "Generic schedule" },
  { text: "No audit trail", ok: false, note: "Decisions stay in your head" },
];

const AGENTIC_STEPS = [
  { text: "Collects micro-local signals", ok: true, note: "Lat/lng + 6 risk scores" },
  { text: "Reasons through 8 specialized agents", ok: true, note: "Each with a single role" },
  { text: "Decides prep per slot", ok: true, note: "Lunch + Dinner, weather-aware" },
  { text: "Decides staffing per slot", ok: true, note: "Packing + kitchen split" },
  { text: "Decides campaign channel", ok: true, note: "Dine-in vs delivery mix" },
  { text: "Persists every run to audit DB", ok: true, note: "Trace + plan + briefing" },
];

/* ------------------------------------------------------------------ */
/*  Differentiators                                                   */
/* ------------------------------------------------------------------ */

const DIFFERENTIATORS = [
  {
    icon: MapPin,
    title: "Micro-local signals",
    sub: "Not city-wide",
    desc: "Coordinates + 6 derived risk scores per store, not a single district forecast.",
    accent: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
  },
  {
    icon: Network,
    title: "8-agent reasoning",
    sub: "Not a single LLM call",
    desc: "Each agent has one role, deterministic fallbacks, and confidence scoring per step.",
    accent: "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/30",
  },
  {
    icon: Target,
    title: "Action plans",
    sub: "Not just forecasts",
    desc: "Slot-level prep, staffing, packaging, and campaign decisions — not weather predictions.",
    accent: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30",
  },
  {
    icon: ShieldCheck,
    title: "Human approval",
    sub: "Not fully autonomous",
    desc: "Manager reviews every briefing. Approve, adjust, or reject before anything ships.",
    accent: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  },
];

/* ------------------------------------------------------------------ */
/*  Metrics strip                                                     */
/* ------------------------------------------------------------------ */

const METRICS = [
  { icon: Timer, value: "<5s", label: "Response time" },
  { icon: Bot, value: "8", label: "Specialized agents" },
  { icon: Layers, value: "14", label: "Phase pipeline" },
  { icon: Store, value: "20", label: "Stores monitored" },
];

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function ComparisonCard({
  title,
  subtitle,
  icon: Icon,
  steps,
  variant,
  delay,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  steps: Array<{ text: string; ok: boolean; note?: string }>;
  variant: "traditional" | "agentic";
  delay: number;
}) {
  const isAgentic = variant === "agentic";
  return (
    <div
      className={cn(
        "card-interactive relative flex flex-col gap-2 rounded-xl border p-3 animate-fade-in-up",
        isAgentic
          ? "border-[var(--brand)]/40 bg-[var(--brand)]/5"
          : "border-border bg-muted/20",
        `animate-delay-${delay}`,
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            isAgentic ? "brand-gradient text-white" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold">{title}</span>
            {isAgentic && (
              <Badge variant="outline" className="h-4 gap-0.5 border-[var(--brand)]/40 px-1 text-[8px] uppercase text-[var(--brand)]">
                <Sparkles className="h-2 w-2" />
                This project
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <ul className="space-y-1">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px]">
            {s.ok ? (
              <Check className={cn("mt-0.5 h-3 w-3 shrink-0", isAgentic ? "text-[var(--risk-low)]" : "text-muted-foreground")} />
            ) : (
              <X className="mt-0.5 h-3 w-3 shrink-0 text-[var(--risk-high)]" />
            )}
            <div className="min-w-0 flex-1">
              <span className={cn(!s.ok && "text-muted-foreground line-through decoration-[var(--risk-high)]/40")}>
                {s.text}
              </span>
              {s.note && (
                <span className="ml-1 text-[9px] text-muted-foreground">· {s.note}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgentCard({
  agent,
  index,
}: {
  agent: (typeof AGENTS)[number];
  index: number;
}) {
  const meta = FUNCTION_META[agent.fn];
  const Icon = agent.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "card-interactive relative flex w-full flex-col gap-1 rounded-lg border p-2.5 animate-fade-in-up",
            meta.ring,
            `animate-delay-${Math.min(800, 100 * (index + 1))}`,
          )}
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className={cn("flex h-7 w-7 items-center justify-center rounded-md bg-background/60", meta.color)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <Badge variant="outline" className={cn("h-4 px-1 text-[8px] font-bold uppercase", meta.chip)}>
              {meta.label}
            </Badge>
          </div>
          <div className="text-[11px] font-bold leading-tight">{agent.name}</div>
          <div className="text-[9px] text-muted-foreground">{agent.role}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[8px] uppercase tracking-wider text-muted-foreground/70">
            <span className="font-bold text-[var(--brand)]">#{index + 1}</span>
            <span>· {agent.phase}</span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="font-semibold">{agent.name} Agent</div>
        <div className="text-muted-foreground">{agent.role}</div>
        <div className="text-muted-foreground">Phase: {agent.phase} · Function: {meta.label}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function DifferentiatorCard({
  item,
  index,
}: {
  item: (typeof DIFFERENTIATORS)[number];
  index: number;
}) {
  const Icon = item.icon;
  return (
    <div
      className={cn(
        "card-interactive rounded-xl border p-3 animate-fade-in-up",
        item.accent,
        `animate-delay-${Math.min(800, 100 * (index + 1))}`,
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/60")}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold">{item.title}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{item.sub}</span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug opacity-90">{item.desc}</p>
        </div>
      </div>
    </div>
  );
}

function MetricStat({
  metric,
  index,
}: {
  metric: (typeof METRICS)[number];
  index: number;
}) {
  const Icon = metric.icon;
  return (
    <div
      className={cn(
        "metric-card flex flex-col items-center gap-1 p-3 text-center animate-fade-in-up",
        `animate-delay-${Math.min(800, 100 * (index + 1))}`,
      )}
    >
      <Icon className="h-4 w-4 text-[var(--brand)]" />
      <span className="text-2xl font-bold tabular-nums leading-none">{metric.value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{metric.label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main section                                                      */
/* ------------------------------------------------------------------ */

export function WhyAgenticSection() {
  return (
    <TooltipProvider delayDuration={150}>
      <Card className="overflow-hidden border-[var(--brand)]/20">
        <CardHeader className="pb-3">
          {/* Enhanced header */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl brand-gradient text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                Why Agentic?
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Weather apps tell managers what the weather may be. This agent tells each F&amp;B store what to{" "}
                <em className="font-medium text-foreground">do</em> because of local weather risk.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Metrics strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METRICS.map((m, i) => (
              <MetricStat key={m.label} metric={m} index={i} />
            ))}
          </div>

          {/* Comparison cards */}
          <div className="animate-fade-in-up animate-delay-200">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Layers className="h-3 w-3" />
              Traditional vs Agentic
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <ComparisonCard
                title="Traditional Weather App"
                subtitle="Shows a forecast · you decide everything"
                icon={CloudSun}
                steps={TRADITIONAL_STEPS}
                variant="traditional"
                delay={100}
              />
              <ComparisonCard
                title="Agent CaMate Agent"
                subtitle="Collects signals · reasons · decides · acts"
                icon={Bot}
                steps={AGENTIC_STEPS}
                variant="agentic"
                delay={200}
              />
            </div>
          </div>

          {/* 8-agent pipeline visualization */}
          <div className="animate-fade-in-up animate-delay-300">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Network className="h-3 w-3" />
                8-Agent Pipeline · Color-coded by function
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(["input", "processing", "output"] as AgentFunction[]).map((fn) => (
                  <Badge key={fn} variant="outline" className={cn("h-4 gap-1 px-1.5 text-[9px] uppercase", FUNCTION_META[fn].chip)}>
                    {FUNCTION_META[fn].label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Flow diagram: 8 cards in 2 rows of 4 with arrows between */}
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {AGENTS.map((a, i) => (
                  <React.Fragment key={a.name}>
                    <AgentCard agent={a} index={i} />
                    {/* Insert arrow at the end of each row except the last */}
                    {i < AGENTS.length - 1 && (i + 1) % 4 === 0 && (
                      <div className="col-span-full flex justify-center py-0.5">
                        <ArrowDown className="h-4 w-4 text-muted-foreground/60" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              {/* Flow legend */}
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="font-bold uppercase tracking-wider">Flow</span>
                <span>Observe</span>
                <ArrowRight className="h-2.5 w-2.5" />
                <span>Collect</span>
                <ArrowRight className="h-2.5 w-2.5" />
                <span>Analyze</span>
                <ArrowRight className="h-2.5 w-2.5" />
                <span>Plan</span>
                <ArrowRight className="h-2.5 w-2.5" />
                <span>Recommend</span>
                <ArrowRight className="h-2.5 w-2.5" />
                <span>Explain</span>
              </div>
            </div>
          </div>

          {/* Differentiators */}
          <div className="animate-fade-in-up animate-delay-400">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Target className="h-3 w-3" />
              Key Differentiators
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {DIFFERENTIATORS.map((d, i) => (
                <DifferentiatorCard key={d.title} item={d} index={i} />
              ))}
            </div>
          </div>

          {/* Closing callout */}
          <div className="flex items-start gap-2 rounded-lg border-l-4 border-[var(--brand)] bg-[var(--brand)]/5 p-3 text-[11px] leading-relaxed animate-fade-in-up animate-delay-500">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
            <span>
              <span className="font-bold">In one sentence:</span> A weather app tells you what the sky will do.{" "}
              <span className="font-bold text-[var(--brand)]">Agent CaMate tells each store what to do about it</span> —
              with audit-grade provenance, fallback honesty, and a manager-in-the-loop approval step.
            </span>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
