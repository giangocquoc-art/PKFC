"use client";

/**
 * CommandPalette — Spotlight/Raycast-style ⌘K command palette for the
 * Agent CaMate dashboard.
 *
 * Features
 *   • ⌘K / Ctrl+K opens the palette globally (via useCommandPalette hook)
 *   • Real-time fuzzy search across navigation, stores, actions, and help
 *   • ↑/↓ keyboard navigation, Enter to execute, Esc to close
 *   • Category-grouped results with sticky section headers
 *   • Recent commands (last 5) shown at the top when query is empty
 *   • Polished glass-heavy overlay with brand-gradient selected state
 *   • Empty state with suggestions + footer keyboard hints
 *
 * The component is fully controlled (`open` / `onOpenChange`) and accepts
 * the full action surface as callbacks, so the parent page.tsx owns the
 * side effects (running agents, switching views, opening sheets, etc.).
 */

import * as React from "react";
import {
  Search,
  Store,
  LayoutGrid,
  Bot,
  Activity,
  MessageSquare,
  BookOpen,
  FlaskConical,
  LayoutDashboard,
  RefreshCw,
  Star,
  Download,
  Plus,
  Trash2,
  Settings,
  Bell,
  HelpCircle,
  Info,
  Keyboard,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  X,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { storeTypeLabel } from "./shared";
import type { KfcStore } from "@/lib/stores/seed-stores";

// ─── Types ───────────────────────────────────────────────────────────────

export type CommandCategory = "navigation" | "stores" | "actions" | "help";

export interface CommandItem {
  id: string;
  category: CommandCategory;
  title: string;
  subtitle?: string;
  /** Lucide icon component */
  icon: React.ElementType;
  /** Tailwind text-color class applied to the icon (e.g. "text-amber-500"). */
  iconColor?: string;
  /** Keyboard shortcut hint shown on the right (display only). */
  shortcut?: string[];
  /** Callback fired on Enter / click. */
  action: () => void;
  /** Extra tokens used by fuzzy matching (e.g. "vi", aliases). */
  keywords?: string[];
  /** Optional small badge text rendered at the right of the row. */
  badge?: string;
  /** Optional badge tone. */
  badgeTone?: "brand" | "muted" | "amber" | "rose";
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateView: (view: string) => void;
  onSelectStore: (storeId: string) => void;
  onRunAgent: () => void;
  onRunCompare: () => void;
  onExportBriefing: () => void;
  onAddToCompare: () => void;
  onClearCompare: () => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  onRestartTour: () => void;
  stores: KfcStore[];
  currentStoreId: string | null;
  /** Optional: current compare list length (drives the Clear Comparison badge). */
  compareCount?: number;
}

// ─── Category meta ───────────────────────────────────────────────────────

interface CategoryMeta {
  label: string;
  icon: React.ElementType;
  /** Tone-coloured text class for the section icon. */
  iconColor: string;
  /** A short hint shown next to the label. */
  hint?: string;
}

const CATEGORY_META: Record<CommandCategory, CategoryMeta> = {
  navigation: {
    label: "Chế độ xem",
    icon: CompassIcon,
    iconColor: "text-[var(--brand)]",
    hint: "Chuyển màn hình",
  },
  stores: {
    label: "Cửa hàng",
    icon: Store,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    hint: "20 cửa hàng KFC",
  },
  actions: {
    label: "Hành động",
    icon: Sparkles,
    iconColor: "text-amber-500",
    hint: "Chạy / Xuất file",
  },
  help: {
    label: "Trợ giúp",
    icon: HelpCircle,
    iconColor: "text-muted-foreground",
  },
};

// A tiny inline compass glyph (Lucide's Compass exists, but we keep our
// own to avoid an extra import path mismatch). Falls back to LayoutGrid.
function CompassIcon(props: React.ComponentProps<"svg">) {
  return <LayoutGrid {...props} />;
}

// ─── Constants ───────────────────────────────────────────────────────────

const RECENT_KEY = "camate.cmdpalette.recent.v1";
const MAX_RECENT = 5;

const NAV_ITEMS: Array<{
  view: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  keywords: string[];
  shortcut?: string[];
}> = [
  {
    view: "dashboard",
    title: "Màn hình Vận hành",
    subtitle: "Báo cáo ca · kế hoạch hành động · tóm tắt quản lý",
    icon: LayoutDashboard,
    iconColor: "text-[var(--brand)]",
    keywords: ["operations", "dashboard", "vận hành", "main"],
    shortcut: ["G", "O"],
  },
  {
    view: "area",
    title: "Màn hình Khu vực",
    subtitle: "Bản đồ hệ thống · chế độ quản lý khu vực",
    icon: LayoutGrid,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    keywords: ["area", "overview", "network", "khu vực", "map"],
    shortcut: ["G", "A"],
  },
  {
    view: "simulator",
    title: "Mô phỏng quyết định",
    subtitle: "Trực quan hóa tác động · kịch bản giả định",
    icon: FlaskConical,
    iconColor: "text-fuchsia-600 dark:text-fuchsia-400",
    keywords: ["simulator", "decision", "what-if", "mô phỏng"],
    shortcut: ["G", "S"],
  },
  {
    view: "autopilot",
    title: "Trung tâm Tự động hóa",
    subtitle: "Nhiệm vụ định kỳ · quy trình phê duyệt ca trực",
    icon: Bot,
    iconColor: "text-violet-600 dark:text-violet-400",
    keywords: ["automation", "autopilot", "tasks", "tự động hóa"],
    shortcut: ["G", "U"],
  },
  {
    view: "live",
    title: "Theo dõi trực tiếp",
    subtitle: "Thông số thời gian thực · cảnh báo · sự kiện",
    icon: Activity,
    iconColor: "text-rose-600 dark:text-rose-400",
    keywords: ["live", "monitor", "realtime", "giám sát"],
    shortcut: ["G", "L"],
  },
  {
    view: "chat",
    title: "Hỏi đáp Trợ lý CaMate",
    subtitle: "Hỏi đáp kế hoạch vận hành cùng AI",
    icon: MessageSquare,
    iconColor: "text-sky-600 dark:text-sky-400",
    keywords: ["chat", "smart", "interaction", "copilot", "tương tác"],
    shortcut: ["G", "C"],
  },
  {
    view: "knowledge",
    title: "Kho tài liệu & RAG",
    subtitle: "Quy trình SOP · lịch sử lượt chạy",
    icon: BookOpen,
    iconColor: "text-amber-600 dark:text-amber-400",
    keywords: ["knowledge", "base", "sop", "docs", "tri thức"],
    shortcut: ["G", "K"],
  },
];

// ─── Fuzzy search ────────────────────────────────────────────────────────

/**
 * Subsequence fuzzy matcher with scoring. Returns null if no match.
 * Score is lower-is-better; consecutive + early matches score best.
 */
function fuzzyMatch(query: string, target: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) {
    // Strong bonus for direct substring match, weighted by position.
    return -(100 - t.indexOf(q));
  }
  let qi = 0;
  let ti = 0;
  let score = 0;
  let consecutive = 0;
  let firstMatchIdx = -1;
  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      if (firstMatchIdx === -1) firstMatchIdx = ti;
      consecutive += 1;
      score -= consecutive * 2; // reward runs
      qi += 1;
    } else {
      consecutive = 0;
      score += 1; // penalty for skipped char
    }
    ti += 1;
  }
  if (qi < q.length) return null; // did not consume whole query
  // Prefer earlier first matches.
  if (firstMatchIdx >= 0) score += firstMatchIdx * 0.5;
  return score;
}

interface ScoredCommand {
  item: CommandItem;
  score: number;
}

function scoreCommand(query: string, item: CommandItem): number | null {
  const titleScore = fuzzyMatch(query, item.title);
  const subtitleScore = item.subtitle ? fuzzyMatch(query, item.subtitle) : null;
  const keywordScores = (item.keywords ?? []).map((k) => fuzzyMatch(query, k));
  // Best (lowest) score across all searchable tokens.
  const all = [titleScore, subtitleScore, ...keywordScores].filter(
    (s): s is number => s !== null,
  );
  if (all.length === 0) return null;
  // Slight preference to title matches.
  return Math.min(...all) - (titleScore !== null ? 1 : 0);
}

// ─── Recent commands persistence ─────────────────────────────────────────

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecent(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(ids.slice(0, MAX_RECENT)),
    );
  } catch {
    /* ignore quota / privacy errors */
  }
}

// ─── Hook: useCommandPalette ─────────────────────────────────────────────

/**
 * Manages the open state for the CommandPalette and wires the global
 * ⌘K / Ctrl+K keyboard shortcut. Returns `{ open, setOpen }` for the
 * parent to forward into `<CommandPalette open={open} onOpenChange={setOpen} />`.
 */
export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}

// ─── Result row ──────────────────────────────────────────────────────────

interface RowProps {
  item: CommandItem;
  selected: boolean;
  onSelect: () => void;
  onHover: () => void;
  index: number;
  isRecent?: boolean;
}

function CommandRow({
  item,
  selected,
  onSelect,
  onHover,
  index,
  isRecent,
}: RowProps) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      data-cmd-row
      data-index={index}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-100 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40",
        selected
          ? "brand-gradient text-white shadow-sm"
          : "text-foreground hover:bg-accent/60",
      )}
    >
      {/* Icon tile */}
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold transition-colors",
          selected
            ? "bg-white/15 text-white"
            : cn(
                "bg-muted/60",
                item.iconColor ?? "text-[var(--brand)]",
              ),
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      {/* Title + subtitle */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          {isRecent && (
            <Clock
              className={cn(
                "h-3 w-3 shrink-0",
                selected ? "text-white/70" : "text-muted-foreground",
              )}
            />
          )}
          <span className="truncate text-sm font-semibold">{item.title}</span>
        </span>
        {item.subtitle && (
          <span
            className={cn(
              "truncate text-xs",
              selected ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {item.subtitle}
          </span>
        )}
      </span>

      {/* Right side: badge + shortcut */}
      <span className="flex shrink-0 items-center gap-2">
        {item.badge && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
              selected
                ? "bg-white/15 text-white ring-white/20"
                : badgeClasses(item.badgeTone),
            )}
          >
            {item.badge}
          </span>
        )}
        {item.shortcut && item.shortcut.length > 0 && (
          <span
            className={cn(
              "hidden items-center gap-0.5 sm:flex",
              selected ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {item.shortcut.map((key, i) => (
              <kbd
                key={i}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  selected
                    ? "border-white/20 bg-white/10"
                    : "border-border bg-muted/60",
                )}
              >
                {key}
              </kbd>
            ))}
          </span>
        )}
        {selected && (
          <CornerDownLeft className="h-3.5 w-3.5 text-white/80" />
        )}
      </span>
    </button>
  );
}

function badgeClasses(tone?: CommandItem["badgeTone"]): string {
  switch (tone) {
    case "brand":
      return "bg-[var(--brand)]/10 text-[var(--brand)] ring-[var(--brand)]/25";
    case "amber":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30";
    case "rose":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/30";
    case "muted":
    default:
      return "bg-muted text-muted-foreground ring-border";
  }
}

// ─── Section header ──────────────────────────────────────────────────────

function SectionHeader({
  category,
  count,
}: {
  category: CommandCategory;
  count: number;
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-background/95 to-background/80 px-3 py-1.5 backdrop-blur-sm">
      <Icon className={cn("h-3 w-3", meta.iconColor)} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {meta.label}
      </span>
      {meta.hint && (
        <span className="text-[10px] text-muted-foreground/70">
          · {meta.hint}
        </span>
      )}
      <span className="ml-auto rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
        {count}
      </span>
    </div>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────

function FooterHints() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t bg-card/40 px-3 py-2 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <kbd className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold">
          <ArrowUp className="inline h-2.5 w-2.5" />
        </kbd>
        <kbd className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold">
          <ArrowDown className="inline h-2.5 w-2.5" />
        </kbd>
        di chuyển
      </span>
      <span className="flex items-center gap-1">
        <kbd className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold">
          <CornerDownLeft className="inline h-2.5 w-2.5" />
        </kbd>
        chọn
      </span>
      <span className="flex items-center gap-1">
        <kbd className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold">
          esc
        </kbd>
        đóng
      </span>
      <span className="flex items-center gap-1">
        <kbd className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold">
          ⌘K
        </kbd>
        bật/tắt
      </span>
      <span className="ml-auto hidden items-center gap-1 text-muted-foreground/70 sm:flex">
        <Sparkles className="h-3 w-3 text-amber-500" />
        Agent CaMate · Bảng lệnh
      </span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────

export function CommandPalette({
  open,
  onOpenChange,
  onNavigateView,
  onSelectStore,
  onRunAgent,
  onRunCompare,
  onExportBriefing,
  onAddToCompare,
  onClearCompare,
  onOpenSettings,
  onOpenNotifications,
  onRestartTour,
  stores,
  currentStoreId,
  compareCount = 0,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [recent, setRecent] = React.useState<string[]>([]);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setQuery("");
        setActiveIndex(0);
        setRecent(loadRecent());
      });
      // Defer focus until after the dialog mounts the input.
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // ── Build the full command list (memoised on prop identity) ──────────
  const allCommands = React.useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = NAV_ITEMS.map((n) => ({
      id: `nav:${n.view}`,
      category: "navigation" as const,
      title: n.title,
      subtitle: n.subtitle,
      icon: n.icon,
      iconColor: n.iconColor,
      keywords: n.keywords,
      shortcut: n.shortcut,
      action: () => onNavigateView(n.view),
    }));

    const storeCmds: CommandItem[] = stores.map((s) => ({
      id: `store:${s.id}`,
      category: "stores" as const,
      title: `Chọn ${s.name}`,
      subtitle: `${s.district} · ${storeTypeLabel(s.storeType)}${
        s.highlight ? " · cửa hàng demo" : ""
      }`,
      icon: Store,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      keywords: [
        s.name,
        s.district,
        s.address,
        storeTypeLabel(s.storeType),
        s.storeType,
        s.riskProfile,
        s.demandProfile,
      ],
      badge: s.id === currentStoreId ? "Đang chọn" : undefined,
      badgeTone: "brand" as const,
      action: () => onSelectStore(s.id),
    }));

    const actions: CommandItem[] = [
      {
        id: "act:rerun",
        category: "actions",
        title: "Chạy Phân tích Ca",
        subtitle: "Kích hoạt lại hệ thống 8 tác nhân cho cửa hàng hiện tại",
        icon: RefreshCw,
        iconColor: "text-[var(--brand)]",
        keywords: ["rerun", "agent", "run", "refresh", "pipeline", "redo"],
        shortcut: ["⌘", "R"],
        action: onRunAgent,
      },
      {
        id: "act:compare-3",
        category: "actions",
        title: "Chạy demo so sánh 3 cửa hàng",
        subtitle: "So sánh phân khúc Trung tâm vs Dân cư vs Ngoại ô",
        icon: Star,
        iconColor: "text-amber-500",
        keywords: ["compare", "demo", "3-store", "highlight", "urban"],
        action: onRunCompare,
      },
      {
        id: "act:export-briefing",
        category: "actions",
        title: "Xuất báo cáo Quản lý",
        subtitle: "Tải tóm tắt AI dưới dạng Markdown (.md)",
        icon: Download,
        iconColor: "text-sky-600 dark:text-sky-400",
        keywords: ["export", "briefing", "markdown", "md", "download"],
        action: onExportBriefing,
      },
      {
        id: "act:add-compare",
        category: "actions",
        title: "Thêm vào bảng so sánh",
        subtitle: "Ghim kết quả hiện tại vào khay so sánh",
        icon: Plus,
        iconColor: "text-emerald-600 dark:text-emerald-400",
        keywords: ["add", "compare", "pin", "tray"],
        action: onAddToCompare,
      },
      {
        id: "act:clear-compare",
        category: "actions",
        title: "Xóa danh sách so sánh",
        subtitle: compareCount
          ? `Xóa tất cả ${compareCount} lượt chạy đã ghim`
          : "Làm sạch khay so sánh",
        icon: Trash2,
        iconColor: "text-rose-600 dark:text-rose-400",
        keywords: ["clear", "compare", "remove", "reset", "tray"],
        badge: compareCount ? String(compareCount) : undefined,
        badgeTone: compareCount ? "rose" : "muted",
        action: onClearCompare,
      },
      {
        id: "act:settings",
        category: "actions",
        title: "Mở Cài đặt",
        subtitle: "Giao diện · nguồn dữ liệu · đơn vị đo · tác nhân",
        icon: Settings,
        iconColor: "text-muted-foreground",
        keywords: ["settings", "preferences", "config", "theme"],
        action: onOpenSettings,
      },
      {
        id: "act:notifications",
        category: "actions",
        title: "Mở thông báo",
        subtitle: "Nhật ký hoạt động · cảnh báo · sự kiện hệ thống",
        icon: Bell,
        iconColor: "text-amber-500",
        keywords: ["notifications", "activity", "alerts", "bell"],
        action: onOpenNotifications,
      },
      {
        id: "act:restart-tour",
        category: "actions",
        title: "Xem lại hướng dẫn sử dụng",
        subtitle: "Chạy lại hướng dẫn sử dụng 5 bước của hệ thống",
        icon: Info,
        iconColor: "text-violet-600 dark:text-violet-400",
        keywords: ["restart", "tour", "onboarding", "walkthrough", "help"],
        action: onRestartTour,
      },
    ];

    const help: CommandItem[] = [
      {
        id: "help:shortcuts",
        category: "help",
        title: "Phím tắt hệ thống",
        subtitle: "⌘K mở bảng lệnh · ⌘R chạy lại · Esc đóng · ↑↓ di chuyển",
        icon: Keyboard,
        iconColor: "text-[var(--brand)]",
        keywords: ["keyboard", "shortcuts", "hotkeys", "help"],
        action: () => {
          // Close the command palette first so the shortcuts modal can take
          // over the keyboard, then dispatch the open event which the
          // KeyboardShortcuts component listens for.
          onOpenChange?.(false);
          // Defer to the next tick so the palette's escape handler doesn't
          // swallow the event before it's dispatched.
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("camate:open-shortcuts"));
          }, 60);
        },
      },
      {
        id: "help:about",
        category: "help",
        title: "Giới thiệu Agent CaMate",
        subtitle: "Quản lý ca thông minh F&B · 8 tác nhân AI · thời tiết trực tiếp",
        icon: HelpCircle,
        iconColor: "text-muted-foreground",
        keywords: ["about", "version", "info", "kfc", "camate"],
        action: () => {
          setQuery("camate");
        },
      },
    ];

    return [...nav, ...storeCmds, ...actions, ...help];
  }, [
    stores,
    currentStoreId,
    compareCount,
    onNavigateView,
    onSelectStore,
    onRunAgent,
    onRunCompare,
    onExportBriefing,
    onAddToCompare,
    onClearCompare,
    onOpenSettings,
    onOpenNotifications,
    onRestartTour,
    onOpenChange,
  ]);

  // ── Filter + group ──────────────────────────────────────────────────
  const { filtered, flatList, recentItems } = React.useMemo(() => {
    const q = query.trim();
    if (!q) {
      // Empty query → recent commands first, then full list grouped.
      const rec: CommandItem[] = recent
        .map((rid) => allCommands.find((c) => c.id === rid))
        .filter((c): c is CommandItem => Boolean(c));
      return {
        filtered: allCommands,
        flatList: allCommands,
        recentItems: rec,
      };
    }
    const scored: ScoredCommand[] = [];
    for (const cmd of allCommands) {
      const s = scoreCommand(q, cmd);
      if (s !== null) scored.push({ item: cmd, score: s });
    }
    scored.sort((a, b) => a.score - b.score);
    const list = scored.map((s) => s.item);
    return { filtered: list, flatList: list, recentItems: [] };
  }, [query, allCommands, recent]);

  // Group filtered results by category (preserves score order within each).
  const grouped = React.useMemo(() => {
    const map: Record<CommandCategory, CommandItem[]> = {
      navigation: [],
      stores: [],
      actions: [],
      help: [],
    };
    for (const c of filtered) map[c.category].push(c);
    return map;
  }, [filtered]);

  // Build a flat ordered list for keyboard navigation, including the
  // "Recent" pseudo-section at the top when query is empty.
  const orderedSections = React.useMemo(() => {
    const sections: Array<{
      key: string;
      label: string;
      category?: CommandCategory;
      isRecent?: boolean;
      items: CommandItem[];
    }> = [];
    if (!query.trim() && recentItems.length > 0) {
      sections.push({
        key: "recent",
        label: "Gần đây",
        isRecent: true,
        items: recentItems,
      });
    }
    (Object.keys(grouped) as CommandCategory[]).forEach((cat) => {
      const items = grouped[cat];
      if (items.length > 0) {
        sections.push({
          key: cat,
          label: CATEGORY_META[cat].label,
          category: cat,
          items,
        });
      }
    });
    return sections;
  }, [grouped, recentItems, query]);

  const totalCount = orderedSections.reduce(
    (n, s) => n + s.items.length,
    0,
  );

  React.useEffect(() => {
    queueMicrotask(() => {
      setActiveIndex((i) => Math.min(i, Math.max(totalCount - 1, 0)));
    });
  }, [totalCount]);

  // Scroll the active row into view.
  React.useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-row][data-index="${activeIndex}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // ── Execute + recency tracking ──────────────────────────────────────
  const execute = React.useCallback(
    (cmd: CommandItem | undefined) => {
      if (!cmd) return;
      // Update recent list (dedupe, cap, most-recent-first).
      setRecent((prev) => {
        const next = [cmd.id, ...prev.filter((id) => id !== cmd.id)].slice(
          0,
          MAX_RECENT,
        );
        saveRecent(next);
        return next;
      });
      onOpenChange(false);
      // Defer the action so the dialog can begin closing first — avoids
      // focus-steal / scroll jumps on the underlying page.
      window.setTimeout(() => {
        try {
          cmd.action();
        } catch {
          /* swallow — handlers own their own toasts */
        }
      }, 0);
    },
    [onOpenChange],
  );

  // ── Keyboard handler ────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (totalCount === 0 ? 0 : (i + 1) % totalCount));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        totalCount === 0 ? 0 : (i - 1 + totalCount) % totalCount,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      execute(flatList[activeIndex] ?? orderedSectionsToFlat(orderedSections)[activeIndex]);
    } else if (e.key === "Escape") {
      // If there's a query, Esc clears it first; otherwise closes the palette.
      if (query.trim()) {
        e.preventDefault();
        setQuery("");
      } else {
        // Let the Dialog handle close, but make sure we don't leave a stale state.
        onOpenChange(false);
      }
    } else if (e.key === "Tab") {
      // Optional: Tab cycles to the next category's first item.
      e.preventDefault();
      const flat = orderedSectionsToFlat(orderedSections);
      if (flat.length === 0) return;
      // Find the first item of the next section after the current one.
      const currentCmd = flat[activeIndex];
      let currentSectionIdx = orderedSections.findIndex((s) =>
        s.items.some((it) => it.id === currentCmd?.id),
      );
      if (currentSectionIdx === -1) currentSectionIdx = 0;
      const nextSection =
        orderedSections[(currentSectionIdx + 1) % orderedSections.length];
      const nextItem = nextSection.items[0];
      if (nextItem) {
        const nextFlatIdx = flat.findIndex((it) => it.id === nextItem.id);
        if (nextFlatIdx >= 0) setActiveIndex(nextFlatIdx);
      }
    }
  };

  // Render-time flat list (also used for Enter above via helper).
  const renderedFlat: CommandItem[] = orderedSectionsToFlat(orderedSections);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="glass-heavy max-w-2xl gap-0 overflow-hidden rounded-2xl border-[var(--brand)]/20 p-0 shadow-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search stores, views, and actions. Use arrow keys to navigate and
          Enter to select.
        </DialogDescription>

        {/* ── Search bar ───────────────────────────────────────────── */}
        <div className="relative flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Tìm kiếm cửa hàng, chế độ xem, hành động..."
            className="flex-1 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/70"
            aria-label="Tìm kiếm lệnh"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
              <kbd className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-semibold">
                esc
              </kbd>
              để đóng
            </span>
          )}
        </div>

        {/* ── Results ─────────────────────────────────────────────── */}
        <div
          ref={listRef}
          onKeyDown={handleKeyDown}
          className="scrollbar-thin max-h-[60vh] min-h-[120px] overflow-y-auto px-2 py-2"
          role="listbox"
          aria-label="Command results"
        >
          {totalCount === 0 ? (
            <EmptyState query={query} onClear={() => setQuery("")} />
          ) : (
            <div className="flex flex-col gap-1">
              {orderedSections.map((section) => {
                const meta = section.isRecent
                  ? null
                  : section.category
                    ? CATEGORY_META[section.category]
                    : null;
                return (
                  <div key={section.key} className="flex flex-col">
                    {/* Section header */}
                    <div className="sticky top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-background/95 to-background/80 px-3 py-1.5 backdrop-blur-sm">
                      {section.isRecent ? (
                        <Clock className="h-3 w-3 text-amber-500" />
                      ) : meta ? (
                        <meta.icon
                          className={cn("h-3 w-3", meta.iconColor)}
                        />
                      ) : null}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {section.label}
                      </span>
                      {!section.isRecent && meta?.hint && (
                        <span className="text-[10px] text-muted-foreground/70">
                          · {meta.hint}
                        </span>
                      )}
                      <span className="ml-auto rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                        {section.items.length}
                      </span>
                    </div>

                    {/* Items */}
                    {section.items.map((item) => {
                      const flatIdx = renderedFlat.findIndex(
                        (it) => it.id === item.id,
                      );
                      return (
                        <CommandRow
                          key={item.id}
                          item={item}
                          index={flatIdx}
                          selected={flatIdx === activeIndex}
                          onSelect={() => execute(item)}
                          onHover={() => setActiveIndex(flatIdx)}
                          isRecent={section.isRecent}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <FooterHints />
      </DialogContent>
    </Dialog>
  );
}

// Flatten ordered sections into a single list (used for keyboard indexing).
function orderedSectionsToFlat(
  sections: Array<{
    key: string;
    items: CommandItem[];
  }>,
): CommandItem[] {
  const flat: CommandItem[] = [];
  for (const s of sections) flat.push(...s.items);
  return flat;
}

// ─── Empty state ─────────────────────────────────────────────────────────

function EmptyState({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  const suggestions = [
    "Gợi ý: Lê Lai",
    "Gợi ý: Mô phỏng",
    "Gợi ý: Xuất báo cáo",
    "Gợi ý: Hướng dẫn",
  ];
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Không tìm thấy lệnh nào
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Không tìm thấy kết quả phù hợp cho{" "}
          <span className="font-mono text-[var(--brand)]">
            &ldquo;{query}&rdquo;
          </span>
          . Vui lòng thử từ khóa khác.
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onClear()}
            className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CommandPalette;
