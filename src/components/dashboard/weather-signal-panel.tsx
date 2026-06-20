"use client";

import * as React from "react";
import {
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  CloudRain,
  Cloud,
  TrendingDown,
  TrendingUp,
  Minus,
  Activity,
  Clock,
  AlertTriangle,
  CloudSun,
  Sun,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WeatherSignal } from "@/lib/types";
import {
  ConfidenceBadge,
  LiveBadge,
  formatTime,
  riskLevel,
  riskColorClass,
  riskBgClass,
} from "./shared";
import { useT } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";

const ACCENT_GRADIENTS: Record<string, string> = {
  "text-orange-500": "from-orange-500/20 to-orange-500/5",
  "text-sky-500": "from-sky-500/20 to-sky-500/5",
  "text-violet-500": "from-violet-500/20 to-violet-500/5",
  "text-red-500": "from-red-500/20 to-red-500/5",
  "text-emerald-500": "from-emerald-500/20 to-emerald-500/5",
  "text-teal-500": "from-teal-500/20 to-teal-500/5",
  "text-blue-500": "from-blue-500/20 to-blue-500/5",
  "text-slate-500": "from-slate-500/20 to-slate-500/5",
  "text-muted-foreground": "from-muted-foreground/15 to-muted-foreground/5",
};

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  const gradient = accent ? (ACCENT_GRADIENTS[accent] ?? "from-muted/20 to-muted/5") : "from-muted/20 to-muted/5";
  return (
    <div className="group metric-card relative flex flex-col gap-1 rounded-lg bg-card p-3 transition-all hover:translate-y-[-2px] hover:shadow-md">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br", gradient)}>
          <Icon className={cn("h-3 w-3", accent)} />
        </div>
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function getRiskBarClass(level: string): string {
  switch (level) {
    case "low": return "risk-bar-low";
    case "medium": return "risk-bar-medium";
    case "high": return "risk-bar-high";
    case "critical": return "risk-bar-critical";
    default: return "risk-bar-low";
  }
}

function RiskRow({ label, score, description, index }: { label: string; score: number; description: string; index: number }) {
  const level = riskLevel(score);
  return (
    <TooltipProvider delayDuration={150}>
      <div
        className="animate-fade-in-up flex flex-col gap-1.5"
        style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
      >
        <div className="flex items-center justify-between">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs font-medium underline-offset-2 hover:underline">{label}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px]">
              <p className="text-xs">{description}</p>
            </TooltipContent>
          </Tooltip>
          <span className={cn("text-xs font-bold tabular-nums", riskColorClass(level))}>
            {(score * 100).toFixed(0)}%
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out", getRiskBarClass(level))}
            style={{ width: `${score * 100}%` }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

/** Determine a summary weather condition icon and label based on raw data. */
function getWeatherCondition(w: WeatherSignal): { icon: React.ElementType; label: string; color: string } {
  if (w.precipitationMm > 5 && w.rainRiskScore > 0.6) return { icon: CloudLightning, label: "Heavy rain / storms", color: "text-red-500" };
  if (w.precipitationMm > 2) return { icon: CloudRain, label: "Rain expected", color: "text-blue-500" };
  if (w.precipitationMm > 0) return { icon: CloudDrizzle, label: "Light drizzle", color: "text-sky-500" };
  if (w.cloudCover > 80 && w.humidity > 85) return { icon: CloudFog, label: "Overcast / foggy", color: "text-slate-500" };
  if (w.cloudCover > 60) return { icon: Cloud, label: "Mostly cloudy", color: "text-slate-400" };
  if (w.cloudCover > 30) return { icon: CloudSun, label: "Partly cloudy", color: "text-amber-500" };
  if (w.temperatureC > 35) return { icon: Sun, label: "Hot & clear", color: "text-orange-500" };
  return { icon: Sun, label: "Clear skies", color: "text-amber-400" };
}

export function WeatherSignalPanel({ weather }: { weather: WeatherSignal }) {
  const t = useT();
  const pressureIcon =
    weather.pressureTrend === "falling"
      ? TrendingDown
      : weather.pressureTrend === "rising"
        ? TrendingUp
        : Minus;
  const pressureSub =
    weather.pressureTrend === "falling"
      ? t.rainLikely
      : weather.pressureTrend === "rising"
        ? t.clearing
        : t.stable;

  const condition = getWeatherCondition(weather);
  const ConditionIcon = condition.icon;
  const maxRisk = Math.max(weather.rainRiskScore, weather.heatRiskScore, weather.deliveryDisruptionRisk, weather.walkInDropRisk);
  const overallLevel = riskLevel(maxRisk);

  return (
    <Card className="card-interactive overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CloudRain className="h-4 w-4 text-[var(--brand)]" />
              {t.weatherSignals}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{t.weatherSub}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <LiveBadge isLive={weather.isLive} source={weather.source} />
            <ConfidenceBadge confidence={weather.dataConfidence} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weather condition summary strip */}
        <div className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2.5",
          overallLevel === "critical" || overallLevel === "high"
            ? "risk-bg-high risk-border-high border"
            : overallLevel === "medium"
              ? "risk-bg-medium risk-border-medium border"
              : "risk-bg-low risk-border-low border",
        )}>
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            overallLevel === "critical" || overallLevel === "high"
              ? "bg-red-500/20"
              : overallLevel === "medium"
                ? "bg-amber-500/20"
                : "bg-emerald-500/20",
          )}>
            <ConditionIcon className={cn("h-4 w-4", condition.color)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={cn("text-sm font-semibold", riskColorClass(overallLevel))}>{condition.label}</span>
              <span className="text-muted-foreground">·</span>
              <span className={cn("text-sm font-bold tabular-nums", riskColorClass(overallLevel))}>{(maxRisk * 100).toFixed(0)}% risk</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {weather.temperatureC}°C · {weather.humidity}% humidity · {weather.windSpeedKmh} km/h wind
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <StatTile
            icon={Thermometer}
            label={t.temperature}
            value={`${weather.temperatureC}°C`}
            sub={`${t.feelsLike} ${weather.apparentTempC}°C`}
            accent="text-orange-500"
          />
          <StatTile icon={Droplets} label={t.humidity} value={`${weather.humidity}%`} accent="text-sky-500" />
          <StatTile icon={Gauge} label={t.pressure} value={`${weather.pressureHpa}`} sub="hPa" accent="text-violet-500" />
          <StatTile
            icon={pressureIcon}
            label={t.pressureTrend}
            value={weather.pressureTrend}
            sub={pressureSub}
            accent={weather.pressureTrend === "falling" ? "text-red-500" : "text-emerald-500"}
          />
          <StatTile icon={Wind} label={t.wind} value={`${weather.windSpeedKmh}`} sub="km/h" accent="text-teal-500" />
          <StatTile icon={CloudRain} label={t.rain1h} value={`${weather.precipitationMm}`} sub="mm" accent="text-blue-500" />
          <StatTile icon={Cloud} label={t.cloudCover} value={`${weather.cloudCover}%`} accent="text-slate-500" />
          <StatTile icon={Clock} label={t.lastUpdated} value={formatTime(weather.fetchedAt)} sub="ICT" accent="text-muted-foreground" />
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            {t.derivedRisk}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RiskRow index={0} label={t.rainRisk} score={weather.rainRiskScore} description="Blends current precipitation intensity, probability, falling pressure & cloud cover." />
            <RiskRow index={1} label={t.heatRisk} score={weather.heatRiskScore} description="Heat-index style score from temperature; drives beverage attach & staff rotation." />
            <RiskRow index={2} label={t.deliveryDisruption} score={weather.deliveryDisruptionRisk} description="Weighted by rain, wind, store delivery share & suburban rider distance." />
            <RiskRow index={3} label={t.walkInDrop} score={weather.walkInDropRisk} description="Rain collapse on walk-in, weighted by store type (malls are sheltered)." />
          </div>
        </div>

        {weather.reliabilityNote && (
          <div className="rounded-lg border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Reliability: </span>
            {weather.reliabilityNote}
          </div>
        )}

        {!weather.isLive && (
          <div className="relative overflow-hidden rounded-lg border risk-border-high p-3.5">
            <div className="absolute inset-0 risk-bg-high opacity-60" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold risk-text-high">{t.fallbackMode}</p>
                <p className="text-xs text-muted-foreground">{t.fallbackDesc(weather.source)}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
