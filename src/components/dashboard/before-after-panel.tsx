"use client";

import * as React from "react";
import {
  ArrowRight,
  Info,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Settings,
  Users,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { BeforeAfterMetric } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Animated count-up hook ───────────────────────────────────────────
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
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, initial]);
  return value;
}

// ─── Category metadata ────────────────────────────────────────────────
const CATEGORIES: {
  name: string;
  icon: LucideIcon;
  accent: string;
  subtitle: string;
}[] = [
  {
    name: "Tác động Doanh thu",
    icon: DollarSign,
    accent: "text-emerald-600 dark:text-emerald-400",
    subtitle: "Bảo vệ doanh số & giảm hao hụt",
  },
  {
    name: "Vận hành",
    icon: Settings,
    accent: "text-amber-600 dark:text-amber-400",
    subtitle: "Chuẩn xác mẻ prep & nhân sự",
  },
  {
    name: "Khách hàng",
    icon: Users,
    accent: "text-violet-600 dark:text-violet-400",
    subtitle: "Thời gian chờ & SLA giao hàng",
  },
];

const KEY_TO_CATEGORY: Record<string, string> = {
  waste: "Tác động Doanh thu",
  margin: "Tác động Doanh thu",
  stockout: "Vận hành",
  staffing: "Vận hành",
  delivery: "Khách hàng",
};

function metricImproved(m: BeforeAfterMetric): boolean {
  return m.betterIs === "lower" ? m.withAgent < m.withoutAgent : m.withAgent > m.withoutAgent;
}

function metricDeltaPct(m: BeforeAfterMetric): number {
  const delta = m.withAgent - m.withoutAgent;
  const ref = Math.abs(m.withoutAgent) || 1;
  return (delta / ref) * 100;
}

// Aggregated impact score: averaged sign-normalized relative improvement
function computeImpactScore(metrics: BeforeAfterMetric[]) {
  let totalRel = 0;
  let positive = 0;
  let negative = 0;
  metrics.forEach((m) => {
    const improved = metricImproved(m);
    if (improved) positive++;
    else if (m.withAgent !== m.withoutAgent) negative++;
    const ref = Math.abs(m.withoutAgent) || 1;
    const delta = m.withAgent - m.withoutAgent;
    const signed = m.betterIs === "lower" ? -delta : delta; // positive = good
    totalRel += Math.max(-100, Math.min(100, (signed / ref) * 100));
  });
  const avg = metrics.length ? totalRel / metrics.length : 0;
  return { avg, positive, negative };
}

// ─── Large circular impact score gauge ───────────────────────────────
function ImpactScore({ metrics }: { metrics: BeforeAfterMetric[] }) {
  const { avg, positive, negative } = computeImpactScore(metrics);
  // Map [-100, 100] → [0, 100] so 0% improvement = 50/100
  const score = Math.round(Math.max(0, Math.min(100, 50 + avg / 2)));
  const isPositive = avg >= 0;
  const colorVar = isPositive ? "var(--risk-low)" : "var(--risk-high)";
  const size = 88;
  const stroke = 7;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const animatedScore = useCountUp(score, 1000, 0);
  const dash = (animatedScore / 100) * c;

  return (
    <div className="metric-card flex items-center gap-4 rounded-lg">
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
          <span
            className={cn(
              "text-xl font-bold tabular-nums leading-none",
              isPositive ? "risk-text-low" : "risk-text-high",
            )}
          >
            {animatedScore.toFixed(0)}
          </span>
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <Sparkles className={cn("h-3.5 w-3.5", isPositive ? "risk-text-low" : "risk-text-high")} />
          Điểm Tác động Tổng thể
        </div>
        <p className="mt-1 text-sm">
          <span className={cn("font-bold", isPositive ? "risk-text-low" : "risk-text-high")}>
            {isPositive ? "Tích cực ròng" : "Tiêu cực ròng"}
          </span>{" "}
          <span className="text-muted-foreground">trên {metrics.length} chỉ số</span>
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Badge
            variant="outline"
            className="risk-bg-low risk-border-low risk-text-low gap-1 tabular-nums"
          >
            <TrendingUp className="h-3 w-3" /> {positive} cải thiện
          </Badge>
          {negative > 0 && (
            <Badge
              variant="outline"
              className="risk-bg-high risk-border-high risk-text-high gap-1 tabular-nums"
            >
              <TrendingDown className="h-3 w-3" /> {negative} giảm sút
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Single before/after metric card ─────────────────────────────────
function MetricCard({ metric, index }: { metric: BeforeAfterMetric; index: number }) {
  const delta = metric.withAgent - metric.withoutAgent;
  const improved = metricImproved(metric);
  const deltaPct = metricDeltaPct(metric);
  // Animate "after" value counting up from the "before" value
  const beforeV = useCountUp(metric.withoutAgent, 700, 0);
  const afterV = useCountUp(metric.withAgent, 1100, metric.withoutAgent);
  const max = Math.max(metric.withoutAgent, metric.withAgent, 1);
  const beforeH = Math.max(10, (metric.withoutAgent / max) * 100);
  const afterH = Math.max(10, (metric.withAgent / max) * 100);
  const deltaUp = delta > 0;

  return (
    <div
      className="metric-card rounded-lg animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "backwards" }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{metric.label}</span>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px]">
              <p className="text-xs leading-snug">{metric.explanation}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* before → after */}
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold tabular-nums text-muted-foreground/70">
          {beforeV.toFixed(1)}
          {metric.unit}
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span
          className={cn(
            "text-2xl font-bold tabular-nums leading-none",
            improved ? "risk-text-low" : "risk-text-high",
          )}
        >
          {afterV.toFixed(1)}
          {metric.unit}
        </span>
      </div>

      {/* delta % + mini sparkline bars */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div
          className={cn(
            "inline-flex items-center gap-1 text-xs font-bold tabular-nums",
            improved ? "risk-text-low" : "risk-text-high",
          )}
        >
          {deltaUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {deltaPct >= 0 ? "+" : ""}
          {deltaPct.toFixed(0)}%
        </div>
        <div className="flex h-6 items-end gap-1">
          <div
            className="w-2.5 rounded-sm bg-muted-foreground/30"
            style={{
              height: `${beforeH}%`,
              transition: "height 0.8s cubic-bezier(0.16,1,0.3,1)",
            }}
          />
          <div
            className={cn("w-2.5 rounded-sm", improved ? "bg-emerald-500" : "bg-rose-500")}
            style={{
              height: `${afterH}%`,
              transition: "height 1s cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Category group with header + subtotal ───────────────────────────
function CategoryGroup({
  name,
  icon: Icon,
  accent,
  subtitle,
  metrics,
  startIndex,
}: {
  name: string;
  icon: LucideIcon;
  accent: string;
  subtitle: string;
  metrics: BeforeAfterMetric[];
  startIndex: number;
}) {
  // Net improvement % within category (sign-normalized)
  const netImp =
    metrics.reduce((s, m) => {
      const ref = Math.abs(m.withoutAgent) || 1;
      const delta = m.withAgent - m.withoutAgent;
      const signed = m.betterIs === "lower" ? -delta : delta;
      return s + (signed / ref) * 100;
    }, 0) / Math.max(1, metrics.length);
  const positive = netImp >= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", accent)} />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide">{name}</h4>
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "gap-1 tabular-nums",
            positive
              ? "risk-bg-low risk-border-low risk-text-low"
              : "risk-bg-high risk-border-high risk-text-high",
          )}
        >
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {positive ? "+" : ""}
          {netImp.toFixed(0)}% net
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m, i) => (
          <MetricCard key={m.key} metric={m} index={startIndex + i} />
        ))}
      </div>
    </div>
  );
}

// ─── Collapsible methodology footnote ────────────────────────────────
function MethodologyFootnote() {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-muted/40">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60"
        >
          <Info className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
          <span className="font-semibold">Phương pháp</span>
          <span className="truncate text-muted-foreground">— chỉ số mô phỏng, nhất quan nội bộ</span>
          <ChevronRight
            className={cn(
              "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-0 text-[11px] leading-relaxed text-muted-foreground">
        Đây là các chỉ số <strong className="text-foreground">mô phỏng và nhất quán nội bộ</strong> được rút ra
        từ các điểm số rủi ro &amp; lượng cầu thay đổi do agent tính toán — không đại diện cho dữ liệu thực tế bên ngoài.{" "}
        <em>“Không dùng AI”</em> mô tả việc quản lý phản ứng theo thời tiết chung của thành phố (dẫn đến chuẩn bị dư dine-in,
        thiếu nhân sự giao hàng). <em>“Có AI hỗ trợ”</em> mô tả việc áp dụng kế hoạch được khuyến nghị. Các số liệu tuyệt
        đối mang tính minh họa; sự chênh lệch tương đối mới là giá trị demo.
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────
export function BeforeAfterPanel({ metrics }: { metrics: BeforeAfterMetric[] }) {
  // Group metrics by category (skipping empty groups) and compute
  // cumulative start indices for stagger animation in a functional way.
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    metrics: metrics.filter((m) => (KEY_TO_CATEGORY[m.key] ?? "Operations") === cat.name),
  })).filter((g) => g.metrics.length > 0);

  const groupsWithStart = grouped.map((g, i) => ({
    ...g,
    start: grouped.slice(0, i).reduce((sum, gg) => sum + gg.metrics.length, 0),
  }));

  return (
    <Card className="card-interactive overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowRight className="h-4 w-4 text-[var(--brand)]" />
          Không dùng AI vs Có AI hỗ trợ
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Mô phỏng tác động vận hành khi dùng kế hoạch AI theo từng khu vực cửa hàng so với việc quản lý bằng trực giác thời tiết chung của thành phố.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ImpactScore metrics={metrics} />

        {groupsWithStart.map((cat) => (
          <CategoryGroup
            key={cat.name}
            name={cat.name}
            icon={cat.icon}
            accent={cat.accent}
            subtitle={cat.subtitle}
            metrics={cat.metrics}
            startIndex={cat.start}
          />
        ))}

        <MethodologyFootnote />
      </CardContent>
    </Card>
  );
}
