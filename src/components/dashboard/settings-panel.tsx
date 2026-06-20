"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Settings / Preferences Panel
// A slide-in panel (from the right) triggered by a gear icon in the header.
// Lets users customize their dashboard experience: appearance, data refresh,
// units & formats, notifications, and agent behavior.
//
// Exports:
//   • SettingsProvider  — wraps the app, persists settings in localStorage
//   • useSettings()     — hook to read/update settings from anywhere
//   • SettingsPanel     — the gear button + slide-in panel UI
//   • AppSettings       — the settings shape (typed)
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Globe,
  RefreshCw,
  Bell,
  Volume2,
  Bot,
  Download,
  Upload,
  RotateCcw,
  Palette,
  Database,
  Ruler,
  Thermometer,
  Wind,
  Gauge,
  Clock,
  Calendar,
  CloudRain,
  ChevronUp,
  ChevronDown,
  ShieldAlert,
  Sparkles,
  Check,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n/language-provider";

// ─── Types ─────────────────────────────────────────────────────────────────

export type WeatherSourceId =
  | "open-meteo"
  | "nasa-gpm"
  | "meteostat"
  | "metar";

export interface WeatherSourceItem {
  id: WeatherSourceId;
  enabled: boolean;
}

export interface AppSettings {
  // Appearance
  theme: "light" | "dark" | "system";
  language: "en" | "vi";
  compactMode: boolean;
  animations: boolean;
  // Data & Refresh
  autoRefreshInterval: "off" | "30s" | "1min" | "5min";
  weatherSourcePriority: WeatherSourceItem[];
  showFallbackData: boolean;
  cacheDuration: "1min" | "5min" | "15min";
  // Units & Format
  temperatureUnit: "celsius" | "fahrenheit";
  windUnit: "kmh" | "mph" | "ms";
  pressureUnit: "hPa" | "mb" | "inHg";
  timeFormat: "12h" | "24h";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  // Notifications
  notificationsEnabled: boolean;
  agentNotifications: boolean;
  weatherAlerts: boolean;
  automationNotifications: boolean;
  systemNotifications: boolean;
  notificationSound: boolean;
  // Agent Behavior
  autoRunAgent: boolean;
  confidenceThreshold: number; // 0-100
  riskSensitivity: "low" | "medium" | "high";
  showTraceByDefault: boolean;
}

const DEFAULT_WEATHER_PRIORITY: WeatherSourceItem[] = [
  { id: "open-meteo", enabled: true },
  { id: "nasa-gpm", enabled: true },
  { id: "meteostat", enabled: false },
  { id: "metar", enabled: true },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  language: "en",
  compactMode: false,
  animations: true,
  autoRefreshInterval: "off",
  weatherSourcePriority: DEFAULT_WEATHER_PRIORITY,
  showFallbackData: true,
  cacheDuration: "5min",
  temperatureUnit: "celsius",
  windUnit: "kmh",
  pressureUnit: "hPa",
  timeFormat: "24h",
  dateFormat: "DD/MM/YYYY",
  notificationsEnabled: true,
  agentNotifications: true,
  weatherAlerts: true,
  automationNotifications: true,
  systemNotifications: true,
  notificationSound: false,
  autoRunAgent: true,
  confidenceThreshold: 75,
  riskSensitivity: "medium",
  showTraceByDefault: false,
};

const STORAGE_KEY = "camate.settings.v1";

const WEATHER_SOURCE_META: Record<
  WeatherSourceId,
  { label: string; description: string }
> = {
  "open-meteo": {
    label: "Open-Meteo",
    description: "Primary live source — current + forecast",
  },
  "nasa-gpm": {
    label: "NASA GPM IMERG",
    description: "Satellite rain-rate evidence layer",
  },
  meteostat: {
    label: "Meteostat",
    description: "Historical climate normals",
  },
  metar: {
    label: "METAR",
    description: "Aviation station weather (Tan Son Nhat)",
  },
};

// ─── Context ───────────────────────────────────────────────────────────────

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  /** Import a settings object (merged with defaults). Returns true on success. */
  importSettings: (raw: string) => boolean;
  hydrated: boolean;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}

/**
 * Deep-merge a parsed object with DEFAULT_SETTINGS, keeping only known keys
 * and validating enum values. Unknown / invalid fields fall back to defaults.
 */
function normalizeSettings(parsed: unknown): AppSettings {
  if (typeof parsed !== "object" || parsed === null) {
    return { ...DEFAULT_SETTINGS };
  }
  const src = parsed as Record<string, unknown>;
  const out: AppSettings = { ...DEFAULT_SETTINGS };

  // Scalars with enum validation
  const enumPick = <T extends string>(
    key: keyof AppSettings,
    allowed: readonly T[],
    fallback: T,
  ): T => {
    const v = src[key as string];
    return typeof v === "string" && (allowed as readonly string[]).includes(v)
      ? (v as T)
      : fallback;
  };

  out.theme = enumPick(
    "theme",
    ["light", "dark", "system"] as const,
    DEFAULT_SETTINGS.theme,
  );
  out.language = enumPick(
    "language",
    ["en", "vi"] as const,
    DEFAULT_SETTINGS.language,
  );
  out.autoRefreshInterval = enumPick(
    "autoRefreshInterval",
    ["off", "30s", "1min", "5min"] as const,
    DEFAULT_SETTINGS.autoRefreshInterval,
  );
  out.cacheDuration = enumPick(
    "cacheDuration",
    ["1min", "5min", "15min"] as const,
    DEFAULT_SETTINGS.cacheDuration,
  );
  out.temperatureUnit = enumPick(
    "temperatureUnit",
    ["celsius", "fahrenheit"] as const,
    DEFAULT_SETTINGS.temperatureUnit,
  );
  out.windUnit = enumPick(
    "windUnit",
    ["kmh", "mph", "ms"] as const,
    DEFAULT_SETTINGS.windUnit,
  );
  out.pressureUnit = enumPick(
    "pressureUnit",
    ["hPa", "mb", "inHg"] as const,
    DEFAULT_SETTINGS.pressureUnit,
  );
  out.timeFormat = enumPick(
    "timeFormat",
    ["12h", "24h"] as const,
    DEFAULT_SETTINGS.timeFormat,
  );
  out.dateFormat = enumPick(
    "dateFormat",
    ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const,
    DEFAULT_SETTINGS.dateFormat,
  );
  out.riskSensitivity = enumPick(
    "riskSensitivity",
    ["low", "medium", "high"] as const,
    DEFAULT_SETTINGS.riskSensitivity,
  );

  // Booleans
  const boolKeys: (keyof AppSettings)[] = [
    "compactMode",
    "animations",
    "showFallbackData",
    "notificationsEnabled",
    "agentNotifications",
    "weatherAlerts",
    "automationNotifications",
    "systemNotifications",
    "notificationSound",
    "autoRunAgent",
    "showTraceByDefault",
  ];
  for (const k of boolKeys) {
    const v = src[k as string];
    if (typeof v === "boolean") {
      (out as unknown as Record<string, unknown>)[k as string] = v;
    }
  }

  // confidenceThreshold — clamp 0..100
  const ct = src.confidenceThreshold;
  if (typeof ct === "number" && Number.isFinite(ct)) {
    out.confidenceThreshold = Math.max(0, Math.min(100, Math.round(ct)));
  }

  // weatherSourcePriority — accept a valid array, otherwise keep defaults
  const wsp = src.weatherSourcePriority;
  if (Array.isArray(wsp) && wsp.length > 0) {
    const knownIds = Object.keys(WEATHER_SOURCE_META) as WeatherSourceId[];
    const normalized: WeatherSourceItem[] = [];
    for (const item of wsp) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string" &&
        knownIds.includes((item as { id: WeatherSourceId }).id)
      ) {
        normalized.push({
          id: (item as { id: WeatherSourceId }).id,
          enabled: Boolean((item as { enabled?: unknown }).enabled),
        });
      }
    }
    // Ensure all known sources are present (append any missing defaults)
    for (const id of knownIds) {
      if (!normalized.some((n) => n.id === id)) {
        const def = DEFAULT_WEATHER_PRIORITY.find((d) => d.id === id);
        normalized.push({ id, enabled: def ? def.enabled : true });
      }
    }
    out.weatherSourcePriority = normalized;
  }

  return out;
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function SettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = React.useState<AppSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return normalizeSettings(parsed);
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });
  const [hydrated, setHydrated] = React.useState(false);

  const { setTheme } = useTheme();
  const { setLang } = useLang();

  // Hydrate from localStorage on mount.
  React.useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  // Persist on change (after hydration).
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore quota / serialization errors
    }
  }, [settings, hydrated]);

  // Apply theme & language to next-themes / language-provider on hydration
  // (so persisted prefs win over their own default-detection).
  React.useEffect(() => {
    if (!hydrated) return;
    setTheme(settings.theme);
  }, [hydrated]); // eslint-ignore-line: apply once on hydration

  React.useEffect(() => {
    if (!hydrated) return;
    setLang(settings.language);
  }, [hydrated]); // eslint-ignore-line: apply once on hydration

  // Apply compact-mode / no-animations classes to <html>.
  React.useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.classList.toggle("compact-mode", settings.compactMode);
    root.classList.toggle("no-animations", !settings.animations);
  }, [settings.compactMode, settings.animations, hydrated]);

  const updateSettings = React.useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  const resetSettings = React.useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const importSettings = React.useCallback((raw: string): boolean => {
    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeSettings(parsed);
      setSettings(normalized);
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = React.useMemo<SettingsContextValue>(
    () => ({ settings, updateSettings, resetSettings, importSettings, hydrated }),
    [settings, updateSettings, resetSettings, importSettings, hydrated],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ─── Gear button + slide-in panel ──────────────────────────────────────────

type SettingsTab =
  | "appearance"
  | "data"
  | "units"
  | "notifications"
  | "agent";

export function SettingsPanel() {
  const { settings, updateSettings, resetSettings, importSettings } =
    useSettings();
  const { setTheme } = useTheme();
  const { setLang } = useLang();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<SettingsTab>("appearance");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // ── External open trigger (e.g. from the ⌘K Command Palette) ──
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("camate:open-settings", handler);
    return () =>
      window.removeEventListener("camate:open-settings", handler);
  }, []);

  // ── Handlers that bridge settings + next-themes / language-provider ──
  const handleThemeChange = (value: AppSettings["theme"]) => {
    updateSettings({ theme: value });
    setTheme(value);
  };

  const handleLanguageChange = (value: AppSettings["language"]) => {
    updateSettings({ language: value });
    setLang(value);
  };

  // ── Weather source priority reorder / toggle ──
  const moveWeatherSource = (index: number, dir: -1 | 1) => {
    const arr = [...settings.weatherSourcePriority];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    updateSettings({ weatherSourcePriority: arr });
  };

  const toggleWeatherSource = (id: WeatherSourceId) => {
    const arr = settings.weatherSourcePriority.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s,
    );
    updateSettings({ weatherSourcePriority: arr });
  };

  // ── Reset ──
  const handleReset = () => {
    resetSettings();
    setTheme(DEFAULT_SETTINGS.theme);
    setLang(DEFAULT_SETTINGS.language);
    toast.success("Settings reset to defaults");
  };

  // ── Export ──
  const handleExport = () => {
    try {
      const blob = new Blob([JSON.stringify(settings, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `camate-settings-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Settings exported");
    } catch {
      toast.error("Export failed");
    }
  };

  // ── Import ──
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (importSettings(text)) {
        // Sync theme & lang immediately
        try {
          const parsed = JSON.parse(text) as Partial<AppSettings>;
          if (parsed.theme) setTheme(parsed.theme);
          if (parsed.language) setLang(parsed.language);
        } catch {
          // ignore
        }
        toast.success("Settings imported");
      } else {
        toast.error("Invalid settings file");
      }
    };
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Gear trigger button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative h-8 w-8 p-0 transition-transform hover:scale-105 hover:rotate-45"
        aria-label="Settings & preferences"
        title="Settings"
      >
        <Settings className="h-4 w-4" />
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
                <Settings className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base leading-tight">
                  Settings
                </SheetTitle>
                <SheetDescription className="text-[11px] leading-tight">
                  Customize your dashboard experience
                </SheetDescription>
              </div>
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-[var(--brand)]/25 bg-[var(--brand)]/10 text-[var(--brand)] font-semibold"
              >
                <Sparkles className="h-2.5 w-2.5" />
                v1
              </Badge>
            </div>
          </SheetHeader>

          {/* ── Tabs ───────────────────────────────────────────────── */}
          <div className="border-b bg-muted/30 px-3 py-2.5">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as SettingsTab)}
              className="w-full"
            >
              <TabsList className="h-9 w-full bg-muted/60">
                <TabsTrigger value="appearance" className="gap-1 text-[11px]">
                  <Palette className="h-3 w-3" />
                  Appearance
                </TabsTrigger>
                <TabsTrigger value="data" className="gap-1 text-[11px]">
                  <Database className="h-3 w-3" />
                  Data
                </TabsTrigger>
                <TabsTrigger value="units" className="gap-1 text-[11px]">
                  <Ruler className="h-3 w-3" />
                  Units
                </TabsTrigger>
                <TabsTrigger
                  value="notifications"
                  className="gap-1 text-[11px]"
                >
                  <Bell className="h-3 w-3" />
                  Alerts
                </TabsTrigger>
                <TabsTrigger value="agent" className="gap-1 text-[11px]">
                  <Bot className="h-3 w-3" />
                  Agent
                </TabsTrigger>
              </TabsList>

              {/* ── Tab content (scrollable) ─────────────────────── */}
              <ScrollArea className="h-[calc(100vh-13.5rem)] scrollbar-thin">
                <div className="flex flex-col gap-3 p-3">
                  <TabsContent value="appearance" className="mt-0">
                    <AppearanceTab
                      settings={settings}
                      onThemeChange={handleThemeChange}
                      onLanguageChange={handleLanguageChange}
                      onUpdate={updateSettings}
                    />
                  </TabsContent>

                  <TabsContent value="data" className="mt-0">
                    <DataTab
                      settings={settings}
                      onUpdate={updateSettings}
                      onMoveWeatherSource={moveWeatherSource}
                      onToggleWeatherSource={toggleWeatherSource}
                    />
                  </TabsContent>

                  <TabsContent value="units" className="mt-0">
                    <UnitsTab settings={settings} onUpdate={updateSettings} />
                  </TabsContent>

                  <TabsContent value="notifications" className="mt-0">
                    <NotificationsTab
                      settings={settings}
                      onUpdate={updateSettings}
                    />
                  </TabsContent>

                  <TabsContent value="agent" className="mt-0">
                    <AgentTab settings={settings} onUpdate={updateSettings} />
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>

          {/* ── Footer: Reset · Export · Import ───────────────────── */}
          <div className="mt-auto flex items-center gap-1.5 border-t bg-muted/30 px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-8 gap-1.5 text-[11px] font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <div className="ml-auto flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-8 gap-1.5 text-[11px] font-medium"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportClick}
                className="h-8 gap-1.5 text-[11px] font-medium"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Shared subcomponents ───────────────────────────────────────────────────

function SectionLabel({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1 pb-1 pt-0.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--brand)]/10 text-[var(--brand)]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-[10px] leading-tight text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/** A row with icon + label + description on the left, control on the right. */
function SettingRow({
  icon: Icon,
  label,
  description,
  children,
  className,
  controlClassName,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  controlClassName?: string;
}) {
  return (
    <div
      className={cn(
        "card-interactive flex items-center gap-3 rounded-lg border bg-card p-3",
        className,
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold leading-tight">{label}</p>
        {description && (
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className={cn("flex shrink-0 items-center", controlClassName)}>
        {children}
      </div>
    </div>
  );
}

/** A stacked row where the control sits below the label (for selects/groups). */
function SettingRowStacked({
  icon: Icon,
  label,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "card-interactive flex flex-col gap-2 rounded-lg border bg-card p-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold leading-tight">{label}</p>
          {description && (
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="pl-10">{children}</div>
    </div>
  );
}

// ─── a. Appearance tab ─────────────────────────────────────────────────────

function AppearanceTab({
  settings,
  onThemeChange,
  onLanguageChange,
  onUpdate,
}: {
  settings: AppSettings;
  onThemeChange: (v: AppSettings["theme"]) => void;
  onLanguageChange: (v: AppSettings["language"]) => void;
  onUpdate: (partial: Partial<AppSettings>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel
        icon={Palette}
        title="Appearance"
        description="Theme, language & layout density"
      />

      {/* Theme */}
      <SettingRowStacked
        icon={Sun}
        label="Theme"
        description="Light, dark, or follow system preference"
      >
        <RadioGroup
          value={settings.theme}
          onValueChange={(v) =>
            onThemeChange(v as AppSettings["theme"])
          }
          className="grid grid-cols-3 gap-2"
        >
          {[
            { value: "light", label: "Light", icon: Sun },
            { value: "dark", label: "Dark", icon: Moon },
            { value: "system", label: "System", icon: Monitor },
          ].map(({ value, label, icon: Icon }) => (
            <Label
              key={value}
              htmlFor={`theme-${value}`}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-md border px-2 py-2 text-[10px] font-semibold transition-colors",
                settings.theme === value
                  ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              <RadioGroupItem
                id={`theme-${value}`}
                value={value}
                className="sr-only"
              />
              <Icon className="h-4 w-4" />
              {label}
            </Label>
          ))}
        </RadioGroup>
      </SettingRowStacked>

      {/* Language */}
      <SettingRowStacked
        icon={Globe}
        label="Language"
        description="Interface language"
      >
        <RadioGroup
          value={settings.language}
          onValueChange={(v) =>
            onLanguageChange(v as AppSettings["language"])
          }
          className="grid grid-cols-2 gap-2"
        >
          {[
            { value: "en", label: "English", short: "EN" },
            { value: "vi", label: "Tiếng Việt", short: "VI" },
          ].map(({ value, label, short }) => (
            <Label
              key={value}
              htmlFor={`lang-${value}`}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors",
                settings.language === value
                  ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              <RadioGroupItem
                id={`lang-${value}`}
                value={value}
                className="sr-only"
              />
              <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[9px] font-bold">
                {short}
              </span>
              {label}
            </Label>
          ))}
        </RadioGroup>
      </SettingRowStacked>

      {/* Compact mode */}
      <SettingRow
        icon={Ruler}
        label="Compact mode"
        description="Reduce padding & spacing across the dashboard"
      >
        <Switch
          checked={settings.compactMode}
          onCheckedChange={(v) => onUpdate({ compactMode: v })}
          aria-label="Compact mode"
        />
      </SettingRow>

      {/* Animations */}
      <SettingRow
        icon={Sparkles}
        label="Animations"
        description="Enable transitions & motion effects"
      >
        <Switch
          checked={settings.animations}
          onCheckedChange={(v) => onUpdate({ animations: v })}
          aria-label="Animations"
        />
      </SettingRow>
    </div>
  );
}

// ─── b. Data & Refresh tab ─────────────────────────────────────────────────

function DataTab({
  settings,
  onUpdate,
  onMoveWeatherSource,
  onToggleWeatherSource,
}: {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
  onMoveWeatherSource: (index: number, dir: -1 | 1) => void;
  onToggleWeatherSource: (id: WeatherSourceId) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel
        icon={Database}
        title="Data & Refresh"
        description="Refresh cadence, source priority & caching"
      />

      {/* Auto-refresh */}
      <SettingRowStacked
        icon={RefreshCw}
        label="Auto-refresh interval"
        description="How often the dashboard re-runs the agent pipeline"
      >
        <Select
          value={settings.autoRefreshInterval}
          onValueChange={(v) =>
            onUpdate({
              autoRefreshInterval: v as AppSettings["autoRefreshInterval"],
            })
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off (manual)</SelectItem>
            <SelectItem value="30s">Every 30 seconds</SelectItem>
            <SelectItem value="1min">Every 1 minute</SelectItem>
            <SelectItem value="5min">Every 5 minutes</SelectItem>
          </SelectContent>
        </Select>
      </SettingRowStacked>

      {/* Weather source priority */}
      <SettingRowStacked
        icon={CloudRain}
        label="Weather data source priority"
        description="Reorder priority or enable/disable sources"
      >
        <ul className="flex flex-col gap-1.5">
          {settings.weatherSourcePriority.map((src, idx) => {
            const meta = WEATHER_SOURCE_META[src.id];
            return (
              <li
                key={src.id}
                className={cn(
                  "flex items-center gap-2 rounded-md border bg-card/60 px-2 py-1.5 transition-opacity",
                  !src.enabled && "opacity-50",
                )}
              >
                <div className="flex flex-col">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={idx === 0}
                    onClick={() => onMoveWeatherSource(idx, -1)}
                    className="h-4 w-6 p-0"
                    aria-label={`Move ${meta.label} up`}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={idx === settings.weatherSourcePriority.length - 1}
                    onClick={() => onMoveWeatherSource(idx, 1)}
                    className="h-4 w-6 p-0"
                    aria-label={`Move ${meta.label} down`}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold tabular-nums text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold leading-tight">
                    {meta.label}
                  </p>
                  <p className="text-[9px] leading-tight text-muted-foreground">
                    {meta.description}
                  </p>
                </div>
                <Switch
                  checked={src.enabled}
                  onCheckedChange={() => onToggleWeatherSource(src.id)}
                  aria-label={`Toggle ${meta.label}`}
                />
              </li>
            );
          })}
        </ul>
      </SettingRowStacked>

      {/* Show fallback data */}
      <SettingRow
        icon={ShieldAlert}
        label="Show fallback data"
        description="Display deterministic fallback signals when live fetch fails"
      >
        <Switch
          checked={settings.showFallbackData}
          onCheckedChange={(v) => onUpdate({ showFallbackData: v })}
          aria-label="Show fallback data"
        />
      </SettingRow>

      {/* Cache duration */}
      <SettingRowStacked
        icon={Database}
        label="Cache duration"
        description="How long weather & agent results are cached"
      >
        <Select
          value={settings.cacheDuration}
          onValueChange={(v) =>
            onUpdate({
              cacheDuration: v as AppSettings["cacheDuration"],
            })
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1min">1 minute</SelectItem>
            <SelectItem value="5min">5 minutes</SelectItem>
            <SelectItem value="15min">15 minutes</SelectItem>
          </SelectContent>
        </Select>
      </SettingRowStacked>
    </div>
  );
}

// ─── c. Units & Format tab ─────────────────────────────────────────────────

function UnitsTab({
  settings,
  onUpdate,
}: {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel
        icon={Ruler}
        title="Units & Format"
        description="Measurement units & display formats"
      />

      <SettingRowStacked
        icon={Thermometer}
        label="Temperature"
        description="Unit for temperature readings"
      >
        <Select
          value={settings.temperatureUnit}
          onValueChange={(v) =>
            onUpdate({
              temperatureUnit: v as AppSettings["temperatureUnit"],
            })
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="celsius">Celsius (°C)</SelectItem>
            <SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem>
          </SelectContent>
        </Select>
      </SettingRowStacked>

      <SettingRowStacked
        icon={Wind}
        label="Wind speed"
        description="Unit for wind speed"
      >
        <Select
          value={settings.windUnit}
          onValueChange={(v) =>
            onUpdate({ windUnit: v as AppSettings["windUnit"] })
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kmh">km/h</SelectItem>
            <SelectItem value="mph">mph</SelectItem>
            <SelectItem value="ms">m/s</SelectItem>
          </SelectContent>
        </Select>
      </SettingRowStacked>

      <SettingRowStacked
        icon={Gauge}
        label="Pressure"
        description="Unit for atmospheric pressure"
      >
        <Select
          value={settings.pressureUnit}
          onValueChange={(v) =>
            onUpdate({
              pressureUnit: v as AppSettings["pressureUnit"],
            })
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hPa">hPa</SelectItem>
            <SelectItem value="mb">mb</SelectItem>
            <SelectItem value="inHg">inHg</SelectItem>
          </SelectContent>
        </Select>
      </SettingRowStacked>

      <SettingRowStacked
        icon={Clock}
        label="Time format"
        description="12-hour or 24-hour clock"
      >
        <Select
          value={settings.timeFormat}
          onValueChange={(v) =>
            onUpdate({ timeFormat: v as AppSettings["timeFormat"] })
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="12h">12-hour (1:30 PM)</SelectItem>
            <SelectItem value="24h">24-hour (13:30)</SelectItem>
          </SelectContent>
        </Select>
      </SettingRowStacked>

      <SettingRowStacked
        icon={Calendar}
        label="Date format"
        description="Date display format"
      >
        <Select
          value={settings.dateFormat}
          onValueChange={(v) =>
            onUpdate({ dateFormat: v as AppSettings["dateFormat"] })
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
          </SelectContent>
        </Select>
      </SettingRowStacked>
    </div>
  );
}

// ─── d. Notifications tab ──────────────────────────────────────────────────

function NotificationsTab({
  settings,
  onUpdate,
}: {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}) {
  const masterOff = !settings.notificationsEnabled;

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel
        icon={Bell}
        title="Notifications"
        description="What gets pushed to the activity feed"
      />

      {/* Master toggle */}
      <div
        className={cn(
          "card-interactive flex items-center gap-3 rounded-lg border-2 border-[var(--brand)]/30 bg-[var(--brand)]/5 p-3",
          masterOff && "opacity-60",
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md brand-gradient text-white">
          <Bell className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold leading-tight">
            Enable notifications
          </p>
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
            Master switch — turns off all alerts below when disabled
          </p>
        </div>
        <Switch
          checked={settings.notificationsEnabled}
          onCheckedChange={(v) => onUpdate({ notificationsEnabled: v })}
          aria-label="Enable notifications"
        />
      </div>

      <NotificationToggleRow
        icon={Bot}
        label="Agent run notifications"
        description="When the agent pipeline completes or fails"
        checked={settings.agentNotifications}
        disabled={masterOff}
        onCheckedChange={(v) => onUpdate({ agentNotifications: v })}
      />
      <NotificationToggleRow
        icon={CloudRain}
        label="Weather alerts"
        description="Rain risk threshold crossings & severe weather"
        checked={settings.weatherAlerts}
        disabled={masterOff}
        onCheckedChange={(v) => onUpdate({ weatherAlerts: v })}
      />
      <NotificationToggleRow
        icon={Settings}
        label="Automation task notifications"
        description="Approval requests & task completions"
        checked={settings.automationNotifications}
        disabled={masterOff}
        onCheckedChange={(v) => onUpdate({ automationNotifications: v })}
      />
      <NotificationToggleRow
        icon={Monitor}
        label="System notifications"
        description="Data source status & pipeline health"
        checked={settings.systemNotifications}
        disabled={masterOff}
        onCheckedChange={(v) => onUpdate({ systemNotifications: v })}
      />

      <Separator className="my-1" />

      <SettingRow
        icon={Volume2}
        label="Notification sound"
        description="Play a sound when a new notification arrives"
        className={cn(masterOff && "pointer-events-none opacity-50")}
      >
        <Switch
          checked={settings.notificationSound}
          onCheckedChange={(v) => onUpdate({ notificationSound: v })}
          disabled={masterOff}
          aria-label="Notification sound"
        />
      </SettingRow>
    </div>
  );
}

function NotificationToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "card-interactive flex items-center gap-3 rounded-lg border bg-card p-3 transition-opacity",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold leading-tight">{label}</p>
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        checked={checked && !disabled}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}

// ─── e. Agent Behavior tab ─────────────────────────────────────────────────

function AgentTab({
  settings,
  onUpdate,
}: {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel
        icon={Bot}
        title="Agent Behavior"
        description="Tune the agentic AI pipeline"
      />

      {/* Auto-run agent */}
      <SettingRow
        icon={RefreshCw}
        label="Auto-run agent on store selection"
        description="Trigger the pipeline automatically when a store is selected"
      >
        <Switch
          checked={settings.autoRunAgent}
          onCheckedChange={(v) => onUpdate({ autoRunAgent: v })}
          aria-label="Auto-run agent"
        />
      </SettingRow>

      {/* Confidence threshold slider */}
      <div className="card-interactive flex flex-col gap-2 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold leading-tight">
              Confidence threshold for auto-approval
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              Actions above this confidence are auto-approved
            </p>
          </div>
          <Badge className="shrink-0 brand-gradient text-white tabular-nums">
            {settings.confidenceThreshold}%
          </Badge>
        </div>
        <div className="pl-10 pr-1">
          <Slider
            value={[settings.confidenceThreshold]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) =>
              onUpdate({ confidenceThreshold: v[0] ?? 75 })
            }
            className="w-full"
            aria-label="Confidence threshold"
          />
          <div className="mt-1 flex justify-between text-[9px] font-medium text-muted-foreground">
            <span>0% · approve all</span>
            <span>50%</span>
            <span>100% · manual only</span>
          </div>
        </div>
      </div>

      {/* Risk sensitivity */}
      <SettingRowStacked
        icon={ShieldAlert}
        label="Risk sensitivity"
        description="Multiplier applied to risk score calculations"
      >
        <RadioGroup
          value={settings.riskSensitivity}
          onValueChange={(v) =>
            onUpdate({ riskSensitivity: v as AppSettings["riskSensitivity"] })
          }
          className="grid grid-cols-3 gap-2"
        >
          {[
            {
              value: "low",
              label: "Low",
              badge: "0.8×",
              className: "risk-text-low",
            },
            {
              value: "medium",
              label: "Medium",
              badge: "1.0×",
              className: "risk-text-medium",
            },
            {
              value: "high",
              label: "High",
              badge: "1.25×",
              className: "risk-text-critical",
            },
          ].map(({ value, label, badge, className: badgeClass }) => (
            <Label
              key={value}
              htmlFor={`risk-${value}`}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-[10px] font-semibold transition-colors",
                settings.riskSensitivity === value
                  ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              <RadioGroupItem
                id={`risk-${value}`}
                value={value}
                className="sr-only"
              />
              <span className="text-[11px]">{label}</span>
              <span className={cn("text-[9px] font-bold", badgeClass)}>
                {badge}
              </span>
            </Label>
          ))}
        </RadioGroup>
      </SettingRowStacked>

      {/* Show trace by default */}
      <SettingRow
        icon={Sparkles}
        label="Show agent trace by default"
        description="Expand the execution trace panel on load"
      >
        <Switch
          checked={settings.showTraceByDefault}
          onCheckedChange={(v) => onUpdate({ showTraceByDefault: v })}
          aria-label="Show agent trace by default"
        />
      </SettingRow>
    </div>
  );
}
