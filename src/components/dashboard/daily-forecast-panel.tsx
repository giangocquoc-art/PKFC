"use client";

import * as React from "react";
import {
  CalendarDays,
  Sun,
  CloudRain,
  Wind,
  Thermometer,
  Droplets,
  CloudSun,
  CloudDrizzle,
  CloudLightning,
  ChevronDown,
  Gauge,
  Zap,
  Trophy,
  AlertTriangle,
  Clock,
  Sunrise,
  Sunset,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WeatherSignal, DailyForecastPoint } from "@/lib/types";
import { useT } from "@/lib/i18n/language-provider";
import {
  LiveBadge,
  riskLevel,
  riskColorClass,
  riskBgClass,
  type RiskLevel,
} from "./shared";
import { cn } from "@/lib/utils";

type DayData = DailyForecastPoint;

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Pick a weather icon + accent + label from rain probability and precip sum. */
function weatherIconForDay(day: DayData): {
  Icon: React.ElementType;
  color: string;
  label: string;
} {
  if (day.precipProb >= 0.7 && day.precipSumMm >= 8)
    return { Icon: CloudLightning, color: "text-red-500", label: "Heavy storms" };
  if (day.precipProb >= 0.5 || day.precipSumMm >= 3)
    return { Icon: CloudRain, color: "text-blue-500", label: "Rain likely" };
  if (day.precipProb >= 0.3 || day.precipSumMm >= 1)
    return { Icon: CloudDrizzle, color: "text-sky-500", label: "Scattered showers" };
  if (day.precipProb >= 0.15)
    return { Icon: CloudSun, color: "text-amber-500", label: "Mostly clear" };
  return { Icon: Sun, color: "text-amber-400", label: "Clear skies" };
}

/** Composite day risk: 70% rain probability + 30% heat index. */
function dayRiskScore(day: DayData): number {
  const heatComponent = Math.max(0, (day.tempMaxC - 28) / 12); // 0 at 28°C, 1 at 40°C
  return Math.min(1, day.precipProb * 0.7 + heatComponent * 0.3);
}

function riskLabel(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "Low risk";
    case "medium":
      return "Moderate";
    case "high":
      return "High risk";
    case "critical":
      return "Critical";
  }
}

function riskBarClass(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "risk-bar-low";
    case "medium":
      return "risk-bar-medium";
    case "high":
      return "risk-bar-high";
    case "critical":
      return "risk-bar-critical";
  }
}

function operationsImpact(level: RiskLevel): string {
  switch (level) {
    case "critical":
      return "Severe weather — prep for delivery surge & walk-in collapse. Pre-stage packaging and pull earlier prep batches forward.";
    case "high":
      return "Rain expected — boost delivery capacity, slightly reduce walk-in staffing, prep rain-safe packaging.";
    case "medium":
      return "Some risk — keep standard rota, monitor afternoon showers; have rain packaging ready.";
    case "low":
      return "Favourable — full outdoor walk-in expected; standard staffing; clear-sky promotion friendly.";
  }
}

interface DayCardProps {
  day: DayData;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}

function DayCard({ day, index, expanded, onToggle }: DayCardProps) {
  const { Icon, color, label } = weatherIconForDay(day);
  const risk = dayRiskScore(day);
  const level = riskLevel(risk);
  const isToday = index === 0;
  const isTomorrow = index === 1;
  const rainPercent = (day.precipProb * 100).toFixed(0);
  const tempRange = day.tempMaxC - day.tempMinC;

  // Approximate sunrise/sunset for Vietnam (~6:00 / 18:00, varies ±30min by season)
  const d = new Date(day.date + "T00:00:00");
  const month = d.getMonth();
  const sunriseMin = 5 * 60 + (month >= 4 && month <= 8 ? 50 : 35); // ~5:35–5:50
  const sunsetMin = 18 * 60 + (month >= 4 && month <= 8 ? 10 : 25); // ~18:10–18:25
  const sunriseLabel = `${String(Math.floor(sunriseMin / 60)).padStart(2, "0")}:${String(sunriseMin % 60).padStart(2, "0")}`;
  const sunsetLabel = `${String(Math.floor(sunsetMin / 60)).padStart(2, "0")}:${String(sunsetMin % 60).padStart(2, "0")}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "card-interactive animate-fade-in-up flex cursor-pointer flex-col gap-2.5 rounded-xl border bg-card p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40",
        isToday && "border-[var(--brand)]/40 ring-1 ring-[var(--brand)]/20",
        expanded && "ring-1 ring-[var(--brand)]/30",
      )}
      style={{ animationDelay: `${index * 70}ms`, animationFillMode: "both" }}
      aria-expanded={expanded}
    >
      {/* Header: day + risk badge */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold">{dayLabel(day.date, index)}</span>
            {isToday && (
              <Badge
                variant="outline"
                className="border-[var(--brand)]/40 px-1 py-0 text-[9px] text-[var(--brand)]"
              >
                PLAN
              </Badge>
            )}
            {isTomorrow && (
              <Badge variant="outline" className="px-1 py-0 text-[9px]">
                NEXT
              </Badge>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">{dateLabel(day.date)}</div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "border px-1.5 py-0 text-[9px] font-semibold",
            riskBgClass(level),
            riskColorClass(level),
          )}
        >
          {riskLabel(level)}
        </Badge>
      </div>

      {/* Large icon + temperature */}
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full bg-muted/40",
            color,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-2xl font-bold tabular-nums">
              {day.tempMaxC.toFixed(0)}°
            </span>
            <span className="text-xs text-muted-foreground">
              / {day.tempMinC.toFixed(0)}°
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
      </div>

      {/* Rain probability bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <CloudRain className="h-3 w-3" /> Rain
          </span>
          <span className={cn("font-bold tabular-nums", riskColorClass(level))}>
            {rainPercent}%
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
              riskBarClass(level),
            )}
            style={{ width: `${rainPercent}%` }}
          />
        </div>
      </div>

      {/* Compact stats */}
      <div className="grid grid-cols-3 gap-1 text-[10px]">
        <div className="flex items-center gap-1 rounded-md bg-muted/30 px-1.5 py-1 text-muted-foreground">
          <Wind className="h-3 w-3 shrink-0" />
          <span className="font-medium tabular-nums text-foreground">
            {day.windMaxKmh.toFixed(0)}
          </span>
          <span>km/h</span>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-muted/30 px-1.5 py-1 text-muted-foreground">
          <Droplets className="h-3 w-3 shrink-0" />
          <span className="font-medium tabular-nums text-foreground">
            {day.precipSumMm.toFixed(1)}
          </span>
          <span>mm</span>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-muted/30 px-1.5 py-1 text-muted-foreground">
          <Thermometer className="h-3 w-3 shrink-0" />
          <span className="font-medium tabular-nums text-foreground">
            ±{tempRange.toFixed(0)}°
          </span>
        </div>
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="animate-fade-in-up space-y-2 rounded-lg border bg-muted/20 p-2.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Zap className="h-3 w-3" /> Operations impact
            </span>
            <span className={cn("font-semibold", riskColorClass(level))}>
              {riskLabel(level)}
            </span>
          </div>
          <p className="text-[11px] leading-snug text-foreground/80">
            {operationsImpact(level)}
          </p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center gap-1.5">
              <Gauge className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Wind max</span>
              <span className="ml-auto font-medium tabular-nums">
                {day.windMaxKmh.toFixed(0)} km/h
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CloudRain className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Total rain</span>
              <span className="ml-auto font-medium tabular-nums">
                {day.precipSumMm.toFixed(1)} mm
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sunrise className="h-3 w-3 text-amber-500" />
              <span className="text-muted-foreground">Sunrise</span>
              <span className="ml-auto font-medium tabular-nums">{sunriseLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sunset className="h-3 w-3 text-orange-500" />
              <span className="text-muted-foreground">Sunset</span>
              <span className="ml-auto font-medium tabular-nums">{sunsetLabel}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expand hint */}
      <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground/80">
        <span>{expanded ? "Less" : "Details"}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-300",
            expanded && "rotate-180",
          )}
        />
      </div>
    </div>
  );
}

/** Horizontal timeline strip with mini weather icons + risk colors. */
function TimelineStrip({ days }: { days: DayData[] }) {
  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
      {days.map((day, i) => {
        const { Icon, color } = weatherIconForDay(day);
        const risk = dayRiskScore(day);
        const level = riskLevel(risk);
        return (
          <Tooltip key={day.date} delayDuration={120}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex min-w-[52px] flex-1 cursor-default flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-colors",
                  riskBgClass(level),
                )}
              >
                <span className="text-[9px] font-bold text-muted-foreground">
                  {dayLabel(day.date, i).slice(0, 3)}
                </span>
                <Icon className={cn("h-4 w-4", color)} />
                <span className="text-[10px] font-bold tabular-nums">
                  {day.tempMaxC.toFixed(0)}°
                </span>
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", riskBarClass(level))}
                    style={{ width: `${(day.precipProb * 100).toFixed(0)}%` }}
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="text-center">
                <div className="font-semibold">
                  {dayLabel(day.date, i)} · {dateLabel(day.date)}
                </div>
                <div className="text-muted-foreground">
                  {(day.precipProb * 100).toFixed(0)}% rain · {day.precipSumMm.toFixed(1)}mm ·{" "}
                  {day.windMaxKmh.toFixed(0)}km/h
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

interface SummaryStatProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

function SummaryStat({ icon: Icon, label, value, sub, accent }: SummaryStatProps) {
  return (
    <div className="metric-card flex flex-col gap-1 rounded-lg bg-card p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3 w-3", accent)} />
        {label}
      </div>
      <div className="text-base font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function DailyForecastPanel({ weather }: { weather: WeatherSignal }) {
  const t = useT();
  const days = weather.dailyForecast.slice(0, 7);
  const [expandedDay, setExpandedDay] = React.useState<string | null>(
    days[0]?.date ?? null,
  );

  // Weekly summary computations
  const avgTemp = days.length
    ? days.reduce((acc, d) => acc + (d.tempMaxC + d.tempMinC) / 2, 0) / days.length
    : 0;
  const rainDays = days.filter((d) => d.precipProb > 0.3).length;

  const peakRainDay = days.length
    ? days.reduce((max, d) => (d.precipProb > max.precipProb ? d : max), days[0])
    : null;
  const peakRainIdx = peakRainDay
    ? days.findIndex((d) => d.date === peakRainDay.date)
    : -1;

  const bestDay = days.length
    ? days.reduce(
        (best, d) => (dayRiskScore(d) < dayRiskScore(best) ? d : best),
        days[0],
      )
    : null;
  const bestIdx = bestDay ? days.findIndex((d) => d.date === bestDay.date) : -1;

  const worstDay = days.length
    ? days.reduce(
        (worst, d) => (dayRiskScore(d) > dayRiskScore(worst) ? d : worst),
        days[0],
      )
    : null;
  const worstIdx = worstDay
    ? days.findIndex((d) => d.date === worstDay.date)
    : -1;

  return (
    <Card className="card-interactive animate-fade-in-up overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                7-Day Forecast
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Daily outlook for planning
              </p>
            </div>
          </div>
          <LiveBadge isLive={weather.isLive} source={weather.source} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weekly summary strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryStat
            icon={Thermometer}
            label="Avg Temp"
            value={`${avgTemp.toFixed(1)}°C`}
            sub={`across ${days.length} day${days.length === 1 ? "" : "s"}`}
            accent="text-orange-500"
          />
          <SummaryStat
            icon={CloudRain}
            label="Rain Days"
            value={`${rainDays}`}
            sub={`of ${days.length} days`}
            accent="text-blue-500"
          />
          <SummaryStat
            icon={Zap}
            label="Peak Rain"
            value={`${((peakRainDay?.precipProb ?? 0) * 100).toFixed(0)}%`}
            sub={peakRainDay ? dayLabel(peakRainDay.date, peakRainIdx) : "—"}
            accent="text-violet-500"
          />
          <SummaryStat
            icon={Trophy}
            label="Best Day"
            value={bestDay ? dayLabel(bestDay.date, bestIdx) : "—"}
            sub={bestDay ? `${(dayRiskScore(bestDay) * 100).toFixed(0)}% risk` : "—"}
            accent="text-emerald-500"
          />
          <SummaryStat
            icon={AlertTriangle}
            label="Worst Day"
            value={worstDay ? dayLabel(worstDay.date, worstIdx) : "—"}
            sub={worstDay ? `${(dayRiskScore(worstDay) * 100).toFixed(0)}% risk` : "—"}
            accent="text-red-500"
          />
        </div>

        <Separator />

        {/* Visual timeline */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" />
            Visual Timeline
          </div>
          <TimelineStrip days={days} />
        </div>

        <Separator />

        {/* Daily cards */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              Daily Breakdown
            </div>
            <span className="text-[10px] text-muted-foreground">
              Click a day to expand
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {days.map((day, i) => (
              <DayCard
                key={day.date}
                day={day}
                index={i}
                expanded={expandedDay === day.date}
                onToggle={() =>
                  setExpandedDay((prev) => (prev === day.date ? null : day.date))
                }
              />
            ))}
          </div>
        </div>

        {/* Planning note */}
        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5 text-[10px] text-muted-foreground">
          <Sun className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
          <span>
            <strong className="text-foreground">Planning note:</strong> Today&apos;s
            plan targets tomorrow&apos;s operations. Use this outlook to schedule
            replenishment, staff rota, and campaign timing — e.g. if rain is likely
            tomorrow + day-after, pre-order packaging now.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
