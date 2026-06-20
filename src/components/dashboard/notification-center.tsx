"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Notification Center / Activity Feed
// A slide-in panel that shows a live timeline of agent runs, weather alerts,
// automation tasks, system events, and knowledge-base events.
//
// Exports:
//   • NotificationProvider   — wraps the app, manages state in localStorage
//   • useNotificationCenter  — hook to push notifications from anywhere
//   • NotificationCenter     — the bell button + slide-in panel UI
//   • AppNotification, NotificationType, NotificationPriority — types
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import {
  Bell,
  Bot,
  Check,
  CheckCheck,
  CloudRain,
  FileText,
  Inbox,
  Settings,
  X,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type NotificationType =
  | "agent"
  | "weather"
  | "automation"
  | "system"
  | "knowledge";

export type NotificationPriority = "info" | "warning" | "critical" | "success";

export interface AppNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  description: string;
  /** ISO timestamp string. */
  timestamp: string;
  read: boolean;
  storeName?: string;
}

type FilterTab = "all" | "alerts" | "tasks" | "system";

interface NotificationContextValue {
  /** Push a new notification. id/timestamp/read are auto-generated. */
  notify: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = React.createContext<NotificationContextValue | null>(null);

/**
 * Hook used by any client component to push a notification into the feed.
 * Returns `null` if used outside of <NotificationProvider>.
 */
export function useNotificationCenter(): NotificationContextValue | null {
  return React.useContext(NotificationContext);
}

const STORAGE_KEY = "camate.notifications.v1";
const MAX_NOTIFICATIONS = 100;

// ─── Visual config ────────────────────────────────────────────────────────

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  agent: Bot,
  weather: CloudRain,
  automation: Settings,
  system: Settings,
  knowledge: FileText,
};

const TYPE_STYLES: Record<
  NotificationType,
  { bg: string; text: string; ring: string; label: string }
> = {
  agent: {
    bg: "bg-[var(--brand)]/10",
    text: "text-[var(--brand)]",
    ring: "ring-[var(--brand)]/20",
    label: "AI Trợ lý",
  },
  weather: {
    bg: "risk-bg-medium",
    text: "risk-text-medium",
    ring: "ring-[var(--risk-medium)]/30",
    label: "Thời tiết",
  },
  automation: {
    bg: "risk-bg-low",
    text: "risk-text-low",
    ring: "ring-[var(--risk-low)]/30",
    label: "Vận hành",
  },
  system: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    ring: "ring-border",
    label: "Hệ thống",
  },
  knowledge: {
    bg: "bg-[var(--chart-5)]/10",
    text: "text-[var(--chart-5)]",
    ring: "ring-[var(--chart-5)]/30",
    label: "Tài liệu",
  },
};

const PRIORITY_BORDER: Record<NotificationPriority, string> = {
  info: "border-l-border",
  warning: "border-l-[var(--risk-medium)]",
  critical: "border-l-[var(--risk-critical)]",
  success: "border-l-[var(--risk-low)]",
};

const PRIORITY_BADGE: Record<
  NotificationPriority,
  { label: string; className: string }
> = {
  info: { label: "Thông tin", className: "bg-muted text-muted-foreground" },
  warning: {
    label: "Cảnh báo",
    className: "risk-bg-medium risk-text-medium",
  },
  critical: {
    label: "Khẩn cấp",
    className: "risk-bg-critical risk-text-critical",
  },
  success: { label: "Thành công", className: "risk-bg-low risk-text-low" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function genId(): string {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "vừa xong";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} ngày trước`;
  return new Date(iso).toLocaleDateString();
}

function matchesTab(n: AppNotification, tab: FilterTab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "alerts":
      return (
        n.type === "weather" || n.priority === "critical" || n.priority === "warning"
      );
    case "tasks":
      return n.type === "automation" || n.type === "agent";
    case "system":
      return n.type === "system" || n.type === "knowledge";
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = React.useState<AppNotification[]>(() => {
    if (typeof window === "undefined") return [];
    let parsed: AppNotification[] | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const candidate = JSON.parse(raw) as unknown;
        if (Array.isArray(candidate)) parsed = candidate as AppNotification[];
      }
    } catch {
      // ignore
    }

    return parsed ?? [];
  });
  const [hydrated, setHydrated] = React.useState(false);

  // Đánh dấu đã hydrate state từ localStorage.
  React.useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  // Persist to localStorage whenever notifications change (after hydration).
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)),
      );
    } catch {
      // ignore quota / serialization errors
    }
  }, [notifications, hydrated]);

  const notify = React.useCallback(
    (n: Omit<AppNotification, "id" | "timestamp" | "read">) => {
      const newNotif: AppNotification = {
        ...n,
        id: genId(),
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications((prev) =>
        [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS),
      );
    },
    [],
  );

  const markAllRead = React.useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = React.useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const clearAll = React.useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value = React.useMemo<NotificationContextValue>(
    () => ({
      notify,
      notifications,
      unreadCount,
      markAllRead,
      markRead,
      clearAll,
    }),
    [notify, notifications, unreadCount, markAllRead, markRead, clearAll],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ─── Bell button + slide-in panel ─────────────────────────────────────────

export function NotificationCenter() {
  const ctx = React.useContext(NotificationContext);
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<FilterTab>("all");

  // ── External open trigger (e.g. from the ⌘K Command Palette) ──
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("camate:open-notifications", handler);
    return () =>
      window.removeEventListener("camate:open-notifications", handler);
  }, []);

  // Fallback render if used outside a provider — just show the bell.
  if (!ctx) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="relative h-8 w-8 p-0"
        aria-label="Thông báo"
      >
        <Bell className="h-4 w-4" />
      </Button>
    );
  }

  const { notifications, unreadCount, markAllRead, markRead, clearAll } = ctx;

  const counts = {
    all: notifications.length,
    alerts: notifications.filter((n) => matchesTab(n, "alerts")).length,
    tasks: notifications.filter((n) => matchesTab(n, "tasks")).length,
    system: notifications.filter((n) => matchesTab(n, "system")).length,
  };

  const filtered = notifications.filter((n) => matchesTab(n, tab));

  return (
    <>
      {/* Bell trigger button with unread badge */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative h-8 w-8 p-0 transition-transform hover:scale-105"
        aria-label={
          unreadCount > 0
            ? `Thông báo, ${unreadCount} chưa đọc`
            : "Thông báo"
        }
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--risk-critical)] px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <SheetHeader className="gap-1.5 border-b bg-card/60 px-5 pb-3 pt-4 pr-10">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient text-white shadow-sm">
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base leading-tight">
                  Nhật ký hoạt động
                </SheetTitle>
                <SheetDescription className="text-[11px] leading-tight">
                  Dòng thời gian hoạt động của AI, cảnh báo thời tiết & tự động hóa
                </SheetDescription>
              </div>
              {unreadCount > 0 && (
                <Badge className="risk-bg-critical risk-text-critical shrink-0 gap-1 font-semibold">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--risk-critical)] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--risk-critical)]" />
                  </span>
                  {unreadCount} mới
                </Badge>
              )}
            </div>
          </SheetHeader>

          {/* ── Filter Tabs ────────────────────────────────────────── */}
          <div className="border-b bg-muted/30 px-3 py-2.5">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as FilterTab)}
              className="w-full"
            >
              <TabsList className="h-8 w-full bg-muted/60">
                <TabsTrigger value="all" className="gap-1 text-[11px]">
                  Tất cả
                  <CountPill value={counts.all} />
                </TabsTrigger>
                <TabsTrigger value="alerts" className="gap-1 text-[11px]">
                  Cảnh báo
                  <CountPill value={counts.alerts} />
                </TabsTrigger>
                <TabsTrigger value="tasks" className="gap-1 text-[11px]">
                  Nhiệm vụ
                  <CountPill value={counts.tasks} />
                </TabsTrigger>
                <TabsTrigger value="system" className="gap-1 text-[11px]">
                  Hệ thống
                  <CountPill value={counts.system} />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* ── Action row (Mark all read / Clear) ─────────────────── */}
          <div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {filtered.length} thông báo
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="h-7 gap-1 px-2 text-[11px] font-medium"
              >
                <CheckCheck className="h-3 w-3" />
                Đọc hết
              </Button>
              <Separator orientation="vertical" className="h-4" />
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={notifications.length === 0}
                className="h-7 gap-1 px-2 text-[11px] font-medium text-muted-foreground hover:text-[var(--risk-critical)]"
              >
                <X className="h-3 w-3" />
                Xóa tất cả
              </Button>
            </div>
          </div>

          {/* ── Notification list ──────────────────────────────────── */}
          <ScrollArea className="flex-1 scrollbar-thin">
            <div className="p-3">
              {filtered.length === 0 ? (
                <EmptyState />
              ) : (
                <ul className="flex flex-col gap-2">
                  {filtered.map((n, idx) => (
                    <NotificationItem
                      key={n.id}
                      n={n}
                      index={idx}
                      onMarkRead={() => markRead(n.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>

          {/* ── Footer ─────────────────────────────────────────────── */}
          <div className="border-t bg-muted/30 px-4 py-2.5">
            <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="status-dot status-live">Live</span>
              <span>· tự động cập nhật từ pipeline AI</span>
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function CountPill({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className="rounded bg-muted-foreground/15 px-1 text-[9px] font-bold tabular-nums">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function NotificationItem({
  n,
  index,
  onMarkRead,
}: {
  n: AppNotification;
  index: number;
  onMarkRead: () => void;
}) {
  const Icon = TYPE_ICON[n.type];
  const typeStyle = TYPE_STYLES[n.type];
  const priorityBorder = PRIORITY_BORDER[n.priority];
  const priorityBadge = PRIORITY_BADGE[n.priority];

  return (
    <li
      className={cn(
        "card-interactive animate-fade-in-up group relative overflow-hidden rounded-lg border border-l-4 bg-card p-3",
        priorityBorder,
        !n.read && "ring-1 ring-[var(--brand)]/10",
      )}
      style={{
        animationDelay: `${Math.min(index, 8) * 40}ms`,
        animationFillMode: "backwards",
      }}
    >
      {/* Unread dot */}
      {!n.read && (
        <span
          className="absolute right-2 top-2 inline-block h-2 w-2 rounded-full bg-[var(--brand)] shadow-sm"
          aria-label="Unread"
        />
      )}

      <div className="flex items-start gap-3 pr-3">
        {/* Type icon */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
            typeStyle.bg,
            typeStyle.text,
            typeStyle.ring,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Meta row */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              {typeStyle.label}
            </span>
            <Separator orientation="vertical" className="h-2.5" />
            <span
              className={cn(
                "rounded px-1 py-0.5 text-[9px] font-bold uppercase",
                priorityBadge.className,
              )}
            >
              {priorityBadge.label}
            </span>
            {n.storeName && (
              <>
                <Separator orientation="vertical" className="h-2.5" />
                <span className="truncate text-[9px] font-medium text-muted-foreground">
                  {n.storeName}
                </span>
              </>
            )}
          </div>

          {/* Title + description */}
          <p
            className={cn(
              "mt-1 text-sm font-semibold leading-snug",
              n.read && "text-muted-foreground",
            )}
          >
            {n.title}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {n.description}
          </p>

          {/* Footer row */}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {formatRelative(n.timestamp)}
            </span>
            {!n.read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMarkRead}
                className="h-6 gap-1 px-1.5 text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                <Check className="h-2.5 w-2.5" />
                Đã đọc
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex animate-fade-in-up flex-col items-center justify-center py-12 text-center">
      <div className="relative mb-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Bell className="h-6 w-6 text-muted-foreground" />
        </div>
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background">
          <Inbox className="h-3 w-3 text-muted-foreground" />
        </span>
      </div>
      <p className="text-sm font-semibold">Chưa có thông báo vận hành.</p>
      <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
        Khi hệ thống chạy phân tích ca, có cảnh báo thời tiết hoặc phê duyệt nhiệm vụ, thông tin sẽ xuất hiện tại đây.
      </p>
    </div>
  );
}

