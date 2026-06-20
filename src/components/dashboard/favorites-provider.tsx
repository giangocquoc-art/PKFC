"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Favorites / Bookmarks System
// A context provider that manages the user's favorite KFC stores. Favorites are
// persisted in localStorage (`camate.favorites.v1`) and surfaced via the
// `useFavorites()` hook anywhere in the tree. The companion `FavoriteButton`
// is a small star toggle that can be embedded in any store card.
//
// Exports:
//   • FavoritesProvider — wraps the app, persists favorites in localStorage
//   • useFavorites()    — hook to read/toggle favorites from anywhere
//   • FavoriteButton    — star icon button that toggles a store's favorite state
//   • FavoritesCount    — small badge showing the number of favorite stores
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

interface FavoritesContextValue {
  /** Array of favorite store IDs (order = order they were added). */
  favorites: string[];
  /** Toggle a store ID in / out of the favorites list. */
  toggleFavorite: (storeId: string) => void;
  /** Returns true if the given store ID is in the favorites list. */
  isFavorite: (storeId: string) => boolean;
  /** Clear all favorites (used by settings / reset flows). */
  clearFavorites: () => void;
}

const FavoritesContext = React.createContext<FavoritesContextValue | null>(null);

const STORAGE_KEY = "camate.favorites.v1";

// ─── Provider ──────────────────────────────────────────────────────────────

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = React.useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return Array.from(new Set(parsed.filter((x) => typeof x === "string")));
        }
      }
    } catch {
      // Ignore
    }
    return [];
  });
  const [hydrated, setHydrated] = React.useState(false);

  // Load from localStorage on mount (client-only).
  React.useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  // Persist on change (skip the first render before hydration to avoid
  // overwriting stored value with the empty initial state).
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Storage may be unavailable (private mode, quota, etc.) — fail silently.
    }
  }, [favorites, hydrated]);

  // Broadcast a CustomEvent so other UI (e.g. header count badge) can react
  // without re-rendering through context if they prefer an event-driven model.
  React.useEffect(() => {
    if (!hydrated) return;
    window.dispatchEvent(
      new CustomEvent("camate:favorites-changed", { detail: { favorites } }),
    );
  }, [favorites, hydrated]);

  const toggleFavorite = React.useCallback((storeId: string) => {
    setFavorites((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId],
    );
  }, []);

  const isFavorite = React.useCallback(
    (storeId: string) => favorites.includes(storeId),
    [favorites],
  );

  const clearFavorites = React.useCallback(() => setFavorites([]), []);

  const value = React.useMemo<FavoritesContextValue>(
    () => ({ favorites, toggleFavorite, isFavorite, clearFavorites }),
    [favorites, toggleFavorite, isFavorite, clearFavorites],
  );

  return (
    <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useFavorites(): FavoritesContextValue {
  const ctx = React.useContext(FavoritesContext);
  // Graceful fallback when used outside a provider — avoids crashes in
  // isolated tests / Storybook-style previews.
  if (!ctx) {
    return {
      favorites: [],
      toggleFavorite: () => {},
      isFavorite: () => false,
      clearFavorites: () => {},
    };
  }
  return ctx;
}

// ─── FavoriteButton ────────────────────────────────────────────────────────

export function FavoriteButton({
  storeId,
  size = "sm",
  className,
}: {
  storeId: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(storeId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleFavorite(storeId);
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        fav
          ? "text-amber-500 hover:text-amber-600"
          : "text-muted-foreground/60 hover:bg-muted hover:text-foreground",
        className,
      )}
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={fav}
      title={fav ? "Remove from favorites" : "Add to favorites"}
    >
      <Star
        className={cn(
          size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
          fav && "fill-amber-400",
          "transition-transform duration-150",
          fav ? "scale-110" : "scale-100 group-hover:scale-105",
        )}
      />
    </button>
  );
}

// ─── FavoritesCount ────────────────────────────────────────────────────────
// A small pill that shows the current number of favorites. Mount it anywhere
// inside the provider (e.g. header) — it re-renders automatically when the
// context value changes.

export function FavoritesCount({
  className,
  showWhenZero = false,
}: {
  className?: string;
  showWhenZero?: boolean;
}) {
  const { favorites } = useFavorites();
  if (!showWhenZero && favorites.length === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums",
        className,
      )}
      title={`${favorites.length} favorite store${favorites.length === 1 ? "" : "s"}`}
    >
      <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
      {favorites.length}
    </span>
  );
}
