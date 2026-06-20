"use client";

import * as React from "react";
import {
  ChevronRight,
  CircleDot,
  Eye,
  Radio,
  Brain,
  ClipboardList,
  Megaphone,
  HelpCircle,
  FileText,
  Cpu,
  Clock,
  CheckCircle2,
  Users,
  Bot,
  Tag,
  Stethoscope,
  FlaskConical,
  ShieldCheck,
  Send,
  GraduationCap,
  Scale,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  LayoutList,
  GitBranch,
  ChevronsDownUp,
  ChevronsUpDown,
  Timer,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentStep } from "@/lib/types";
import {
  PHASE_COLORS,
  SOURCE_COLORS,
  formatTimeShort,
  formatDuration,
} from "./shared";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Static lookup tables                                              */
/* ------------------------------------------------------------------ */

const AGENT_ICONS: Record<string, React.ElementType> = {
  "Store Context Agent": Eye,
  "Weather Signal Agent": Radio,
  "Demand Agent": Brain,
  "Inventory & Prep Agent": ClipboardList,
  "Staffing Agent": Users,
  "Campaign Agent": Megaphone,
  "Risk Explanation Agent": HelpCircle,
  "Manager Briefing Agent": FileText,
  "Store Classifier": Tag,
  "Operations Diagnostician": Stethoscope,
  "Simulation Agent": FlaskConical,
  "Task Automation Agent": Bot,
  "Approval Workflow": ShieldCheck,
  "Execute / Export": Send,
  "AI học sau ca": GraduationCap,
  "Learning Agent": GraduationCap,
};

const PHASE_ICONS: Record<string, React.ElementType> = {
  observe: Eye,
  collect: Radio,
  analyze: Brain,
  classify: Tag,
  diagnose: Stethoscope,
  simulate: FlaskConical,
  plan: ClipboardList,
  decide: Scale,
  recommend: Megaphone,
  automate: Bot,
  approval: ShieldCheck,
  execute: Send,
  learn: GraduationCap,
  explain: HelpCircle,
};

const PHASE_BORDER: Record<string, string> = {
  observe: "border-l-amber-500",
  collect: "border-l-sky-500",
  analyze: "border-l-violet-500",
  classify: "border-l-fuchsia-500",
  diagnose: "border-l-fuchsia-500",
  simulate: "border-l-cyan-500",
  plan: "border-l-emerald-500",
  decide: "border-l-teal-500",
  recommend: "border-l-rose-500",
  automate: "border-l-orange-500",
  approval: "border-l-yellow-500",
  execute: "border-l-lime-500",
  learn: "border-l-purple-500",
  explain: "border-l-slate-500",
};

const PHASE_ORDER = [
  "observe",
  "collect",
  "analyze",
  "classify",
  "diagnose",
  "simulate",
  "plan",
  "decide",
  "recommend",
  "automate",
  "approval",
  "execute",
  "learn",
  "explain",
] as const;

/* ------------------------------------------------------------------ */
/*  Pipeline overview diagram                                         */
/* ------------------------------------------------------------------ */

function PipelineOverview({ steps }: { steps: AgentStep[] }) {
  const completed = new Set(steps.map((s) => s.phase));
  return (
    <div className="scrollbar-thin overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-0 px-1 py-2">
        {PHASE_ORDER.map((phase, i) => {
          const done = completed.has(phase);
          const Icon = PHASE_ICONS[phase] ?? CircleDot;
          const step = steps.find((s) => s.phase === phase);
          const isLast = i === PHASE_ORDER.length - 1;
          return (
            <React.Fragment key={phase}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="group relative flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200 group-hover:scale-110",
                        done
                          ? cn(PHASE_COLORS[phase], "border-current shadow-sm")
                          : "border-border bg-muted text-muted-foreground opacity-60",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span
                      className={cn(
                        "mt-1 text-[9px] font-semibold uppercase tracking-wide",
                        done ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {phase}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="space-y-0.5 text-left">
                    <div className="font-semibold capitalize">{phase}</div>
                    {step ? (
                      <>
                        <div className="text-[10px] opacity-80">{step.agentName}</div>
                        <div className="text-[10px] opacity-80">
                          {formatDuration(step.durationMs)} · {(step.confidence * 100).toFixed(0)}% conf
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] opacity-70">Not executed</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 w-4 shrink-0 rounded-full",
                    done && completed.has(PHASE_ORDER[i + 1])
                      ? "bg-[var(--brand)]/60"
                      : "bg-border",
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status indicator                                                  */
/* ------------------------------------------------------------------ */

function StatusIndicator({ status }: { status: AgentStep["status"] }) {
  if (status === "running") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Running</TooltipContent>
      </Tooltip>
    );
  }
  if (status === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white">
            <AlertCircle className="h-2.5 w-2.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Failed</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
          <CheckCircle2 className="h-2.5 w-2.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>Completed</TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/*  Step card                                                         */
/* ------------------------------------------------------------------ */

function StepCard({
  step,
  index,
  open,
  onOpenChange,
}: {
  step: AgentStep;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const Icon = AGENT_ICONS[step.agentName] ?? CircleDot;
  const PhaseIcon = PHASE_ICONS[step.phase] ?? CircleDot;
  const borderClass = PHASE_BORDER[step.phase] ?? "border-l-muted";
  const phaseColorClass = PHASE_COLORS[step.phase] ?? "";
  const delayClass = `animate-delay-${Math.min(index * 50 + 100, 800)}`;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div
        className={cn(
          "card-interactive animate-fade-in-up overflow-hidden rounded-lg border border-l-4 bg-card",
          borderClass,
          delayClass,
        )}
      >
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-start gap-3 p-3 text-left">
            {/* Phase number badge + icon */}
            <div className="relative flex shrink-0 flex-col items-center">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border-2 font-bold tabular-nums",
                  phaseColorClass,
                )}
              >
                <PhaseIcon className="h-4 w-4" />
              </div>
              <span className="mt-1 rounded-full bg-muted px-1.5 text-[9px] font-bold tabular-nums text-muted-foreground">
                #{step.step}
              </span>
            </div>

            {/* Main info */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold">{step.agentName}</span>
                <Badge
                  variant="outline"
                  className={cn("px-1.5 py-0 text-[10px] font-semibold uppercase", phaseColorClass)}
                >
                  {step.phase}
                </Badge>
                <StatusIndicator status={step.status} />
              </div>
              <p className="text-xs text-muted-foreground">{step.agentRole}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1" title="Timestamp">
                  <Clock className="h-3 w-3" />
                  {formatTimeShort(step.timestamp)}
                </span>
                <span className="flex items-center gap-1 font-medium tabular-nums" title="Duration">
                  <Timer className="h-3 w-3" />
                  {formatDuration(step.durationMs)}
                </span>
                <span
                  className={cn("flex items-center gap-1 font-medium", SOURCE_COLORS[step.dataSource])}
                  title="Data source"
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  {step.dataSource}
                </span>
                <span
                  className="flex items-center gap-1 font-medium tabular-nums"
                  title="Confidence"
                >
                  <Activity className="h-3 w-3" />
                  {(step.confidence * 100).toFixed(0)}% conf
                </span>
              </div>
            </div>

            {/* Agent icon + chevron */}
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden h-7 w-7 items-center justify-center rounded-md bg-muted/60 sm:flex">
                <Icon className="h-3.5 w-3.5 text-foreground" />
              </div>
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-90",
                )}
              />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 border-t bg-muted/30 px-3 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-sm bg-sky-500" />
                  Input used
                </div>
                <p className="rounded-md border bg-card p-2 text-xs leading-relaxed">
                  {step.input}
                </p>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />
                  Output generated
                </div>
                <p className="whitespace-pre-wrap rounded-md border bg-card p-2 text-xs leading-relaxed">
                  {step.output}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-2 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="font-semibold uppercase text-muted-foreground">Phase:</span>
                <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px] uppercase", phaseColorClass)}>
                  {step.phase}
                </Badge>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-semibold uppercase text-muted-foreground">Source:</span>
                <span className={SOURCE_COLORS[step.dataSource]}>{step.dataSource}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-semibold uppercase text-muted-foreground">Confidence:</span>
                <span className="font-medium tabular-nums">{(step.confidence * 100).toFixed(0)}%</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-semibold uppercase text-muted-foreground">Duration:</span>
                <span className="font-medium tabular-nums">{formatDuration(step.durationMs)}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-semibold uppercase text-muted-foreground">Status:</span>
                <span className="font-medium capitalize">{step.status}</span>
              </span>
            </div>
            {step.structuredOutput && (
              <details className="group">
                <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground">
                  Structured output (JSON)
                </summary>
                <pre className="scrollbar-thin mt-1 max-h-48 overflow-auto rounded-md border bg-card p-2 text-[10px] leading-tight">
                  {JSON.stringify(step.structuredOutput, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline view                                                     */
/* ------------------------------------------------------------------ */

function TimelineView({
  steps,
  totalDurationMs,
}: {
  steps: AgentStep[];
  totalDurationMs: number;
}) {
  // Compute cumulative start offset for each step using reduce (immutable)
  const { positioned, total } = steps.reduce(
    (acc, s) => {
      const start = acc.total;
      const end = start + s.durationMs;
      return {
        positioned: [...acc.positioned, { step: s, start, end }],
        total: end,
      };
    },
    { positioned: [] as { step: AgentStep; start: number; end: number }[], total: 0 },
  );
  const maxEnd = Math.max(totalDurationMs, total, 1);

  return (
    <div className="space-y-2">
      {/* Time axis */}
      <div className="flex items-center justify-between text-[10px] font-semibold tabular-nums text-muted-foreground">
        <span>0s</span>
        <span>{formatDuration(maxEnd / 2)}</span>
        <span>{formatDuration(maxEnd)}</span>
      </div>
      <div className="relative h-1 rounded-full bg-muted">
        <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
      </div>

      {/* Step bars */}
      <div className="space-y-1.5 pt-1">
        {positioned.map(({ step, start, end }, i) => {
          const leftPct = (start / maxEnd) * 100;
          const widthPct = Math.max(((end - start) / maxEnd) * 100, 0.5);
          const PhaseIcon = PHASE_ICONS[step.phase] ?? CircleDot;
          const phaseColorClass = PHASE_COLORS[step.phase] ?? "";
          const borderClass = PHASE_BORDER[step.phase] ?? "border-l-muted";
          const delayClass = `animate-delay-${Math.min(i * 50 + 100, 800)}`;
          return (
            <Tooltip key={step.step}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "animate-fade-in-up relative flex items-center gap-2 rounded-md border border-l-4 bg-card p-1.5",
                    borderClass,
                    delayClass,
                  )}
                  style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%`, minWidth: "120px" }}
                >
                  <div
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded",
                      phaseColorClass,
                    )}
                  >
                    <PhaseIcon className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10px] font-semibold">{step.agentName}</div>
                    <div className="text-[9px] tabular-nums text-muted-foreground">
                      {formatDuration(end - start)}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="space-y-0.5 text-left">
                  <div className="font-semibold">{step.agentName}</div>
                  <div className="text-[10px] opacity-80">Phase: {step.phase}</div>
                  <div className="text-[10px] opacity-80">
                    {formatDuration(end - start)} · {(step.confidence * 100).toFixed(0)}% conf
                  </div>
                  <div className="text-[10px] opacity-80">Source: {step.dataSource}</div>
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
/*  Agent summary                                                     */
/* ------------------------------------------------------------------ */

function AgentSummary({ steps }: { steps: AgentStep[] }) {
  const agentStats = React.useMemo(() => {
    const map = new Map<string, { name: string; totalMs: number; steps: number; avgConf: number }>();
    for (const s of steps) {
      const prev = map.get(s.agentName) ?? {
        name: s.agentName,
        totalMs: 0,
        steps: 0,
        avgConf: 0,
      };
      prev.totalMs += s.durationMs;
      prev.steps += 1;
      prev.avgConf += s.confidence;
      map.set(s.agentName, prev);
    }
    const arr = Array.from(map.values()).map((a) => ({
      ...a,
      avgConf: a.avgConf / a.steps,
    }));
    arr.sort((a, b) => b.totalMs - a.totalMs);
    return arr;
  }, [steps]);

  const maxMs = Math.max(1, ...agentStats.map((a) => a.totalMs));
  const totalMs = agentStats.reduce((sum, a) => sum + a.totalMs, 0);

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Users className="h-3 w-3" />
          Agent summary
        </div>
        <Badge variant="outline" className="text-[10px] tabular-nums">
          {agentStats.length} agents · {formatDuration(totalMs)} total
        </Badge>
      </div>
      <div className="space-y-1.5">
        {agentStats.map((a, i) => {
          const Icon = AGENT_ICONS[a.name] ?? Bot;
          const widthPct = (a.totalMs / maxMs) * 100;
          const sharePct = (a.totalMs / totalMs) * 100;
          return (
            <div
              key={a.name}
              className={cn(
                "animate-fade-in-up flex items-center gap-2 rounded-md p-1.5 hover:bg-accent/30",
                `animate-delay-${Math.min(i * 50 + 100, 800)}`,
              )}
            >
              <div className="flex w-5 shrink-0 items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="w-32 shrink-0 truncate text-xs font-medium sm:w-44" title={a.name}>
                {a.name}
              </div>
              <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="brand-gradient-vivid h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <div className="flex w-24 shrink-0 items-center justify-end gap-2 text-[10px] tabular-nums">
                <span className="font-semibold">{formatDuration(a.totalMs)}</span>
                <span className="text-muted-foreground">{sharePct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between border-t pt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Cpu className="h-3 w-3" />
          Tokens: <span className="font-medium text-foreground">N/A</span>
        </span>
        <span className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          Avg confidence:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {(
              (agentStats.reduce((s, a) => s + a.avgConf, 0) / Math.max(1, agentStats.length)) *
              100
            ).toFixed(0)}
            %
          </span>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                       */
/* ------------------------------------------------------------------ */

function TraceEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg">
        <Bot className="h-7 w-7 text-white" />
      </div>
      <div>
        <p className="text-sm font-semibold">No execution trace yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Run the agent pipeline to see the 14-phase execution trace.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                        */
/* ------------------------------------------------------------------ */

export function AgentTracePanel({
  trace,
  totalDurationMs,
}: {
  trace: AgentStep[];
  totalDurationMs: number;
}) {
  const [viewMode, setViewMode] = React.useState<"card" | "timeline">("card");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [phaseFilter, setPhaseFilter] = React.useState<string>("all");
  const [openSteps, setOpenSteps] = React.useState<Set<number>>(new Set());
  const [allExpanded, setAllExpanded] = React.useState(false);

  // Available phases from the trace (for the filter dropdown)
  const availablePhases = React.useMemo(() => {
    const set = new Set(trace.map((s) => s.phase));
    return PHASE_ORDER.filter((p) => set.has(p));
  }, [trace]);

  // Filter the steps
  const filteredSteps = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return trace.filter((s) => {
      if (phaseFilter !== "all" && s.phase !== phaseFilter) return false;
      if (!q) return true;
      return (
        s.agentName.toLowerCase().includes(q) ||
        s.agentRole.toLowerCase().includes(q) ||
        s.phase.toLowerCase().includes(q) ||
        s.input.toLowerCase().includes(q) ||
        s.output.toLowerCase().includes(q)
      );
    });
  }, [trace, searchQuery, phaseFilter]);

  const handleToggleAll = () => {
    if (allExpanded) {
      setOpenSteps(new Set());
      setAllExpanded(false);
    } else {
      setOpenSteps(new Set(filteredSteps.map((s) => s.step)));
      setAllExpanded(true);
    }
  };

  const handleStepOpenChange = (step: number) => (open: boolean) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (open) next.add(step);
      else next.delete(step);
      return next;
    });
  };

  if (!trace.length) {
    return (
      <Card className="card-interactive overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg">
              <Bot className="h-4 w-4 text-white" />
            </div>
            Agent Execution Trace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TraceEmptyState />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-interactive overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Agent Execution Trace</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                14-phase pipeline · {availablePhases.length || "8"} agents ·{" "}
                {formatDuration(totalDurationMs)} total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="gap-1 border-[var(--brand)]/30 text-[var(--brand)] tabular-nums"
            >
              <Timer className="h-3 w-3" />
              {formatDuration(totalDurationMs)}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleAll}
              className="h-7 gap-1.5 text-xs"
            >
              {allExpanded ? (
                <>
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                  Collapse all
                </>
              ) : (
                <>
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  Expand all
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Pipeline overview diagram */}
        <div className="mt-2 rounded-lg border bg-muted/30 p-2">
          <PipelineOverview steps={trace} />
        </div>

        {/* Toolbar: search + filter + view toggle */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[140px] flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents, phases…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={phaseFilter}
              onValueChange={setPhaseFilter}
              options={[
                { value: "all", label: "All phases" },
                ...availablePhases.map((p) => ({ value: p, label: p })),
              ]}
            />
          </div>
          <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
            <button
              onClick={() => setViewMode("card")}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors",
                viewMode === "card"
                  ? "brand-gradient-vivid text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutList className="h-3 w-3" />
              Cards
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors",
                viewMode === "timeline"
                  ? "brand-gradient-vivid text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <GitBranch className="h-3 w-3" />
              Timeline
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {filteredSteps.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <Search className="h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm font-medium">No matching steps</p>
            <p className="text-xs text-muted-foreground">
              Try a different search query or phase filter.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-1 h-7 text-xs"
              onClick={() => {
                setSearchQuery("");
                setPhaseFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[520px] pr-3">
            {viewMode === "card" ? (
              <div className="relative flex flex-col gap-2">
                {/* vertical connector line */}
                <div
                  className="absolute left-[26px] top-4 bottom-4 w-px bg-border"
                  aria-hidden
                />
                {filteredSteps.map((s, i) => (
                  <StepCard
                    key={s.step}
                    step={s}
                    index={i}
                    open={openSteps.has(s.step)}
                    onOpenChange={handleStepOpenChange(s.step)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-card/30 p-3">
                <TimelineView steps={filteredSteps} totalDurationMs={totalDurationMs} />
              </div>
            )}
          </ScrollArea>
        )}

        <Separator />

        {/* Agent summary */}
        <AgentSummary steps={trace} />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Minimal inline Select (no extra deps)                             */
/* ------------------------------------------------------------------ */

function Select({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="h-8 rounded-md border bg-background px-2 pr-7 text-xs font-medium capitalize shadow-xs outline-none transition-colors hover:bg-accent/30 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="capitalize">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronRight className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 rotate-90 text-muted-foreground" />
    </div>
  );
}
