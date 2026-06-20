"use client";

import * as React from "react";
import {
  FileText,
  Download,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Printer,
  Share2,
  CloudRain,
  Cloud,
  CloudSun,
  Sun,
  CloudLightning,
  CloudDrizzle,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  ChefHat,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentRunResult, ManagerBriefing } from "@/lib/types";
import { LiveBadge, formatTime, riskLevel } from "./shared";
import { useLang, useT } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = React.useState(0);
  const prevTargetRef = React.useRef(0);
  React.useEffect(() => {
    const from = prevTargetRef.current;
    const to = target;
    const startTs = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTs) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevTargetRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function pickWeatherIcon(
  precipMm: number,
  tempC: number,
  cloudCover: number,
): { Icon: React.ElementType; label: string } {
  if (precipMm >= 8) return { Icon: CloudLightning, label: "Heavy rain" };
  if (precipMm >= 2.5) return { Icon: CloudRain, label: "Rain" };
  if (precipMm >= 0.3) return { Icon: CloudDrizzle, label: "Drizzle" };
  if (tempC >= 33) return { Icon: Sun, label: "Hot & clear" };
  if (cloudCover >= 70) return { Icon: Cloud, label: "Overcast" };
  if (cloudCover >= 35) return { Icon: CloudSun, label: "Partly cloudy" };
  return { Icon: Sun, label: "Clear" };
}

/* ------------------------------------------------------------------ */
/*  Key metric mini-card                                              */
/* ------------------------------------------------------------------ */

function MiniMetric({
  label,
  value,
  suffix,
  delta,
  betterIs,
  icon: Icon,
  accent,
  delay,
}: {
  label: string;
  value: string;
  suffix?: string;
  delta?: number;
  betterIs?: "higher" | "lower";
  icon: React.ElementType;
  accent: string;
  delay: number;
}) {
  const improved =
    delta !== undefined && betterIs
      ? betterIs === "higher"
        ? delta >= 0
        : delta <= 0
      : undefined;
  return (
    <div
      className={cn(
        "metric-card animate-fade-in-up p-3",
        `animate-delay-${delay}`,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={cn("h-3.5 w-3.5", accent)} />
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cn("text-2xl font-bold tabular-nums", accent)}>
          {value}
        </span>
        {suffix && (
          <span className="text-xs font-semibold text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {delta !== undefined && (
        <div
          className={cn(
            "mt-0.5 flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
            improved === undefined
              ? "text-muted-foreground"
              : improved
                ? "risk-text-low"
                : "risk-text-high",
          )}
        >
          {delta >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}
          {suffix === "%" ? "pp" : ""}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Top-3 action numbered card                                        */
/* ------------------------------------------------------------------ */

function ActionCard({ index, text, delay }: { index: number; text: string; delay: number }) {
  return (
    <div
      className={cn(
        "card-interactive animate-fade-in-up group flex items-start gap-3 rounded-lg border bg-card p-3",
        `animate-delay-${delay}`,
      )}
    >
      <div className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm transition-transform group-hover:scale-110">
        {index}
      </div>
      <p className="pt-0.5 text-sm leading-snug">{text}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Weather callout                                                   */
/* ------------------------------------------------------------------ */

function WeatherCallout({
  result,
  delay,
}: {
  result: AgentRunResult;
  delay: number;
}) {
  const w = result.weather;
  const risk = result.plan.overallRisk;
  const level = riskLevel(risk);
  const { Icon, label } = pickWeatherIcon(
    w.precipitationMm,
    w.temperatureC,
    w.cloudCover,
  );

  const accentClass =
    level === "critical"
      ? "risk-text-critical risk-border-critical risk-bg-critical"
      : level === "high"
        ? "risk-text-high risk-border-high risk-bg-high"
        : level === "medium"
          ? "risk-text-medium risk-border-medium risk-bg-medium"
          : "risk-text-low risk-border-low risk-bg-low";

  const summary =
    level === "critical"
      ? "Severe weather impact expected — mobilize contingency plan"
      : level === "high"
        ? "Significant weather disruption likely — prep & staffing need attention"
        : level === "medium"
          ? "Moderate weather risk — monitor and adjust as needed"
          : "Weather conditions favorable — standard operations";

  return (
    <div
      className={cn(
        "animate-fade-in-up flex items-center gap-3 rounded-lg border p-3",
        accentClass,
        `animate-delay-${delay}`,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card/60">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
            Weather summary
          </span>
          <Badge
            variant="outline"
            className={cn("h-4 px-1.5 text-[10px] font-semibold uppercase", accentClass)}
          >
            {level}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-sm font-semibold">{summary}</p>
        <p className="mt-0.5 text-[11px] opacity-80">
          {label} · {w.temperatureC.toFixed(0)}°C (feels {w.apparentTempC.toFixed(0)}°C) ·{" "}
          {w.precipitationMm.toFixed(1)}mm precip · {w.cloudCover.toFixed(0)}% cloud
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confidence bar                                                    */
/* ------------------------------------------------------------------ */

function ConfidenceBar({ value }: { value: number }) {
  const animated = useCountUp(value * 100, 900);
  const pct = Math.round(animated);
  const level = riskLevel(1 - value);
  const barClass =
    level === "low"
      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
      : level === "medium"
        ? "bg-gradient-to-r from-amber-500 to-amber-400"
        : "bg-gradient-to-r from-rose-500 to-rose-400";
  const textClass =
    level === "low"
      ? "text-emerald-600 dark:text-emerald-400"
      : level === "medium"
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-muted-foreground">AI Confidence</span>
        <span className={cn("font-bold tabular-nums", textClass)}>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-200", barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section heading                                                   */
/* ------------------------------------------------------------------ */

function SectionHeading({
  icon: Icon,
  iconClass,
  children,
  delay,
}: {
  icon: React.ElementType;
  iconClass: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <div
      className={cn(
        "mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-fade-in-up",
        `animate-delay-${delay}`,
      )}
    >
      <Icon className={cn("h-3 w-3", iconClass)} />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                       */
/* ------------------------------------------------------------------ */

function BriefingEmptyState() {
  return (
    <Card className="card-interactive overflow-hidden border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg">
          <FileText className="h-7 w-7 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold">No briefing yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Run the 8-agent pipeline to generate a manager-ready shift briefing.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                        */
/* ------------------------------------------------------------------ */

export function ManagerBriefingPanel({
  briefing,
  result,
}: {
  briefing: ManagerBriefing | null;
  result: AgentRunResult | null;
}) {
  const [exporting, setExporting] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  const { lang } = useLang();
  const t = useT();

  if (!briefing || !result) return <BriefingEmptyState />;

  // Pick the active-language fields, falling back to English.
  const headline = lang === "vi" ? briefing.headlineVi ?? briefing.headline : briefing.headline;
  const tldr = lang === "vi" ? briefing.tldrVi ?? briefing.tldr : briefing.tldr;
  const topActions =
    lang === "vi" ? briefing.topActionsVi ?? briefing.topActions : briefing.topActions;
  const watchItems =
    lang === "vi" ? briefing.watchItemsVi ?? briefing.watchItems : briefing.watchItems;
  const closingNote =
    lang === "vi" ? briefing.closingNoteVi ?? briefing.closingNote : briefing.closingNote;

  const confidenceLabel =
    briefing.confidenceLabel === "high"
      ? t.highConfidence
      : briefing.confidenceLabel === "medium"
        ? t.mediumConfidence
        : t.lowConfidence;

  // Derive key metrics from the plan slots
  const lunchSlot = result.plan.slots.find((s) => s.slot === "lunch");
  const dinnerSlot = result.plan.slots.find((s) => s.slot === "dinner");
  const lunchPrepDelta = lunchSlot?.prepBatchDelta ?? 0;
  const dinnerStaffDelta = dinnerSlot?.staffingDelta ?? 0;

  // TL;DR summary: combine first 1-2 tldr items into a single highlighted box
  const tldrSummary = tldr.slice(0, 2).join("  ");

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/briefing/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) throw new Error(`export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `briefing-${briefing.storeName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t.toastExported);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.toastExportFailed);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      // Open a new window with a printable markdown briefing
      const res = await fetch("/api/briefing/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) throw new Error(`export failed: ${res.status}`);
      const md = await res.text();
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Manager Briefing — ${briefing.storeName}</title>
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 32px auto; padding: 0 16px; color: #1a1a1a; line-height: 1.5; }
          h1 { color: #C8102E; border-bottom: 3px solid #C8102E; padding-bottom: 8px; }
          h2 { margin-top: 24px; color: #C8102E; }
          h3 { margin-top: 16px; }
          code, pre { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-size: 12px; }
          pre { padding: 12px; overflow: auto; }
          blockquote { border-left: 3px solid #C8102E; margin: 12px 0; padding: 8px 16px; background: #fff5f5; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
          th { background: #fafafa; }
          hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
        </style></head><body><pre style="white-space:pre-wrap;background:transparent;padding:0;font-family:inherit;font-size:14px;">${md.replace(/</g, "&lt;")}</pre>` + 
        "<scr" + "ipt>window.onload = function() { window.print(); };</scr" + "ipt>" + 
        `</body></html>`;
      const w = window.open("", "_blank");
      if (!w) {
        toast.error("Pop-up blocked — allow pop-ups to print");
        return;
      }
      w.document.write(html);
      w.document.close();
      toast.success("Opening print preview…");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Print failed");
    } finally {
      setPrinting(false);
    }
  };

  const handleShare = () => {
    toast.info("Share coming soon — export .md for now");
  };

  return (
    <Card className="card-interactive overflow-hidden border-[var(--brand)]/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                {t.managerBriefing}
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                AI-generated · ready to share · {formatTime(briefing.generatedAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <LiveBadge isLive={result.isLive} source={result.weather.source} />
            <Badge
              variant="outline"
              className={cn(
                "border font-semibold uppercase",
                briefing.confidenceLabel === "high"
                  ? "risk-bg-low risk-border-low risk-text-low"
                  : briefing.confidenceLabel === "medium"
                    ? "risk-bg-medium risk-border-medium risk-text-medium"
                    : "risk-bg-high risk-border-high risk-text-high",
              )}
            >
              {confidenceLabel}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* TL;DR highlighted summary box */}
        <div
          className="animate-fade-in-up rounded-lg border-l-4 border-[var(--brand)] bg-[var(--brand)]/5 p-3"
        >
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--brand)]">
            <Zap className="h-3 w-3" />
            TL;DR
          </div>
          <p className="text-sm font-medium leading-snug">{tldrSummary}</p>
        </div>

        {/* Key metrics mini-grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniMetric
            label="Overall Risk"
            value={(result.plan.overallRisk * 100).toFixed(0)}
            suffix="%"
            icon={Activity}
            accent={
              riskLevel(result.plan.overallRisk) === "critical"
                ? "risk-text-critical"
                : riskLevel(result.plan.overallRisk) === "high"
                  ? "risk-text-high"
                  : riskLevel(result.plan.overallRisk) === "medium"
                    ? "risk-text-medium"
                    : "risk-text-low"
            }
            delay={100}
          />
          <MiniMetric
            label="Confidence"
            value={(result.plan.confidence * 100).toFixed(0)}
            suffix="%"
            icon={Sparkles}
            accent={
              result.plan.confidence >= 0.75
                ? "text-emerald-600 dark:text-emerald-400"
                : result.plan.confidence >= 0.5
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400"
            }
            delay={200}
          />
          <MiniMetric
            label="Lunch Prep Δ"
            value={lunchPrepDelta >= 0 ? "+" : ""}
            suffix="%"
            delta={lunchPrepDelta}
            betterIs="higher"
            icon={ChefHat}
            accent={
              lunchPrepDelta >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }
            delay={300}
          />
          <MiniMetric
            label="Dinner Staff Δ"
            value={dinnerStaffDelta >= 0 ? "+" : ""}
            suffix=""
            delta={dinnerStaffDelta}
            betterIs="higher"
            icon={Users}
            accent={
              dinnerStaffDelta >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }
            delay={400}
          />
        </div>

        {/* Headline brand gradient block */}
        <div className="brand-gradient animate-fade-in-up rounded-lg p-4 text-white animate-delay-200">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/80">
            <Sparkles className="h-3 w-3" />
            {t.headline}
          </div>
          <p className="mt-1 text-base font-semibold leading-snug">{headline}</p>
          {lang === "vi" && briefing.headlineVi && (
            <p className="mt-1 text-xs leading-snug text-white/70">{briefing.headline}</p>
          )}
        </div>

        {/* Weather Summary callout */}
        <WeatherCallout result={result} delay={300} />

        {/* Top 3 actions — numbered cards */}
        <div>
          <SectionHeading icon={CheckCircle2} iconClass="text-emerald-500" delay={100}>
            {t.topActions}
          </SectionHeading>
          <div className="space-y-2">
            {topActions.slice(0, 3).map((a, i) => (
              <ActionCard key={i} index={i + 1} text={a} delay={200 + i * 100} />
            ))}
          </div>
        </div>

        {/* TL;DR bullets */}
        <div>
          <SectionHeading icon={Sparkles} iconClass="text-[var(--brand)]" delay={100}>
            {t.tldr}
          </SectionHeading>
          <ul className="animate-fade-in-up space-y-1.5 animate-delay-200">
            {tldr.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Watch items */}
        <div>
          <SectionHeading icon={AlertCircle} iconClass="text-amber-500" delay={100}>
            {t.watchItems}
          </SectionHeading>
          <ul className="animate-fade-in-up space-y-1.5 animate-delay-200">
            {watchItems.map((w, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-sm"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {/* Closing note */}
        <div className="animate-fade-in-up flex items-start gap-2 text-xs italic text-muted-foreground">
          <span className="text-base leading-none">“</span>
          <span>{closingNote}</span>
        </div>

        {/* Confidence indicator bar */}
        <div className="animate-fade-in-up rounded-lg border bg-muted/30 p-3">
          <ConfidenceBar value={result.plan.confidence} />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="brand-gradient-vivid h-8 gap-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? t.exporting : t.exportMd}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            disabled={printing}
            className="h-8 gap-1.5 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            {printing ? "Preparing…" : "Print"}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShare}
                  disabled
                  className="h-8 gap-1.5 text-xs opacity-60"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming soon — export to .md for now</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}
