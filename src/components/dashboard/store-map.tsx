"use client";

import * as React from "react";
import {
  AlertTriangle,
  ExternalLink,
  Locate,
  MapPin,
  Maximize2,
  Navigation,
  RefreshCw,
  Star,
  Store as StoreIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KfcStore } from "@/lib/stores/seed-stores";
import { cn } from "@/lib/utils";
import { storeTypeIcon, storeTypeLabel } from "./shared";
import { useLang } from "@/lib/i18n/language-provider";

export interface StoreMapProps {
  stores: KfcStore[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Google Maps embed — uses the keyless Google Maps iframe embed endpoint
 * (https://maps.google.com/maps?q=...&output=embed) for accurate maps.
 *
 * Details:
 *  - Searches by the selected store name (or fallback general search).
 *  - Does NOT use or require a Google Maps API key.
 *  - Does NOT claim or use Google Places API or Google Maps JS API.
 *
 * Polish:
 *  - Self-contained rich header (brand-gradient icon tile, title, 3-dot legend, fullscreen)
 *  - Map overlays: selected store badge, quick-stats pill, recenter button, deep-link
 *  - Responsive map height (250 / 300 / 380 px on mobile / tablet / desktop)
 *  - Shimmer loading skeleton + 12s timeout fallback error state with store list
 *  - Enhanced store strip below with type icon, active highlight, smooth scroll
 */
export default function StoreMap({ stores, selectedId, onSelect, className }: StoreMapProps) {
  const { lang } = useLang();
  const selected = stores.find((s) => s.id === selectedId) ?? null;
  const highlightedCount = stores.filter((s) => s.highlight).length;

  // Build a Google Maps embed query. When a store is selected, search for that
  // specific KFC store so Google shows its accurate verified pin. Otherwise
  // show all KFC stores in Ho Chi Minh City.
  const query = selected
    ? `KFC ${selected.name.replace(/^KFC\s+/i, "")} Ho Chi Minh City`
    : "KFC Ho Chi Minh City";
  const embedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
  const deepLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  const iframeKey = selected?.id ?? "all";

  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const loadedRef = React.useRef(false);

  // Reset load/error state whenever the iframe src changes (new selection or
  // manual recenter via nonce). Set a 12s timeout to flip to the error
  // fallback if the iframe never signals onLoad.
  React.useEffect(() => {
    loadedRef.current = false;
    queueMicrotask(() => {
      setLoaded(false);
      setError(false);
    });
    const timer = setTimeout(() => {
      if (!loadedRef.current) setError(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [iframeKey, nonce]);


  const iframeRef = React.useCallback((node: HTMLIFrameElement | null) => {
    if (node) {
      node.onload = () => {
        loadedRef.current = true;
        setLoaded(true);
      };
      try {
        if (node.contentWindow && node.contentWindow.document && node.contentWindow.document.readyState === "complete") {
          loadedRef.current = true;
          setLoaded(true);
        }
      } catch (e) {
        // ignore cross-origin error
      }
    }
  }, []);

  const recenter = React.useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  // Smooth-scroll the active store chip into view inside the horizontal strip.
  const stripRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!stripRef.current || !selectedId) return;
    const activeBtn = stripRef.current.querySelector<HTMLButtonElement>(
      `[data-store-id="${selectedId}"]`,
    );
    activeBtn?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedId]);

  return (
    <div className={cn("flex h-full w-full flex-col gap-2.5", className)}>
      {/* ── Header bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Store Network Map</span>
            <span className="text-[11px] text-muted-foreground">
              {stores.length} stores · {highlightedCount} highlighted · TP.HCM
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Legend />
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
          >
            <a href={deepLink} target="_blank" rel="noopener noreferrer">
              <Maximize2 className="h-3 w-3" /> Fullscreen
            </a>
          </Button>
        </div>
      </div>

      {/* ── Map area with overlays ─────────────────────────────── */}
      <div className="relative w-full overflow-hidden rounded-lg border bg-muted">
        <div className="relative h-[250px] w-full sm:h-[300px] lg:h-[380px]">
          {!error && (
            <iframe
              key={`${iframeKey}-${nonce}`}
              ref={iframeRef}
              title="KFC store map"
              src={embedSrc}
              className={cn(
                "absolute inset-0 h-full w-full border-0 transition-opacity duration-500",
                loaded ? "opacity-100" : "opacity-0",
              )}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          )}

          {/* Shimmer loading skeleton */}
          {!loaded && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted">
              <div className="absolute inset-0 shimmer opacity-40" aria-hidden />
              <div className="relative flex flex-col items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span className="text-xs font-medium">Loading Google Maps…</span>
              </div>
            </div>
          )}

          {/* Error fallback */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-card p-4 text-center scrollbar-thin">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">
                  {lang === "vi" ? "Không tải được bản đồ nhúng" : "Map unavailable"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === "vi"
                    ? "Không tải được bản đồ nhúng. Bạn vẫn có thể mở vị trí trên Google Maps."
                    : "Embedded map could not be loaded. You can still open the location in Google Maps."}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={recenter}
                >
                  <RefreshCw className="h-3 w-3" /> {lang === "vi" ? "Thử lại" : "Retry"}
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                >
                  <a href={deepLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> {lang === "vi" ? "Mở trên Google Maps" : "Open in Google Maps"}
                  </a>
                </Button>
              </div>
              {/* Compact store list fallback */}
              <div className="mt-2 grid w-full max-w-md grid-cols-2 gap-1.5 text-left">
                {stores.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                      s.id === selectedId
                        ? "border-[var(--brand)] bg-[var(--brand)]/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <span aria-hidden>{storeTypeIcon(s.storeType)}</span>
                    <span className="truncate">{s.name.replace(/^KFC\s+/i, "")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Top-left overlay: selected store badge + quick stats */}
          {loaded && !error && (
            <div className="pointer-events-none absolute left-2 top-2 flex max-w-[70%] flex-col gap-1">
              {selected ? (
                <>
                  <div className="glass-heavy pointer-events-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold shadow-sm">
                    <StoreIcon className="h-3 w-3 text-[var(--brand)]" />
                    <span className="max-w-[180px] truncate">{selected.name}</span>
                    {selected.highlight && (
                      <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                    )}
                  </div>
                  <div className="pointer-events-none inline-flex w-fit items-center gap-2 rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur dark:bg-black/60">
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" />
                      {selected.district}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <span aria-hidden>{storeTypeIcon(selected.storeType)}</span>
                      {storeTypeLabel(selected.storeType)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="pointer-events-none inline-flex w-fit items-center gap-1.5 rounded-md bg-white/85 px-2 py-1 text-[10px] font-semibold shadow-sm backdrop-blur dark:bg-black/70 dark:text-foreground">
                  <StoreIcon className="h-3 w-3 text-[var(--brand)]" />
                  {stores.length} KFC stores
                  <span className="ml-1 inline-flex items-center gap-0.5 text-amber-500">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    {highlightedCount}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Top-right overlay: recenter button */}
          {loaded && !error && (
            <button
              onClick={recenter}
              className="glass-heavy absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground shadow-sm transition-colors hover:text-foreground"
              aria-label="Recenter map"
              title="Recenter map"
            >
              <Locate className="h-4 w-4" />
            </button>
          )}

          {/* Bottom-right overlay: deep-link button */}
          {loaded && !error && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="glass-heavy absolute bottom-2 right-2 h-8 gap-1.5 text-xs shadow-sm"
            >
              <a href={deepLink} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-3 w-3" /> Open in Maps
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* ── Store list strip (quick jump) ──────────────────────── */}
      <div className="flex items-center gap-2">
        <div ref={stripRef} className="flex-1 overflow-x-auto scrollbar-thin">
          <div className="flex gap-1.5 pb-1">
            {stores.map((s) => {
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  data-store-id={s.id}
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    "card-interactive inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-all",
                    active
                      ? "border-[var(--brand)] brand-gradient text-white shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                  title={`${s.name} · ${storeTypeLabel(s.storeType)}`}
                  aria-pressed={active}
                >
                  <span aria-hidden className="text-xs leading-none">
                    {storeTypeIcon(s.storeType)}
                  </span>
                  <span className="max-w-[140px] truncate">
                    {s.name.replace(/^KFC\s+/i, "")}
                  </span>
                  {s.highlight && (
                    <Star className="h-2.5 w-2.5 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 3-dot map legend: store / highlighted / selected. */
function Legend() {
  return (
    <div className="hidden items-center gap-2.5 text-[10px] text-muted-foreground md:flex">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-rose-500" aria-hidden />
        Store
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" aria-hidden />
        Highlight
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand)]" aria-hidden />
        Selected
      </span>
    </div>
  );
}
