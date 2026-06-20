"use client";

import * as React from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ReferenceLine,
  Label,
} from "recharts";
import {
  CloudRain,
  Thermometer,
  Clock,
  LineChart as LineChartIcon,
  Download,
  Wind,
  Zap,
  Activity,
  Droplets,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WeatherSignal } from "@/lib/types";
import { useT } from "@/lib/i18n/language-provider";
import { LiveBadge } from "./shared";
import { cn } from "@/lib/utils";

type MetricView = "all" | "temp" | "rain" | "wind";

interface ChartDatum {
  hour: string;
  hourShort: string;
  hourLabel: string;
  tempC: number;
  precipProb: number;
  precipMm: number;
  windKmh: number;
}

function toChartData(signal: WeatherSignal): ChartDatum[] {
  return signal.hourlyForecast.slice(0, 24).map((h) => {
    const d = new Date(h.time);
    const hourShort = d.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
    });
    return {
      hour: h.time,
      hourShort,
      hourLabel: `${hourShort}:00`,
      tempC: Number(h.tempC.toFixed(1)),
      precipProb: Math.round(h.precipProb * 100),
      precipMm: Number(h.precipMm.toFixed(1)),
      windKmh: Number(h.windKmh.toFixed(1)),
    };
  });
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string; dataKey: string; payload?: ChartDatum }[];
  label?: string;
  view: MetricView;
}

function ChartTooltip({ active, payload, view }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as ChartDatum | undefined;
  if (!data) return null;
  return (
    <div className="min-w-[180px] rounded-lg border bg-popover p-3 text-xs shadow-md">
      <div className="mb-2 flex items-center gap-1.5 border-b pb-1.5 text-[11px] font-semibold">
        <Clock className="h-3 w-3 text-muted-foreground" />
        {data.hourLabel} ICT
      </div>
      <div className="space-y-1">
        {(view === "all" || view === "temp") && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Thermometer className="h-3 w-3 text-orange-500" /> Temperature
            </span>
            <span className="font-semibold tabular-nums">{data.tempC}°C</span>
          </div>
        )}
        {(view === "all" || view === "rain") && (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CloudRain className="h-3 w-3 text-blue-500" /> Rain prob
              </span>
              <span className="font-semibold tabular-nums">
                {data.precipProb}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Droplets className="h-3 w-3 text-sky-500" /> Rainfall
              </span>
              <span className="font-semibold tabular-nums">{data.precipMm}mm</span>
            </div>
          </>
        )}
        {(view === "all" || view === "wind") && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Wind className="h-3 w-3 text-teal-500" /> Wind
            </span>
            <span className="font-semibold tabular-nums">{data.windKmh} km/h</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatTileProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  accent: string;
}

function StatTile({ icon: Icon, label, value, sub, accent }: StatTileProps) {
  return (
    <div className="metric-card flex flex-col gap-1 rounded-lg bg-card p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3 w-3", accent)} />
        {label}
      </div>
      <div className="text-base font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

interface MetricToggleProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

function MetricToggle({ active, onClick, icon: Icon, label }: MetricToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
        active
          ? "brand-gradient-vivid text-white shadow-sm"
          : "border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground",
      )}
      aria-pressed={active}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

export function WeatherForecastChart({ weather }: { weather: WeatherSignal }) {
  const t = useT();
  const data = React.useMemo(() => toChartData(weather), [weather]);
  const [view, setView] = React.useState<MetricView>("all");

  // Summary stats
  const maxTemp = data.length ? Math.max(...data.map((d) => d.tempC)) : 0;
  const minTemp = data.length ? Math.min(...data.map((d) => d.tempC)) : 0;
  const maxRainProb = data.length ? Math.max(...data.map((d) => d.precipProb)) : 0;
  const maxWind = data.length ? Math.max(...data.map((d) => d.windKmh)) : 0;
  const avgTemp = data.length
    ? data.reduce((a, d) => a + d.tempC, 0) / data.length
    : 0;
  const totalRainMm = data.reduce((acc, d) => acc + d.precipMm, 0);

  // Peak indices
  const peakTempIdx = data.findIndex((d) => d.tempC === maxTemp);
  const peakRainIdx = data.findIndex((d) => d.precipProb === maxRainProb);
  const peakWindIdx = data.findIndex((d) => d.windKmh === maxWind);

  const peakTempHour = peakTempIdx >= 0 ? data[peakTempIdx].hourShort : "—";
  const peakRainHour = peakRainIdx >= 0 ? data[peakRainIdx].hourShort : "—";
  const peakWindHour = peakWindIdx >= 0 ? data[peakWindIdx].hourShort : "—";

  const peakRainHours = data.filter((d) => d.precipProb > 50).map((d) => d.hourShort);

  // Current time marker — find hour closest to now (ICT)
  const now = new Date();
  const currentHourStr = now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
  });
  const currentIdx = data.findIndex((d) => d.hourShort === currentHourStr);

  const showTemp = view === "all" || view === "temp";
  const showRain = view === "all" || view === "rain";
  const showWind = view === "all" || view === "wind";
  const showLeftAxis = showTemp || showWind;
  const showRightAxis = showRain;
  const nowYAxis = showLeftAxis ? "temp" : "rain";

  return (
    <Card className="card-interactive animate-fade-in-up overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md">
              <LineChartIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                24-Hour Forecast
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Temperature · Rain · Wind
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Thermometer className="h-2.5 w-2.5 text-orange-500" />
              {minTemp.toFixed(0)}–{maxTemp.toFixed(0)}°C
            </Badge>
            {maxRainProb > 50 && (
              <Badge
                variant="outline"
                className="risk-bg-high risk-border-high risk-text-high gap-1 text-[10px]"
              >
                <CloudRain className="h-2.5 w-2.5" />
                max {maxRainProb}%
              </Badge>
            )}
            <LiveBadge isLive={weather.isLive} source={weather.source} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Chart controls + export */}
        <div className="flex flex-wrap items-center gap-1.5">
          <MetricToggle
            active={view === "all"}
            onClick={() => setView("all")}
            icon={Activity}
            label="All metrics"
          />
          <MetricToggle
            active={view === "temp"}
            onClick={() => setView("temp")}
            icon={Thermometer}
            label="Temperature"
          />
          <MetricToggle
            active={view === "rain"}
            onClick={() => setView("rain")}
            icon={CloudRain}
            label="Rain"
          />
          <MetricToggle
            active={view === "wind"}
            onClick={() => setView("wind")}
            icon={Wind}
            label="Wind"
          />
          <div className="ml-auto">
            <UITooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[10px]"
                    disabled
                  >
                    <Download className="h-3 w-3" />
                    PNG
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon — chart export is on the roadmap</TooltipContent>
            </UITooltip>
          </div>
        </div>

        {/* Peak rain alert — prominent */}
        {peakRainHours.length > 0 && (
          <div className="relative overflow-hidden rounded-lg border risk-border-high animate-fade-in-up">
            <div className="absolute inset-0 risk-bg-high opacity-60" />
            <div className="relative flex items-start gap-2.5 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                <CloudRain className="h-4 w-4 risk-text-high animate-pulse-soft" />
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide risk-text-high">
                    Peak Rain Window
                  </span>
                  <Badge
                    variant="outline"
                    className="risk-bg-high risk-border-high risk-text-high px-1 py-0 text-[9px]"
                  >
                    {peakRainHours.length}h
                  </Badge>
                </div>
                <p className="text-[11px] text-foreground">
                  <span className="font-semibold">
                    {peakRainHours.slice(0, 6).join(", ")}:00
                  </span>{" "}
                  — {peakRainHours.length}h above 50% rain probability. Total forecast
                  precipitation:{" "}
                  <span className="font-semibold">{totalRainMm.toFixed(1)}mm</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="h-[260px] w-full rounded-lg border bg-card/30 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 14, right: 12, bottom: 4, left: -8 }}>
              <defs>
                <linearGradient id="tempGradientEnh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.19 40)" stopOpacity={0.5} />
                  <stop offset="55%" stopColor="oklch(0.7 0.18 50)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="oklch(0.7 0.18 50)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rainGradientEnh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.6 0.18 240)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="oklch(0.65 0.15 220)" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="oklch(from var(--foreground) l c h / 0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="hourShort"
                tick={{ fontSize: 10, fill: "oklch(from var(--muted-foreground) l c h)" }}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              {showLeftAxis && (
                <YAxis
                  yAxisId="temp"
                  orientation="left"
                  tick={{ fontSize: 10, fill: "oklch(from var(--muted-foreground) l c h)" }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  domain={["auto", "auto"]}
                />
              )}
              {showRightAxis && (
                <YAxis
                  yAxisId="rain"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "oklch(from var(--muted-foreground) l c h)" }}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                  width={32}
                  domain={[0, 100]}
                />
              )}
              <Tooltip content={<ChartTooltip view={view} />} />

              {/* Peak rain annotation */}
              {showRain && peakRainIdx >= 0 && maxRainProb > 50 && (
                <ReferenceLine
                  yAxisId="rain"
                  x={data[peakRainIdx].hourShort}
                  stroke="oklch(from var(--risk-high) l c h / 0.6)"
                  strokeDasharray="4 4"
                >
                  <Label
                    value={`Peak ${maxRainProb}%`}
                    position="top"
                    fill="oklch(from var(--risk-high) l c h)"
                    fontSize={9}
                    fontWeight={600}
                  />
                </ReferenceLine>
              )}

              {/* Current time marker */}
              {currentIdx >= 0 && (
                <ReferenceLine
                  yAxisId={nowYAxis}
                  x={data[currentIdx].hourShort}
                  stroke="oklch(from var(--brand) l c h / 0.85)"
                  strokeWidth={1.5}
                >
                  <Label
                    value="NOW"
                    position="insideTopLeft"
                    fill="oklch(from var(--brand) l c h)"
                    fontSize={9}
                    fontWeight={700}
                  />
                </ReferenceLine>
              )}

              {showTemp && (
                <Area
                  yAxisId="temp"
                  type="monotone"
                  dataKey="tempC"
                  stroke="oklch(0.65 0.19 40)"
                  strokeWidth={2.5}
                  fill="url(#tempGradientEnh)"
                  name="Temp (°C)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: "oklch(0.65 0.19 40)",
                    stroke: "white",
                    strokeWidth: 2,
                  }}
                  isAnimationActive
                  animationDuration={800}
                />
              )}
              {showRain && (
                <Bar
                  yAxisId="rain"
                  dataKey="precipProb"
                  fill="url(#rainGradientEnh)"
                  radius={[3, 3, 0, 0]}
                  name="Rain prob (%)"
                  barSize={8}
                  isAnimationActive
                  animationDuration={800}
                />
              )}
              {showWind && (
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="windKmh"
                  stroke="oklch(0.6 0.15 180)"
                  strokeWidth={2}
                  dot={false}
                  name="Wind (km/h)"
                  connectNulls
                  isAnimationActive
                  animationDuration={800}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          {showTemp && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{ background: "oklch(0.65 0.19 40 / 0.5)" }}
              />
              Temperature (°C)
            </span>
          )}
          {showRain && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{ background: "oklch(0.6 0.18 240 / 0.6)" }}
              />
              Rain probability (%)
            </span>
          )}
          {showWind && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-0.5 w-4"
                style={{ background: "oklch(0.6 0.15 180)" }}
              />
              Wind (km/h)
            </span>
          )}
        </div>

        {/* Chart stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            icon={Thermometer}
            label="Peak Temp"
            value={`${maxTemp.toFixed(1)}°C`}
            sub={`at ${peakTempHour}:00 ICT`}
            accent="text-orange-500"
          />
          <StatTile
            icon={CloudRain}
            label="Peak Rain"
            value={`${maxRainProb}%`}
            sub={`at ${peakRainHour}:00 ICT`}
            accent="text-blue-500"
          />
          <StatTile
            icon={Wind}
            label="Peak Wind"
            value={`${maxWind.toFixed(1)}`}
            sub={`km/h at ${peakWindHour}:00`}
            accent="text-teal-500"
          />
          <StatTile
            icon={Activity}
            label="Avg Temp"
            value={`${avgTemp.toFixed(1)}°C`}
            sub={`${totalRainMm.toFixed(1)}mm total rain`}
            accent="text-violet-500"
          />
        </div>
      </CardContent>
    </Card>
  );
}
