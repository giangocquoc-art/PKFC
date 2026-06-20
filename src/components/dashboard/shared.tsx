"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export function riskLevel(score: number): RiskLevel {
  if (score >= 0.7) return "critical";
  if (score >= 0.5) return "high";
  if (score >= 0.3) return "medium";
  return "low";
}

export function riskColorClass(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "risk-text-low";
    case "medium":
      return "risk-text-medium";
    case "high":
      return "risk-text-high";
    case "critical":
      return "risk-text-critical";
  }
}

export function riskBgClass(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "risk-bg-low risk-border-low";
    case "medium":
      return "risk-bg-medium risk-border-medium";
    case "high":
      return "risk-bg-high risk-border-high";
    case "critical":
      return "risk-bg-critical risk-border-critical";
  }
}

export function RiskBadge({
  score,
  label,
  className,
}: {
  score: number;
  label?: string;
  className?: string;
}) {
  const level = riskLevel(score);
  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-semibold tabular-nums",
        riskBgClass(level),
        riskColorClass(level),
        className,
      )}
    >
      {label ? `${label}: ` : ""}
      {(score * 100).toFixed(0)}%
    </Badge>
  );
}

export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const level = riskLevel(1 - confidence); // invert: high confidence = low risk
  const label = confidence >= 0.75 ? "High" : confidence >= 0.5 ? "Medium" : "Low";
  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-semibold tabular-nums",
        riskBgClass(level),
        riskColorClass(level),
        className,
      )}
    >
      {label} confidence · {(confidence * 100).toFixed(0)}%
    </Badge>
  );
}

export function LiveBadge({ isLive, source }: { isLive: boolean; source?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium gap-1.5",
        isLive
          ? "risk-bg-low risk-border-low risk-text-low"
          : "risk-bg-high risk-border-high risk-text-high",
      )}
      title={source}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          isLive ? "bg-[var(--risk-low)] animate-pulse" : "bg-[var(--risk-high)]",
        )}
      />
      {isLive ? "LIVE" : "FALLBACK"}
    </Badge>
  );
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
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

export function formatTimeShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export const PHASE_COLORS: Record<string, string> = {
  observe: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  collect: "bg-sky-500/15 text-sky-700 border-sky-500/40",
  analyze: "bg-violet-500/15 text-violet-700 border-violet-500/40",
  classify: "bg-indigo-500/15 text-indigo-700 border-indigo-500/40",
  diagnose: "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-500/40",
  simulate: "bg-cyan-500/15 text-cyan-700 border-cyan-500/40",
  plan: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  decide: "bg-teal-500/15 text-teal-700 border-teal-500/40",
  recommend: "bg-rose-500/15 text-rose-700 border-rose-500/40",
  automate: "bg-orange-500/15 text-orange-700 border-orange-500/40",
  approval: "bg-yellow-500/15 text-yellow-700 border-yellow-500/40",
  execute: "bg-lime-500/15 text-lime-700 border-lime-500/40",
  learn: "bg-purple-500/15 text-purple-700 border-purple-500/40",
  explain: "bg-slate-500/15 text-slate-700 border-slate-500/40",
};

export const SOURCE_COLORS: Record<string, string> = {
  live: "risk-text-low",
  fallback: "risk-text-high",
  computed: "text-muted-foreground",
  llm: "text-violet-600 dark:text-violet-400",
};

export function storeTypeLabel(t: string): string {
  switch (t) {
    case "urban-street":
      return "Urban Street";
    case "mall":
      return "Mall";
    case "residential":
      return "Residential";
    case "suburban":
      return "Suburban";
    case "office-area":
      return "Office Area";
    default:
      return t;
  }
}

export function storeTypeIcon(t: string): string {
  switch (t) {
    case "urban-street":
      return "🏙️";
    case "mall":
      return "🏬";
    case "residential":
      return "🏘️";
    case "suburban":
      return "🌄";
    case "office-area":
      return "🏢";
    default:
      return "📍";
  }
}
