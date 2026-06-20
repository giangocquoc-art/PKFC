"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard Shortcuts Help Modal
// A polished modal that documents every keyboard shortcut available in the
// Agent CaMate dashboard. Opens with the `?` key (Shift+/) or via the
// Command Palette's "Keyboard Shortcuts" action (which dispatches the
// `camate:open-shortcuts` CustomEvent).
//
// Features
//   • `?` key toggles the modal globally (ignored inside inputs/textareas)
//   • `camate:open-shortcuts` CustomEvent opens the modal externally
//   • Search bar to filter shortcuts by description / keys / category
//   • Categorized list (Global / Navigation / Actions / Store / Help)
//   • Each shortcut shows description, styled <kbd> keys, and a category badge
//   • Two-column layout on desktop, single column on mobile
//   • glass-heavy backdrop, brand-gradient header
//   • Esc closes (in addition to the default Dialog close button)
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import {
  Keyboard,
  Search,
  X,
  CornerDownLeft,
  Command,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

type ShortcutCategory = "global" | "navigation" | "actions" | "store" | "help";

interface ShortcutDef {
  /** Human-readable description of what the shortcut does. */
  description: string;
  /** Sequence of key tokens to render as <kbd> elements. */
  keys: string[];
  category: ShortcutCategory;
  /** Optional aspirational flag — dim the row to signal it isn't wired yet. */
  aspirational?: boolean;
}

interface CategoryMeta {
  key: ShortcutCategory;
  label: string;
  description: string;
  accent: string; // tailwind text color class for the category badge
  badgeClass: string; // tailwind classes for the badge background
}

const CATEGORIES: CategoryMeta[] = [
  {
    key: "global",
    label: "Global",
    description: "Available everywhere in the dashboard",
    accent: "text-[var(--brand)]",
    badgeClass: "bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20",
  },
  {
    key: "navigation",
    label: "Navigation",
    description: "Jump between views (G then letter)",
    accent: "text-violet-600 dark:text-violet-400",
    badgeClass:
      "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
  {
    key: "actions",
    label: "Actions",
    description: "Run agents, export, compare",
    accent: "text-emerald-600 dark:text-emerald-400",
    badgeClass:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  {
    key: "store",
    label: "Store",
    description: "Navigate and select stores",
    accent: "text-amber-600 dark:text-amber-400",
    badgeClass:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  {
    key: "help",
    label: "Help",
    description: "Documentation & about",
    accent: "text-sky-600 dark:text-sky-400",
    badgeClass:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
];

const SHORTCUTS: ShortcutDef[] = [
  // ── Global ────────────────────────────────────────────────────────────
  {
    description: "Open the Command Palette (Spotlight-style)",
    keys: ["⌘", "K"],
    category: "global",
  },
  {
    description: "Open this keyboard shortcuts help",
    keys: ["?"],
    category: "global",
  },
  {
    description: "Close dialog / cancel action",
    keys: ["Esc"],
    category: "global",
  },

  // ── Navigation (aspirational — G + letter two-key chord) ──────────────
  {
    description: "Go to Operations view",
    keys: ["G", "O"],
    category: "navigation",
    aspirational: true,
  },
  {
    description: "Go to Area Overview",
    keys: ["G", "A"],
    category: "navigation",
    aspirational: true,
  },
  {
    description: "Go to Decision Simulator",
    keys: ["G", "S"],
    category: "navigation",
    aspirational: true,
  },
  {
    description: "Go to Automation Center",
    keys: ["G", "U"],
    category: "navigation",
    aspirational: true,
  },
  {
    description: "Go to Live Operations Monitor",
    keys: ["G", "L"],
    category: "navigation",
    aspirational: true,
  },
  {
    description: "Go to Smart Interaction chat",
    keys: ["G", "C"],
    category: "navigation",
    aspirational: true,
  },
  {
    description: "Go to Knowledge Base",
    keys: ["G", "K"],
    category: "navigation",
    aspirational: true,
  },

  // ── Actions ───────────────────────────────────────────────────────────
  {
    description: "Re-run agent pipeline for the current store",
    keys: ["⌘", "R"],
    category: "actions",
  },
  {
    description: "Export the manager briefing as PDF/Markdown",
    keys: ["⌘", "E"],
    category: "actions",
  },
  {
    description: "Add the current store to comparison tray",
    keys: ["⌘", "D"],
    category: "actions",
  },

  // ── Store ─────────────────────────────────────────────────────────────
  {
    description: "Move selection up in the store list",
    keys: ["↑"],
    category: "store",
  },
  {
    description: "Move selection down in the store list",
    keys: ["↓"],
    category: "store",
  },
  {
    description: "Select the highlighted store",
    keys: ["Enter"],
    category: "store",
  },

  // ── Help ──────────────────────────────────────────────────────────────
  {
    description: "Show keyboard shortcuts (this dialog)",
    keys: ["?"],
    category: "help",
  },
  {
    description: "About Agent CaMate",
    keys: ["⌘", "/"],
    category: "help",
  },
];

// ─── Kbd element ───────────────────────────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1.5",
        "font-mono text-[11px] font-semibold text-foreground shadow-[0_1px_0_var(--border)]",
        "transition-colors",
      )}
    >
      {children}
    </kbd>
  );
}

function KeyCombo({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={keys.join(" then ")}>
      {keys.map((k, i) => (
        <React.Fragment key={`${k}-${i}`}>
          {i > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground/70" aria-hidden>
              +
            </span>
          )}
          <Kbd>{k}</Kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export function KeyboardShortcuts() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // ── Open with `?` key (Shift+/) ──────────────────────────────────────
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName ?? "";
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (target?.isContentEditable ?? false);
        if (isEditable) return;
        // Don't trigger if a modifier-only `?` came through a dialog already
        // open with its own input focus (Command Palette, etc.) — those grab
        // focus and we don't want to stomp them.
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── External open trigger (e.g. from the ⌘K Command Palette) ─────────
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("camate:open-shortcuts", handler);
    return () => window.removeEventListener("camate:open-shortcuts", handler);
  }, []);

  React.useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setQuery("");
      });
    }
  }, [open]);

  // ── Filter shortcuts by search query ─────────────────────────────────
  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!q) return SHORTCUTS;
    return SHORTCUTS.filter((s) => {
      const haystack = [
        s.description,
        s.keys.join(" "),
        s.keys.join(""),
        s.category,
        CATEGORIES.find((c) => c.key === s.category)?.label ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [q]);

  // Group filtered shortcuts by category (preserves SHORTCUTS order).
  const grouped = React.useMemo(() => {
    const map: Record<ShortcutCategory, ShortcutDef[]> = {
      global: [],
      navigation: [],
      actions: [],
      store: [],
      help: [],
    };
    for (const s of filtered) map[s.category].push(s);
    return map;
  }, [filtered]);

  const totalShown = filtered.length;
  const totalAll = SHORTCUTS.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="glass-heavy max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton={false}
      >
        {/* Visually-hidden accessible title/description for screen readers */}
        <DialogTitle className="sr-only">Keyboard Shortcuts</DialogTitle>
        <DialogDescription className="sr-only">
          Browse the full list of keyboard shortcuts available in the KFC
          Agent CaMate dashboard. Use the search bar to filter by description or
          key combination.
        </DialogDescription>

        {/* ── Header (brand-gradient) ─────────────────────────────────── */}
        <div className="brand-gradient relative px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm ring-1 ring-white/25">
              <Keyboard className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold leading-tight">
                Keyboard Shortcuts
              </h2>
              <p className="text-[11px] font-medium text-white/80">
                {totalShown === totalAll
                  ? `${totalAll} shortcuts across ${CATEGORIES.length} categories`
                  : `${totalShown} of ${totalAll} shortcuts match your search`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label="Close keyboard shortcuts"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search bar embedded in the header */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shortcuts…  (e.g. “palette”, “⌘K”, “store”)"
              className={cn(
                "h-10 w-full rounded-lg border border-white/20 bg-white/10 pl-9 pr-9",
                "text-sm text-white placeholder:text-white/60",
                "focus:border-white/40 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30",
                "transition-colors",
              )}
              aria-label="Search keyboard shortcuts"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Body: scrollable, categorized ──────────────────────────── */}
        <div className="max-h-[calc(90vh-160px)] overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-1 gap-px bg-border/40 md:grid-cols-2">
            {CATEGORIES.map((cat) => {
              const items = grouped[cat.key];
              if (items.length === 0) return null;
              return (
                <section
                  key={cat.key}
                  className="flex flex-col gap-2 bg-background p-4"
                >
                  <header className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-bold uppercase tracking-wide",
                          cat.badgeClass,
                        )}
                      >
                        {cat.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {cat.description}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold tabular-nums text-muted-foreground/70">
                      {items.length}
                    </span>
                  </header>

                  <ul className="flex flex-col gap-1.5">
                    {items.map((s, idx) => (
                      <li
                        key={`${cat.key}-${idx}`}
                        className={cn(
                          "group flex items-center justify-between gap-3 rounded-lg border border-transparent px-2.5 py-2",
                          "transition-colors hover:border-border hover:bg-muted/40",
                          s.aspirational && "opacity-70",
                        )}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span
                            className={cn(
                              "text-xs font-medium leading-snug",
                              s.aspirational
                                ? "text-muted-foreground"
                                : "text-foreground",
                            )}
                          >
                            {s.description}
                          </span>
                          {s.aspirational && (
                            <span className="inline-flex w-fit items-center rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Aspirational
                            </span>
                          )}
                        </div>
                        <KeyCombo keys={s.keys} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {/* Empty state */}
          {totalShown === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center animate-scale-in">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Search className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  No shortcuts match “{query}”
                </p>
                <p className="text-xs text-muted-foreground">
                  Try searching for “palette”, “store”, “export”, or a key like “⌘K”.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors hover:bg-accent"
              >
                <X className="h-3 w-3" /> Clear search
              </button>
            </div>
          )}

          {/* ── Footer hints ─────────────────────────────────────────── */}
          <div className="border-t bg-muted/30 px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <Command className="h-3 w-3" />
                  <span>= ⌘ on macOS, Ctrl on Windows/Linux</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CornerDownLeft className="h-3 w-3" />
                  <span>Press Enter to execute a selected action</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Press</span>
                <Kbd>Esc</Kbd>
                <span>to close</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-only quick nav pills (hidden on md+) */}
        <div className="flex items-center gap-1.5 border-t px-3 py-2 md:hidden">
          <ArrowUp className="h-3 w-3 text-muted-foreground" />
          <ArrowDown className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            Scroll to browse all categories
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
