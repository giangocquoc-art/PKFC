"use client";

import * as React from "react";
import {
  Search,
  MapPin,
  Star,
  Heart,
  X,
  SlidersHorizontal,
  SearchX,
  Store as StoreIcon,
  Building2,
  Home,
  Trees,
  Briefcase,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { KfcStore, StoreType } from "@/lib/stores/seed-stores";
import { storeTypeIcon, storeTypeLabel } from "./shared";
import { useT } from "@/lib/i18n/language-provider";
import {
  useFavorites,
  FavoriteButton,
} from "./favorites-provider";

type SortKey = "name" | "district" | "type" | "delivery";
type FilterKey = "all" | StoreType | "highlighted" | "favorites";

const FILTERS: { key: FilterKey; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <StoreIcon className="h-3 w-3" /> },
  { key: "favorites", label: "Favorites", icon: <Heart className="h-3 w-3" /> },
  { key: "urban-street", label: "Urban", icon: <Building2 className="h-3 w-3" /> },
  { key: "mall", label: "Mall", icon: <ShoppingBag className="h-3 w-3" /> },
  { key: "residential", label: "Residential", icon: <Home className="h-3 w-3" /> },
  { key: "suburban", label: "Suburban", icon: <Trees className="h-3 w-3" /> },
  { key: "office-area", label: "Office", icon: <Briefcase className="h-3 w-3" /> },
  { key: "highlighted", label: "Star", icon: <Sparkles className="h-3 w-3" /> },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name A-Z" },
  { key: "district", label: "District" },
  { key: "type", label: "Type" },
  { key: "delivery", label: "Delivery %" },
];

const TYPE_ORDER: StoreType[] = [
  "urban-street",
  "mall",
  "residential",
  "suburban",
  "office-area",
];

export interface StoreSelectorProps {
  stores: KfcStore[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

export function StoreSelector({ stores, selectedId, onSelect, className }: StoreSelectorProps) {
  const t = useT();
  const { favorites, isFavorite } = useFavorites();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [sort, setSort] = React.useState<SortKey>("name");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = stores.filter((s) => {
      if (
        q &&
        !(
          s.name.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          s.storeType.toLowerCase().includes(q) ||
          storeTypeLabel(s.storeType).toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      return true;
    });
    if (filter === "highlighted") list = list.filter((s) => s.highlight);
    else if (filter === "favorites") list = list.filter((s) => isFavorite(s.id));
    else if (filter !== "all") list = list.filter((s) => s.storeType === filter);

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "district":
          return a.district.localeCompare(b.district) || a.name.localeCompare(b.name);
        case "type":
          return a.storeType.localeCompare(b.storeType) || a.name.localeCompare(b.name);
        case "delivery":
          return b.deliveryShare - a.deliveryShare || a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
    return sorted;
  }, [stores, query, filter, sort, isFavorite]);

  const typeBreakdown = React.useMemo(() => {
    const counts: Record<StoreType, number> = {
      "urban-street": 0,
      mall: 0,
      residential: 0,
      suburban: 0,
      "office-area": 0,
    };
    for (const s of filtered) counts[s.storeType]++;
    return counts;
  }, [filtered]);

  const totalStores = stores.length;
  const filteredCount = filtered.length;
  const highlightedCount = filtered.filter((s) => s.highlight).length;
  const favoritesCountInFilter = filtered.filter((s) => isFavorite(s.id)).length;
  const totalFavorites = favorites.length;

  const clearAll = React.useCallback(() => {
    setQuery("");
    setFilter("all");
  }, []);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* ── Search row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="h-10 pl-9 pr-9 text-sm"
            aria-label={t.searchPlaceholder}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t.clearSearch}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger size="sm" className="h-10 w-[148px] gap-1.5" aria-label="Sort stores">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Filter chips ───────────────────────────────────────── */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count =
            f.key === "all"
              ? totalStores
              : f.key === "highlighted"
                ? stores.filter((s) => s.highlight).length
                : f.key === "favorites"
                  ? totalFavorites
                  : stores.filter((s) => s.storeType === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                active
                  ? "view-tab-pill-active border-transparent"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              aria-pressed={active}
            >
              {f.icon}
              {f.label}
              <span
                className={cn(
                  "tabular-nums",
                  active ? "opacity-90" : "text-muted-foreground/70",
                  f.key === "favorites" && count > 0 && !active && "text-amber-600 dark:text-amber-400",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Summary bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold leading-none text-[var(--brand)] tabular-nums">
            {filteredCount}
          </span>
          <span className="text-muted-foreground">
            of <span className="font-medium text-foreground tabular-nums">{totalStores}</span> stores
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-muted-foreground">
          {TYPE_ORDER.map((tp) =>
            typeBreakdown[tp] > 0 ? (
              <span
                key={tp}
                className="inline-flex items-center gap-0.5"
                title={`${storeTypeLabel(tp)}: ${typeBreakdown[tp]}`}
              >
                <span aria-hidden>{storeTypeIcon(tp)}</span>
                <span className="tabular-nums">{typeBreakdown[tp]}</span>
              </span>
            ) : null,
          )}
          {highlightedCount > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-amber-500"
              title="Highlighted stores"
            >
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="tabular-nums">{highlightedCount}</span>
            </span>
          )}
          {totalFavorites > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400"
              title="Your favorite stores"
            >
              <Heart className="h-3 w-3 fill-amber-500/70 text-amber-500" />
              <span className="tabular-nums">{favoritesCountInFilter}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Scrollable store list ──────────────────────────────── */}
      <div className="h-[340px] overflow-y-auto pr-2 scrollbar-thin">
        <div className="flex flex-col gap-1.5">
          {filtered.map((s, idx) => {
            const active = s.id === selectedId;
            const fav = isFavorite(s.id);
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(s.id);
                  }
                }}
                style={{
                  animationDelay: `${Math.min(idx * 25, 300)}ms`,
                  animationFillMode: "both",
                }}
                className={cn(
                  "card-interactive group flex w-full items-start gap-3 rounded-lg border p-3 text-left",
                  "animate-fade-in-up-smooth cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1",
                  active ? "store-card-selected" : "store-card",
                )}
                aria-pressed={active}
                aria-label={`${s.name}, ${s.district}${fav ? ", favorite" : ""}`}
              >
                {/* Type icon tile */}
                <div
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base transition-all duration-200",
                    active
                      ? "brand-gradient text-white shadow-sm"
                      : "bg-muted text-foreground group-hover:bg-[var(--brand)]/10",
                  )}
                  aria-hidden
                >
                  <span>{storeTypeIcon(s.storeType)}</span>
                </div>

                {/* Body */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-sm",
                        active ? "font-bold text-foreground" : "font-semibold",
                      )}
                    >
                      {s.name}
                    </span>
                    {s.highlight && (
                      <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.district}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 text-[10px] font-medium"
                    >
                      {storeTypeLabel(s.storeType)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-1.5 py-0 text-[10px] font-medium tabular-nums",
                        s.deliveryShare >= 0.5 && "risk-border-high risk-text-high",
                      )}
                    >
                      {(s.deliveryShare * 100).toFixed(0)}% {t.deliveryShare}
                    </Badge>
                  </div>
                </div>

                {/* Favorite star toggle (nested interactive element — the
                    outer container is a div role=button so nesting is valid). */}
                <FavoriteButton storeId={s.id} size="sm" />

                {/* Selected check indicator */}
                {active && (
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white animate-scale-in">
                    <svg
                      viewBox="0 0 12 12"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M2 6l3 3 5-6" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center animate-scale-in">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                {filter === "favorites" ? (
                  <Heart className="h-7 w-7 text-muted-foreground" />
                ) : (
                  <SearchX className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {filter === "favorites"
                    ? "No favorite stores yet"
                    : query
                      ? t.noStoresMatch(query)
                      : "No stores match"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {filter === "favorites"
                    ? "Tap the star icon on any store card to bookmark it for quick access."
                    : filter !== "all"
                      ? "Try a different filter or clear your search."
                      : "Try a different search term."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="h-8 gap-1.5 text-xs"
              >
                <X className="h-3 w-3" /> Clear filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
