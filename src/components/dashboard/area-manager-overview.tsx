"use client";

import * as React from "react";
import {
  LayoutGrid,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ArrowUpDown,
  Star,
  MapPin,
  Download,
  Building2,
  ShoppingBag,
  Home,
  Trees,
  Briefcase,
  Store,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/language-provider";
import {
  riskLevel,
  riskColorClass,
  riskBgClass,
  LiveBadge,
  storeTypeLabel,
  storeTypeIcon,
  formatTimeShort,
} from "./shared";
import type { RiskLevel } from "./shared";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client/fetchJson";

interface Snapshot {
  storeId: string;
  storeName: string;
  district: string;
  storeType: string;
  operatingType: string;
  highlight?: string;
  isLive: boolean;
  rainRiskScore: number;
  heatRiskScore: number;
  deliveryDisruptionRisk: number;
  walkInDropRisk: number;
  overallRisk: number;
  temperatureC: number;
  precipitationMm: number;
  dataConfidence: number;
  fetchedAt: string;
}

type SortKey = "overallRisk" | "rainRiskScore" | "deliveryDisruptionRisk" | "walkInDropRisk" | "heatRiskScore" | "temperatureC" | "fetchedAt";

// ═══════════════════════════════════════════════════════════════
// Filter model — single source of truth for active filter
// ═══════════════════════════════════════════════════════════════
type Filter =
  | { kind: "all" }
  | { kind: "critical" }
  | { kind: "high+" }
  | { kind: "type"; value: string };

const TYPE_FILTERS: { value: string; label: string; icon: React.ElementType }[] = [
  { value: "urban-street", label: "Urban", icon: Building2 },
  { value: "mall", label: "Mall", icon: ShoppingBag },
  { value: "residential", label: "Residential", icon: Home },
  { value: "suburban", label: "Suburban", icon: Trees },
  { value: "office-area", label: "Office", icon: Briefcase },
];

function RiskCell({ score }: { score: number }) {
  const level = riskLevel(score) as RiskLevel;
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", level === "critical" ? "bg-[var(--risk-critical)]" : level === "high" ? "bg-[var(--risk-high)]" : level === "medium" ? "bg-[var(--risk-medium)]" : "bg-[var(--risk-low)]")}
          style={{ width: `${score * 100}%` }}
        />
      </div>
      <span className={cn("text-[10px] font-bold tabular-nums", riskColorClass(level))}>
        {(score * 100).toFixed(0)}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OverallRiskGauge — wide gradient bar visual gauge
// ═══════════════════════════════════════════════════════════════
function OverallRiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  const barCls =
    level === "critical"
      ? "risk-bar-critical"
      : level === "high"
        ? "risk-bar-high"
        : level === "medium"
          ? "risk-bar-medium"
          : "risk-bar-low";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barCls)}
          style={{ width: `${score * 100}%` }}
        />
      </div>
      <Badge
        variant="outline"
        className={cn("h-5 px-1.5 tabular-nums text-[10px] font-bold", riskBgClass(level), riskColorClass(level))}
      >
        {(score * 100).toFixed(0)}%
      </Badge>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DistributionChart — CSS bar chart of risk buckets across all stores
// ═══════════════════════════════════════════════════════════════
function DistributionChart({ snapshots }: { snapshots: Snapshot[] }) {
  const buckets: { label: string; level: RiskLevel; count: number; barCls: string; dot: string }[] = [
    { label: "Low", level: "low", count: 0, barCls: "risk-bar-low", dot: "bg-[var(--risk-low)]" },
    { label: "Medium", level: "medium", count: 0, barCls: "risk-bar-medium", dot: "bg-[var(--risk-medium)]" },
    { label: "High", level: "high", count: 0, barCls: "risk-bar-high", dot: "bg-[var(--risk-high)]" },
    { label: "Critical", level: "critical", count: 0, barCls: "risk-bar-critical", dot: "bg-[var(--risk-critical)]" },
  ];
  for (const s of snapshots) {
    const lvl = riskLevel(s.overallRisk) as RiskLevel;
    const b = buckets.find((x) => x.level === lvl);
    if (b) b.count += 1;
  }
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const total = snapshots.length || 1;

  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <Layers className="h-3 w-3" />
          Risk Distribution
        </span>
        <span className="text-[9px] text-muted-foreground">{total} stores</span>
      </div>
      <div className="space-y-1">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="flex w-14 shrink-0 items-center gap-1 text-[10px] font-medium">
              <span className={cn("inline-block h-2 w-2 rounded-full", b.dot)} />
              {b.label}
            </span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-background">
              <div
                className={cn("h-full rounded-sm transition-all", b.barCls)}
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
            <span className="w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-foreground">
              {b.count}
            </span>
            <span className="w-9 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
              {((b.count / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      {/* Per-store strip — one thin vertical bar per store, colored by risk */}
      <div className="mt-2 border-t pt-2">
        <div className="mb-1 text-[9px] text-muted-foreground">Per-store overview (highest → lowest):</div>
        <div className="flex h-6 items-end gap-0.5">
          {snapshots.map((s) => {
            const lvl = riskLevel(s.overallRisk) as RiskLevel;
            const h = Math.max(20, s.overallRisk * 100);
            const bg =
              lvl === "critical"
                ? "bg-[var(--risk-critical)]"
                : lvl === "high"
                  ? "bg-[var(--risk-high)]"
                  : lvl === "medium"
                    ? "bg-[var(--risk-medium)]"
                    : "bg-[var(--risk-low)]";
            return (
              <TooltipProvider key={s.storeId} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn("flex-1 rounded-t-sm transition-all hover:opacity-80", bg)}
                      style={{ height: `${h}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-[11px] font-semibold">{s.storeName}</p>
                    <p className="text-[10px] text-primary-foreground/80">
                      {storeTypeLabel(s.storeType)} · {s.district}
                    </p>
                    <p className="text-[10px]">
                      Overall: <span className="font-bold">{(s.overallRisk * 100).toFixed(0)}%</span> ({lvl})
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// StoreTypeIcon — small badge with the store-type emoji + Lucide icon
// ═══════════════════════════════════════════════════════════════
function StoreTypeBadge({ storeType }: { storeType: string }) {
  const emoji = storeTypeIcon(storeType);
  const map: Record<string, React.ElementType> = {
    "urban-street": Building2,
    mall: ShoppingBag,
    residential: Home,
    suburban: Trees,
    "office-area": Briefcase,
  };
  const Icon = map[storeType] ?? Store;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border bg-muted/40 text-[11px]">
            <Icon className="h-3 w-3 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-[11px] font-semibold">
            {emoji} {storeTypeLabel(storeType)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ═══════════════════════════════════════════════════════════════
// FilterButton — toggle button with brand gradient when active
// ═══════════════════════════════════════════════════════════════
function FilterButton({
  active,
  onClick,
  icon: Icon,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ElementType;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-all",
        active
          ? "brand-gradient-vivid border-transparent text-white shadow-sm"
          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
      {count != null && (
        <span
          className={cn(
            "ml-0.5 rounded-full px-1 text-[9px] font-bold tabular-nums",
            active ? "bg-white/25 text-white" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function AreaManagerOverview({ onSelectStore }: { onSelectStore: (id: string) => void }) {
  const t = useT();
  const [snapshots, setSnapshots] = React.useState<Snapshot[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>("overallRisk");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>({ kind: "all" });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ snapshots: Snapshot[]; count: number }>("/api/area-overview");
      setSnapshots(data.snapshots ?? []);
      toast.success(`Loaded ${data.count} stores`);
    } catch {
      toast.error("Failed to load area overview");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  // ═══ Apply risk/type filter first (search query is applied in `sorted`) ═══
  const riskFiltered = React.useMemo(() => {
    switch (filter.kind) {
      case "critical":
        return snapshots.filter((s) => s.overallRisk >= 0.7);
      case "high+":
        return snapshots.filter((s) => s.overallRisk >= 0.5);
      case "type":
        return snapshots.filter((s) => s.storeType === filter.value);
      case "all":
      default:
        return snapshots;
    }
  }, [snapshots, filter]);

  const sorted = React.useMemo(() => {
    const filtered = query.trim()
      ? riskFiltered.filter(
          (s) =>
            s.storeName.toLowerCase().includes(query.toLowerCase()) ||
            s.district.toLowerCase().includes(query.toLowerCase()) ||
            s.operatingType.toLowerCase().includes(query.toLowerCase()),
        )
      : riskFiltered;
    const sortedArr = [...filtered].sort((a, b) => {
      let av: number | string = a[sortKey] as number | string;
      let bv: number | string = b[sortKey] as number | string;
      if (sortKey === "fetchedAt") {
        av = new Date(a.fetchedAt).getTime();
        bv = new Date(b.fetchedAt).getTime();
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      return sortDir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
    return sortedArr;
  }, [riskFiltered, sortKey, sortDir, query]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // ═══ Summary stats — always computed from the FULL snapshot set ═══
  const stats = React.useMemo(() => {
    if (!snapshots.length) return null;
    const critical = snapshots.filter((s) => s.overallRisk >= 0.7).length;
    const high = snapshots.filter((s) => s.overallRisk >= 0.5 && s.overallRisk < 0.7).length;
    const medium = snapshots.filter((s) => s.overallRisk >= 0.3 && s.overallRisk < 0.5).length;
    const low = snapshots.filter((s) => s.overallRisk < 0.3).length;
    const live = snapshots.filter((s) => s.isLive).length;
    const avgRisk = snapshots.reduce((a, s) => a + s.overallRisk, 0) / snapshots.length;
    return { critical, high, medium, low, live, avgRisk, total: snapshots.length };
  }, [snapshots]);

  // ═══ Export CSV ═══
  const exportCSV = React.useCallback(() => {
    if (!sorted.length) {
      toast.error("Nothing to export — no stores match the current filter.");
      return;
    }
    const headers = [
      "storeId",
      "storeName",
      "district",
      "storeType",
      "operatingType",
      "overallRisk",
      "rainRiskScore",
      "heatRiskScore",
      "deliveryDisruptionRisk",
      "walkInDropRisk",
      "temperatureC",
      "precipitationMm",
      "dataConfidence",
      "isLive",
      "fetchedAt",
    ];
    const rows = sorted.map((s) => [
      s.storeId,
      `"${s.storeName.replace(/"/g, '""')}"`,
      `"${s.district.replace(/"/g, '""')}"`,
      s.storeType,
      s.operatingType,
      (s.overallRisk * 100).toFixed(0),
      (s.rainRiskScore * 100).toFixed(0),
      (s.heatRiskScore * 100).toFixed(0),
      (s.deliveryDisruptionRisk * 100).toFixed(0),
      (s.walkInDropRisk * 100).toFixed(0),
      s.temperatureC.toFixed(1),
      s.precipitationMm.toFixed(1),
      (s.dataConfidence * 100).toFixed(0),
      s.isLive ? "live" : "fallback",
      s.fetchedAt,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    link.download = `kfc-area-overview-${ts}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${sorted.length} stores to CSV`);
  }, [sorted]);

  const renderSortHeader = (label: string, k: SortKey, className?: string) => (
    <TableHead className={cn("cursor-pointer select-none", className)} onClick={() => toggleSort(k)}>
      <span className="flex items-center gap-1 hover:text-foreground">
        {label}
        <ArrowUpDown className={cn("h-2.5 w-2.5", sortKey === k ? "text-[var(--brand)]" : "text-muted-foreground/50")} />
      </span>
    </TableHead>
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4 text-[var(--brand)]" />
              Area Manager Overview
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              All {snapshots.length} stores at a glance · sorted by risk · click any row to open
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={exportCSV}
              disabled={loading || sorted.length === 0}
              className="h-7 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-7 gap-1.5 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
        </div>

        {/* ═══ Summary stat strip with horizontal distribution bar ═══ */}
        {stats && (
          <div className="mt-3 rounded-lg border bg-card p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Store className="h-3 w-3 text-[var(--brand)]" />
                <span className="font-bold tabular-nums">{stats.total}</span> stores
              </Badge>
              <Badge variant="outline" className={cn("gap-1 text-[10px] font-bold risk-bg-critical risk-border-critical risk-text-critical")}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk-critical)]" />
                {stats.critical} critical
              </Badge>
              <Badge variant="outline" className={cn("gap-1 text-[10px] font-bold risk-bg-high risk-border-high risk-text-high")}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk-high)]" />
                {stats.high} high
              </Badge>
              <Badge variant="outline" className={cn("gap-1 text-[10px] font-bold risk-bg-medium risk-border-medium risk-text-medium")}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk-medium)]" />
                {stats.medium} medium
              </Badge>
              <Badge variant="outline" className={cn("gap-1 text-[10px] font-bold risk-bg-low risk-border-low risk-text-low")}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk-low)]" />
                {stats.low} low
              </Badge>
              <Badge variant="outline" className="gap-1 text-[10px]">
                <LiveBadge isLive={stats.live > 0} />
                {stats.live}/{stats.total} live
              </Badge>
              <Badge variant="outline" className="gap-1 text-[10px]">
                avg risk <span className="font-bold tabular-nums">{(stats.avgRisk * 100).toFixed(0)}%</span>
              </Badge>
            </div>

            {/* Horizontal stacked distribution bar */}
            <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {[
                { count: stats.low, cls: "bg-[var(--risk-low)]" },
                { count: stats.medium, cls: "bg-[var(--risk-medium)]" },
                { count: stats.high, cls: "bg-[var(--risk-high)]" },
                { count: stats.critical, cls: "bg-[var(--risk-critical)]" },
              ].map((seg, i) => (
                <div
                  key={i}
                  className={cn("h-full transition-all", seg.cls)}
                  style={{ width: `${(seg.count / stats.total) * 100}%` }}
                  title={`${seg.count} stores`}
                />
              ))}
            </div>
          </div>
        )}

        {/* ═══ Quick filter toggles ═══ */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Filter:</span>
          <FilterButton
            active={filter.kind === "all"}
            onClick={() => setFilter({ kind: "all" })}
            count={snapshots.length}
          >
            All Stores
          </FilterButton>
          <FilterButton
            active={filter.kind === "critical"}
            onClick={() => setFilter({ kind: "critical" })}
            icon={AlertTriangle}
            count={stats?.critical}
          >
            Critical Only
          </FilterButton>
          <FilterButton
            active={filter.kind === "high+"}
            onClick={() => setFilter({ kind: "high+" })}
            count={stats ? stats.critical + stats.high : undefined}
          >
            High+
          </FilterButton>
          <span className="mx-1 h-4 w-px bg-border" />
          {TYPE_FILTERS.map((tf) => {
            const Icon = tf.icon;
            const count = snapshots.filter((s) => s.storeType === tf.value).length;
            return (
              <FilterButton
                key={tf.value}
                active={filter.kind === "type" && filter.value === tf.value}
                onClick={() => setFilter({ kind: "type", value: tf.value })}
                icon={Icon}
                count={count}
              >
                {tf.label}
              </FilterButton>
            );
          })}
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, district, or type…"
          className="mt-2 h-8 text-xs"
        />
      </CardHeader>
      <CardContent>
        {loading && snapshots.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {/* ═══ Enhanced table ═══ */}
            <ScrollArea className="h-[440px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[36px]" />
                    <TableHead className="w-[200px]">Store</TableHead>
                    {renderSortHeader("Overall", "overallRisk")}
                    {renderSortHeader("Rain", "rainRiskScore")}
                    {renderSortHeader("Delivery", "deliveryDisruptionRisk")}
                    {renderSortHeader("Walk-in", "walkInDropRisk")}
                    {renderSortHeader("Heat", "heatRiskScore")}
                    {renderSortHeader("Temp", "temperatureC")}
                    {renderSortHeader("Updated", "fetchedAt")}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((s, idx) => {
                    const level = riskLevel(s.overallRisk) as RiskLevel;
                    return (
                      <TableRow
                        key={s.storeId}
                        onClick={() => onSelectStore(s.storeId)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-accent/50",
                          // zebra striping
                          idx % 2 === 1 && "bg-muted/25",
                          // risk-tinted rows for critical / high
                          s.overallRisk >= 0.7 && "risk-bg-critical",
                          s.overallRisk >= 0.5 && s.overallRisk < 0.7 && "risk-bg-high",
                        )}
                      >
                        <TableCell className="px-2">
                          <StoreTypeBadge storeType={s.storeType} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {s.highlight && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold">{s.storeName}</div>
                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                <MapPin className="h-2 w-2" />
                                {s.district}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <OverallRiskGauge score={s.overallRisk} level={level} />
                        </TableCell>
                        <TableCell><RiskCell score={s.rainRiskScore} /></TableCell>
                        <TableCell><RiskCell score={s.deliveryDisruptionRisk} /></TableCell>
                        <TableCell><RiskCell score={s.walkInDropRisk} /></TableCell>
                        <TableCell><RiskCell score={s.heatRiskScore} /></TableCell>
                        <TableCell>
                          <span className="text-[10px] font-medium tabular-nums">{s.temperatureC.toFixed(0)}°C</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[9px] tabular-nums text-muted-foreground">
                            {formatTimeShort(s.fetchedAt)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {sorted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                        No stores match the current filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* ═══ Distribution chart + critical alert row ═══ */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DistributionChart snapshots={snapshots} />
              {stats && stats.critical > 0 ? (
                <div className="flex items-start gap-2 rounded-lg border risk-border-critical risk-bg-critical p-3 text-xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 risk-text-critical" />
                  <div className="space-y-1">
                    <span className="block text-foreground">
                      <strong className="risk-text-critical">{stats.critical} store(s) at critical risk</strong> — prioritize these for the next operations review.
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      Use the <span className="font-semibold">Critical Only</span> filter above to isolate them, then click a row to open its live action plan.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  No critical-risk stores — operations are stable.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
