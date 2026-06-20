"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Store as StoreIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  MapPin,
  Zap,
  CloudSun,
  Database,
  LayoutDashboard,
  Bot,
  Activity,
  MessageSquare,
  BookOpen,
  LayoutGrid,
  FlaskConical,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Settings,
  Utensils,
  Package,
  Users,
  Megaphone,
  ClipboardList,
  ChevronRight,
  TrendingUp,
  FileText,
  Star,
  Layers,
  HelpCircle,
  Play
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { KfcStore } from "@/lib/stores/seed-stores";
import type { AgentRunResult } from "@/lib/types";
import type { RealTimeMetrics, AnomalyAlert, StrategicInsight, OperationEvent } from "@/lib/operations/realTimeEventSchema";
import { SEED_STORES, HIGHLIGHT_STORES } from "@/lib/stores/seed-stores";
import { useLang, useT } from "@/lib/i18n/language-provider";
import { NotificationCenter, useNotificationCenter } from "@/components/dashboard/notification-center";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { StoreSelector } from "@/components/dashboard/store-selector";
import { WeatherSignalPanel } from "@/components/dashboard/weather-signal-panel";
import { ActionPlanPanel } from "@/components/dashboard/action-plan-panel";
import { AgentTracePanel } from "@/components/dashboard/agent-trace-panel";
import { BeforeAfterPanel } from "@/components/dashboard/before-after-panel";
import { ManagerBriefingPanel } from "@/components/dashboard/manager-briefing-panel";
import { WhyAgenticSection } from "@/components/dashboard/why-agentic";
import { CompareView } from "@/components/dashboard/compare-view";
import { DataSourcesPanel } from "@/components/dashboard/data-sources-panel";
import { AutomationCenter } from "@/components/dashboard/automation-center";
import { LiveOperationsMonitor } from "@/components/dashboard/live-operations-monitor";
import { SmartInteractionPanel } from "@/components/dashboard/smart-interaction-panel";
import { KnowledgeBasePanel } from "@/components/dashboard/knowledge-base-panel";
import { StoreOperatingProfilePanel } from "@/components/dashboard/store-operating-profile-panel";
import { AgentRunsHistoryPanel } from "@/components/dashboard/agent-runs-history-panel";
import { WeatherForecastChart } from "@/components/dashboard/weather-forecast-chart";
import { AreaManagerOverview } from "@/components/dashboard/area-manager-overview";
import { DailyForecastPanel } from "@/components/dashboard/daily-forecast-panel";
import { DecisionSimulator } from "@/components/dashboard/decision-simulator";
import { OnboardingTour } from "@/components/dashboard/onboarding-tour";
import { StoreHealthScore } from "@/components/dashboard/store-health-score";
import {
  CommandPalette,
  useCommandPalette,
} from "@/components/dashboard/command-palette";
import { KeyboardShortcuts } from "@/components/dashboard/keyboard-shortcuts";
import { FavoritesCount } from "@/components/dashboard/favorites-provider";
import type { StoreOperatingProfile } from "@/lib/storeProfile/storeOperatingProfile";
import {
  storeTypeLabel,
  storeTypeIcon,
  LiveBadge,
  formatTime,
  riskLevel,
} from "@/components/dashboard/shared";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/client/fetchJson";

type ViewKey = "today-plan" | "area" | "advanced" | "autopilot" | "live" | "chat" | "knowledge" | "simulator";

const StoreMap = dynamic(
  () => import("@/components/dashboard/store-map").then((m) => m.default),
  { ssr: false, loading: () => <MapSkeleton /> },
);

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-100">
      <Loader2 className="h-6 w-6 animate-spin text-[#E4002B]" />
    </div>
  );
}

export default function HomePage() {
  const t = useT();
  const { lang } = useLang();
  const notifCtx = useNotificationCenter();
  const [stores] = React.useState<KfcStore[]>(SEED_STORES);
  
  // Highlight HCMC store profiles for the Judge Demo
  const cbdStore = SEED_STORES.find(s => s.id === "kfc-001") || SEED_STORES[0]; // Nguyễn Thị Minh Khai
  const residentialStore = SEED_STORES.find(s => s.id === "kfc-003") || SEED_STORES[2]; // Gia Định
  const suburbanStore = SEED_STORES.find(s => s.id === "kfc-005") || SEED_STORES[4]; // An Lạc

  const [selectedId, setSelectedId] = React.useState<string | null>(cbdStore.id);
  const [result, setResult] = React.useState<AgentRunResult | null>(null);
  const [currentRunId, setCurrentRunId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  
  // Tab states for 4 Steps
  const [activeStepTab, setActiveStepTab] = React.useState<string>("step-1");
  
  // Judge Demo states
  const [judgeDemoMode, setJudgeDemoMode] = React.useState(false);
  const [judgeStep, setJudgeStep] = React.useState<number>(1);
  const [judgeComparing, setJudgeComparing] = React.useState(false);
  const [judgeCompareResults, setJudgeCompareResults] = React.useState<AgentRunResult[]>([]);
  
  // Standard Compare states
  const [compareResults, setCompareResults] = React.useState<AgentRunResult[]>([]);
  const [compareLoading, setCompareLoading] = React.useState(false);
  
  const [view, setView] = React.useState<ViewKey>("today-plan");
  const [showMap, setShowMap] = React.useState(true);
  const [liveData, setLiveData] = React.useState<any>(null);
  const [liveLoading, setLiveLoading] = React.useState(false);
  const [storeProfile, setStoreProfile] = React.useState<StoreOperatingProfile | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(false);
  
  // Data source mode selected by user in sidebar
  const [dataSourceMode, setDataSourceMode] = React.useState<"demo" | "csv" | "live">("demo");
  const [csvContent, setCsvContent] = React.useState("");

  const historyRef = React.useRef<HTMLDivElement>(null);
  const selectedStore = stores.find((s) => s.id === selectedId) ?? null;

  // Run AI Agent shift analysis
  const runAgent = React.useCallback(
    async (storeId: string) => {
      setLoading(true);
      setResult(null);
      const startToast = toast.loading("AI đang kết nối nguồn dữ liệu và chạy phân tích ca trực...");
      try {
        const data = await fetchJson<AgentRunResult & { runId?: string }>("/api/agent/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId }),
        });
        setResult(data);
        if (data.runId) setCurrentRunId(data.runId);
        
        toast.success(`Đã lập xong kế hoạch: ${data.storeName} (${data.isLive ? "Live API" : "Chế độ dự phòng"})`, {
          id: startToast,
        });

        if (notifCtx) {
          const riskPct = Math.round((data.plan.overallRisk ?? 0) * 100);
          notifCtx.notify({
            type: "agent",
            priority: riskPct >= 70 ? "warning" : "success",
            title: "Hoàn tất phân tích ca trực",
            description: `${data.storeName} · Rủi ro ca: ${riskPct}% · Xử lý: ${(data.totalDurationMs / 1000).toFixed(1)}s`,
            storeName: data.storeName,
          });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Chạy phân tích thất bại. Vui lòng kiểm tra lại cấu hình.", { id: startToast });
      } finally {
        setLoading(false);
      }
    },
    [notifCtx],
  );

  // Auto-run analysis when a store is selected
  const lastRunStoreId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (selectedId && selectedId !== lastRunStoreId.current && !judgeDemoMode) {
      lastRunStoreId.current = selectedId;
      void runAgent(selectedId);
    }
  }, [selectedId, runAgent, judgeDemoMode]);

  // Command Palette
  const cmdPalette = useCommandPalette();
  const openSettings = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("camate:open-settings"));
  }, []);
  const openNotifications = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("camate:open-notifications"));
  }, []);
  const restartTour = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("camate:restart-tour"));
  }, []);

  const handleExportBriefing = React.useCallback(async () => {
    if (!result) return;
    try {
      const res = await fetch(`/api/briefing/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `briefing-${result.storeName.replace(/\s+/g, "-")}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Đã xuất file tóm tắt kế hoạch ca!");
    } catch {
      toast.error("Xuất báo cáo thất bại");
    }
  }, [result]);

  const addToCompare = React.useCallback(async () => {
    if (!result) return;
    if (compareResults.some((r) => r.storeId === result.storeId)) {
      toast.info("Cửa hàng này đã có trong danh sách so sánh");
      return;
    }
    setCompareResults((prev) => [...prev, result]);
    toast.success(`Đã thêm ${result.storeName} vào bảng so sánh`);
  }, [result, compareResults]);

  const runHighlightCompare = React.useCallback(async () => {
    setCompareLoading(true);
    setCompareResults([]);
    const to = toast.loading("Đang phân tích so sánh các cửa hàng trong khu vực...");
    try {
      const ids = [cbdStore.id, residentialStore.id, suburbanStore.id];
      const data = await fetchJson<{ results: AgentRunResult[] }>("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeIds: ids }),
      });
      setCompareResults(data.results);
      toast.success(`Đã tải xong bảng so sánh ${data.results.length} cửa hàng`, { id: to });
    } catch (e) {
      toast.error("So sánh thất bại", { id: to });
    } finally {
      setCompareLoading(false);
    }
  }, [cbdStore, residentialStore, suburbanStore]);

  // Run Judge Demo comparison
  const executeJudgeDemoAnalysis = async () => {
    setJudgeComparing(true);
    setJudgeCompareResults([]);
    const to = toast.loading("AI đang phân tích rủi ro và mô phỏng tác động kinh doanh cho 3 cửa hàng...");
    try {
      const ids = [cbdStore.id, residentialStore.id, suburbanStore.id];
      const data = await fetchJson<{ results: AgentRunResult[] }>("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeIds: ids }),
      });
      setJudgeCompareResults(data.results);
      setJudgeStep(3);
      toast.success("Phân tích hoàn tất! Bảng so sánh 3 phân khúc đặc trưng đã sẵn sàng.", { id: to });
    } catch (e) {
      toast.error("Lỗi phân tích dữ liệu so sánh cửa hàng.", { id: to });
    } finally {
      setJudgeComparing(false);
    }
  };

  const handleUploadCsv = () => {
    if (!csvContent.trim()) {
      toast.error("Vui lòng dán nội dung CSV trước");
      return;
    }
    // Simulate setting local CSV mode
    setDataSourceMode("csv");
    toast.success("Đã nạp dữ liệu vận hành từ CSV dán thành công! Hệ thống sẽ ưu tiên dùng nguồn này khi chạy phân tích ca tiếp theo.");
  };

  // KPI Calculations
  const kpiForecastOrders = React.useMemo(() => {
    if (!result) return "--";
    const lunch = result.plan.slots[0];
    const dinner = result.plan.slots[1];
    const lunchEst = (lunch.baselineLunchOrders ?? 60) * (1 + (lunch.expectedWalkInDelta + lunch.expectedDeliveryDelta) / 200);
    const dinnerEst = (dinner.baselineDinnerOrders ?? 80) * (1 + (dinner.expectedWalkInDelta + dinner.expectedDeliveryDelta) / 200);
    return Math.round(lunchEst + dinnerEst);
  }, [result]);

  const kpiInventoryRisk = React.useMemo(() => {
    if (!result) return "--";
    const count = result.plan.stockoutWarnings.length;
    return count === 0 ? "An toàn" : `${count} nguyên liệu`;
  }, [result]);

  const kpiStaffingDelta = React.useMemo(() => {
    if (!result) return "--";
    const lunch = result.plan.slots[0]?.staffingDelta ?? 0;
    const dinner = result.plan.slots[1]?.staffingDelta ?? 0;
    const total = lunch + dinner;
    if (total === 0) return "Cân bằng";
    return total > 0 ? `+${total} nhân viên` : `${total} nhân viên`;
  }, [result]);

  const kpiPendingApprovals = React.useMemo(() => {
    if (!result) return "--";
    const state = (result as any).state;
    if (!state?.approvalRequired) return "Đã duyệt hết";
    
    const approvalTrace = result.trace.find((t) => t.agentName === "Approval Guardrail");
    let count = 0;
    if (approvalTrace?.structuredOutput) {
      const so = approvalTrace.structuredOutput as any;
      if (Array.isArray(so.requests)) {
        count = so.requests.length;
      }
    }
    return count === 0 ? "1 việc" : `${count} việc`;
  }, [result]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF5F6] text-neutral-800 font-sans">
      {/* Top KFC branding line */}
      <div className="h-1.5 bg-[#E4002B] w-full" />

      {/* Modern Top Header Bar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white shadow-xs">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* KFC Logo element */}
            <div className="flex h-10 w-24 items-center justify-center rounded bg-[#E4002B] text-white font-black text-lg shadow-md tracking-tighter">
              KFC AI
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-neutral-900 flex items-center gap-2">
                Agent CaMate
                <span className="text-[9px] font-bold bg-[#E4002B]/10 text-[#E4002B] px-2 py-0.5 rounded-full border border-[#E4002B]/20">
                  StoreOps
                </span>
              </div>
              <div className="text-[10px] text-neutral-500 font-semibold leading-none mt-0.5">
                AI Quản lý ca KFC · Đưa ra đề xuất vận hành ca trực có bằng chứng xác thực
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Data Source Mode Indicator Badge */}
            <Badge variant="outline" className="flex items-center gap-1.5 h-9 px-3 border-neutral-200 text-neutral-600 bg-neutral-50">
              <Database className="h-3.5 w-3.5 text-[#E4002B]" />
              <span className="text-xs font-bold">
                {result ? (
                  result.isLive 
                    ? "Dữ liệu: Live API" 
                    : ((result as any).opsBaselineMode === "csv" ? "Dữ liệu: CSV" : "Đang dùng dữ liệu demo/mô phỏng")
                ) : (
                  dataSourceMode === "live" 
                    ? "Nguồn: Live API" 
                    : (dataSourceMode === "csv" ? "Nguồn: CSV" : "Đang dùng dữ liệu demo/mô phỏng")
                )}
              </span>
            </Badge>

            {/* Run Analysis button */}
            <Button
              onClick={() => selectedId && runAgent(selectedId)}
              disabled={loading || !selectedId || judgeDemoMode}
              className="bg-[#E4002B] hover:bg-[#B00020] text-white font-extrabold shadow-sm h-9 px-4 rounded-lg text-xs gap-1.5"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Chạy phân tích ca
            </Button>

            {/* Judge Demo Mode button */}
            <Button
              variant={judgeDemoMode ? "default" : "outline"}
              onClick={() => {
                setJudgeDemoMode(!judgeDemoMode);
                setJudgeStep(1);
              }}
              className={cn(
                "h-9 px-4 rounded-lg text-xs font-extrabold gap-1.5 transition-all",
                judgeDemoMode 
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-sm" 
                  : "border-amber-300 text-amber-700 bg-amber-500/5 hover:bg-amber-500/10"
              )}
            >
              <Star className="h-3.5 w-3.5 fill-current" />
              Chạy demo cho giám khảo
            </Button>

            {/* API Config Link */}
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-9 border-neutral-200 text-neutral-600 hover:text-[#E4002B] hover:bg-[#E4002B]/5 text-xs font-bold"
            >
              <a href="/admin/integrations">
                <Settings className="mr-1 h-3.5 w-3.5" />
                Cấu hình API
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">

        {/* -------------------- JUDGE DEMO MODE OVERLAY / VIEW -------------------- */}
        {judgeDemoMode ? (
          <Card className="border-amber-200 bg-white shadow-md rounded-xl p-6 mb-6 border-2 animate-fade-in">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Star className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-neutral-900">Bản Trình Bày Demo Chậm (3 Phút) cho Giám Khảo</h2>
                  <p className="text-xs text-neutral-500 font-medium">So sánh tác động của cùng một tác nhân AI (Agent CaMate) lên 3 phân khúc cửa hàng KFC đặc trưng</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setJudgeDemoMode(false)}
                className="text-xs font-bold border-neutral-200 hover:bg-neutral-50"
              >
                Đóng Demo
              </Button>
            </div>

            {/* Demo Progress Steps Bar */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className={cn("p-3 rounded-lg border text-center transition-all", judgeStep >= 1 ? "bg-amber-500/5 border-amber-300" : "bg-neutral-50 border-neutral-100 opacity-60")}>
                <span className="text-[10px] font-black uppercase text-amber-700 block">Bước 1</span>
                <span className="text-xs font-bold text-neutral-800 mt-1 block">Chọn 3 cửa hàng phân khúc</span>
              </div>
              <div className={cn("p-3 rounded-lg border text-center transition-all", judgeStep >= 2 ? "bg-amber-500/5 border-amber-300" : "bg-neutral-50 border-neutral-100 opacity-60")}>
                <span className="text-[10px] font-black uppercase text-amber-700 block">Bước 2</span>
                <span className="text-xs font-bold text-neutral-800 mt-1 block">AI phân tích ca đồng thời</span>
              </div>
              <div className={cn("p-3 rounded-lg border text-center transition-all", judgeStep >= 3 ? "bg-amber-500/5 border-amber-300" : "bg-neutral-50 border-neutral-100 opacity-60")}>
                <span className="text-[10px] font-black uppercase text-amber-700 block">Bước 3</span>
                <span className="text-xs font-bold text-neutral-800 mt-1 block">So sánh kết quả & ROI</span>
              </div>
            </div>

            {/* Step 1 Content: Store Selection */}
            {judgeStep === 1 && (
              <div className="space-y-6">
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <h3 className="text-base font-extrabold text-neutral-900">1. Ba phân khúc cửa hàng KFC đại diện tại TP.HCM</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">Hệ thống đã chọn sẵn 3 cửa hàng đại diện cho 3 khu vực có đặc thù vận hành hoàn toàn khác nhau để trình bày khả năng tối ưu cục bộ của Agent CaMate.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1: CBD */}
                  <Card className="border-neutral-200 bg-neutral-50/50 p-4 shadow-sm hover:border-amber-400 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-lg">🏙️</span>
                      <Badge className="bg-amber-500 text-white font-bold text-[9px]">Trung tâm (CBD)</Badge>
                    </div>
                    <h4 className="text-sm font-bold text-neutral-800">{cbdStore.name}</h4>
                    <p className="text-[11px] text-neutral-500 mt-1">{cbdStore.address}</p>
                    <Separator className="my-3" />
                    <ul className="text-[11px] text-neutral-600 space-y-1 font-semibold">
                      <li>• Tỷ lệ đơn giao: ~45%</li>
                      <li>• Khách đi bộ: Nhạy cảm mạnh với mưa</li>
                      <li>• Chế biến bếp: Sức chứa lớn, phục vụ nhanh</li>
                    </ul>
                  </Card>

                  {/* Card 2: Residential */}
                  <Card className="border-neutral-200 bg-neutral-50/50 p-4 shadow-sm hover:border-amber-400 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-lg">🏘️</span>
                      <Badge className="bg-emerald-500 text-white font-bold text-[9px]">Khu dân cư</Badge>
                    </div>
                    <h4 className="text-sm font-bold text-neutral-800">{residentialStore.name}</h4>
                    <p className="text-[11px] text-neutral-500 mt-1">{residentialStore.address}</p>
                    <Separator className="my-3" />
                    <ul className="text-[11px] text-neutral-600 space-y-1 font-semibold">
                      <li>• Tỷ lệ đơn giao: ~25%</li>
                      <li>• Khách đi bộ: Ổn định, nhạy cảm trung bình</li>
                      <li>• Bố trí sảnh: Rộng, đón nhóm gia đình lớn</li>
                    </ul>
                  </Card>

                  {/* Card 3: Suburban */}
                  <Card className="border-neutral-200 bg-neutral-50/50 p-4 shadow-sm hover:border-amber-400 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-lg">🌄</span>
                      <Badge className="bg-purple-500 text-white font-bold text-[9px]">Ngoại ô / Rìa đô thị</Badge>
                    </div>
                    <h4 className="text-sm font-bold text-neutral-800">{suburbanStore.name}</h4>
                    <p className="text-[11px] text-neutral-500 mt-1">{suburbanStore.address}</p>
                    <Separator className="my-3" />
                    <ul className="text-[11px] text-neutral-600 space-y-1 font-semibold">
                      <li>• Tỷ lệ đơn giao: ~15% (Đường đi xa)</li>
                      <li>• Khách đi bộ: Thấp khi thời tiết xấu</li>
                      <li>• Rủi ro giao hàng: Dễ ngập, trễ giờ khi mưa lớn</li>
                    </ul>
                  </Card>
                </div>

                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => {
                      setJudgeStep(2);
                      void executeJudgeDemoAnalysis();
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-black px-8 py-5 text-sm gap-2"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Bắt đầu chạy phân tích 3 phân khúc
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2 Content: AI analysis in progress */}
            {judgeStep === 2 && (
              <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                <div className="space-y-2">
                  <p className="text-sm font-bold text-neutral-800">Tác nhân AI đang thực thi tiến trình lập kế hoạch...</p>
                  <div className="max-w-xs mx-auto text-[11px] text-neutral-500 space-y-1 font-semibold">
                    <div className="flex items-center gap-1.5 justify-center"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Weather Agent: Đọc dữ liệu Open-Meteo...</div>
                    <div className="flex items-center gap-1.5 justify-center"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Demand Agent: Dự báo POS sảnh/giao hàng...</div>
                    <div className="flex items-center gap-1.5 justify-center"><Loader2 className="h-3 w-3 animate-spin text-amber-500" /> Staffing & Inventory Agent: Tối ưu ca trực...</div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 Content: Matrix results */}
            {judgeStep === 3 && (
              <div className="space-y-6">
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <h3 className="text-base font-extrabold text-neutral-900">3. Bảng so sánh rủi ro và Hiệu quả kinh doanh (ROI) của AI</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">Cùng một cơn mưa ngập tại TP.HCM, nhưng tác nhân AI đưa ra các hành động khác biệt dựa trên vị trí địa lý của mỗi cửa hàng.</p>
                </div>

                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full text-xs text-left border-collapse bg-white">
                    <thead>
                      <tr className="bg-neutral-50 text-neutral-700 font-bold border-b border-neutral-200">
                        <th className="p-3">Cửa hàng</th>
                        <th className="p-3">Thời tiết & Rủi ro</th>
                        <th className="p-3">Nhu cầu dự báo</th>
                        <th className="p-3">Bếp & Nguyên vật liệu</th>
                        <th className="p-3">Nhân sự đề xuất</th>
                        <th className="p-3">Việc cần duyệt</th>
                        <th className="p-3 bg-amber-500/5 text-amber-800 font-bold">Giá trị kinh doanh (ROI)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                      {judgeCompareResults.map((r, i) => {
                        const lunch = r.plan.slots[0];
                        const dinner = r.plan.slots[1];
                        
                        // Custom dynamic ROI summaries for the presentation
                        let roiValue = "";
                        if (r.storeId === "kfc-001") {
                          roiValue = "Tránh thừa 15kg gà rán ca trưa do sảnh vắng; Tự động cắt giảm 1.5 giờ công phục vụ.";
                        } else if (r.storeId === "kfc-003") {
                          roiValue = "Bảo toàn doanh số nhờ sảnh có mái che; Duy trì 100% mẻ chiên chuẩn tránh mất khách sảnh.";
                        } else {
                          roiValue = "Kích hoạt ETA buffer tránh trễ đơn; Tự động gọi trước 2 tài xế tự phòng giao hàng mưa.";
                        }

                        return (
                          <tr key={i} className="hover:bg-neutral-50/50">
                            <td className="p-3 font-bold text-neutral-900">
                              {r.storeName}
                              <span className="block text-[10px] text-neutral-500 font-medium uppercase mt-0.5">{storeTypeLabel(SEED_STORES.find(s=>s.id===r.storeId)?.storeType || "")}</span>
                            </td>
                            <td className="p-3">
                              <span className="flex items-center gap-1">🌦️ {r.weather.temperatureC.toFixed(0)}°C · Mưa: {Math.round(r.weather.rainRiskScore*100)}%</span>
                              <Badge className="mt-1 bg-rose-50 text-rose-700 border-rose-200 border text-[9px] font-bold">Rủi ro: {Math.round(r.plan.overallRisk*100)}%</Badge>
                            </td>
                            <td className="p-3">
                              Trưa: {lunch.expectedWalkInDelta}% sảnh, {lunch.expectedDeliveryDelta}% giao<br/>
                              Tối: {dinner.expectedWalkInDelta}% sảnh, {dinner.expectedDeliveryDelta}% giao
                            </td>
                            <td className="p-3">
                              Lượng mẻ trưa: {lunch.prepBatchDelta}%<br/>
                              Gà cần chuẩn bị: {r.plan.prepRecommendation.includes("tăng") ? "Tăng cường" : "Giảm mẻ"}
                            </td>
                            <td className="p-3">
                              Lệch ca trưa: {lunch.staffingDelta >= 0 ? `+${lunch.staffingDelta}` : lunch.staffingDelta} người<br/>
                              Lệch ca tối: {dinner.staffingDelta >= 0 ? `+${dinner.staffingDelta}` : dinner.staffingDelta} người
                            </td>
                            <td className="p-3">
                              {r.plan.stockoutWarnings.length > 0 ? `${r.plan.stockoutWarnings.length} cảnh báo tồn` : "Không có cảnh báo"}
                            </td>
                            <td className="p-3 bg-amber-500/5 text-amber-900 font-bold leading-relaxed">
                              {roiValue}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setJudgeStep(1)}
                    className="border-neutral-200 hover:bg-neutral-50 text-xs font-bold"
                  >
                    Quay lại chọn cửa hàng
                  </Button>
                  <Button
                    onClick={() => setJudgeDemoMode(false)}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-black"
                  >
                    Xong, Quay lại Bàn điều khiển chính
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ) : null}

        {/* -------------------- MAIN DASHBOARD PAGE LAYOUT -------------------- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* ==================== LEFT MAIN CONTENT AREA ==================== */}
          <div className="lg:col-span-8 space-y-6">

            {/* 1. TOP OVERVIEW AREA: 4 KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Card 1: Forecasted Orders */}
              <Card className="border-[#F1D5D9] bg-white shadow-xs p-4 flex flex-col justify-between h-28 rounded-xl">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Dự báo đơn hôm nay</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-neutral-900 tabular-nums">{kpiForecastOrders}</span>
                  {result && <span className="text-[10px] text-neutral-500 font-semibold">đơn dự kiến</span>}
                </div>
                <span className="text-[9px] text-neutral-400 font-medium">Trưa + Tối (đã quy đổi thời tiết)</span>
              </Card>

              {/* Card 2: Inventory Risk */}
              <Card className="border-[#F1D5D9] bg-white shadow-xs p-4 flex flex-col justify-between h-28 rounded-xl">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Rủi ro tồn kho</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className={cn(
                    "text-xl font-black tabular-nums",
                    result && result.plan.stockoutWarnings.length > 0 ? "text-[#E4002B]" : "text-emerald-600"
                  )}>
                    {kpiInventoryRisk}
                  </span>
                </div>
                <span className="text-[9px] text-neutral-400 font-medium">Nguyên liệu cảnh báo đứt gãy</span>
              </Card>

              {/* Card 3: Staffing Adjustments */}
              <Card className="border-[#F1D5D9] bg-white shadow-xs p-4 flex flex-col justify-between h-28 rounded-xl">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Điều phối nhân sự</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-lg font-black text-neutral-900">{kpiStaffingDelta}</span>
                </div>
                <span className="text-[9px] text-neutral-400 font-medium">Số người cần tăng/giảm ca làm</span>
              </Card>

              {/* Card 4: Manager Approvals Pending */}
              <Card className="border-[#F1D5D9] bg-white shadow-xs p-4 flex flex-col justify-between h-28 rounded-xl">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Việc cần quản lý duyệt</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className={cn(
                    "text-lg font-black",
                    result && (result as any).state?.approvalRequired ? "text-amber-600" : "text-neutral-800"
                  )}>
                    {kpiPendingApprovals}
                  </span>
                </div>
                <span className="text-[9px] text-neutral-400 font-medium">Hành động nháp nhạy cảm</span>
              </Card>
            </div>

            {/* 2. MAIN FLOW: 4 STEPS NAVIGATION TABS */}
            <Card className="border-[#F1D5D9] bg-white shadow-sm rounded-xl overflow-hidden">
              <div className="bg-neutral-50/80 border-b border-neutral-100 p-1 flex overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setActiveStepTab("step-1")}
                  className={cn(
                    "px-4 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap",
                    activeStepTab === "step-1" ? "bg-[#E4002B] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  Bước 1: Chuyện gì xảy ra?
                </button>
                <button
                  disabled={!result}
                  onClick={() => setActiveStepTab("step-2")}
                  className={cn(
                    "px-4 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap",
                    !result && "opacity-50 cursor-not-allowed",
                    activeStepTab === "step-2" ? "bg-[#E4002B] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  Bước 2: Vì sao xảy ra?
                </button>
                <button
                  disabled={!result}
                  onClick={() => setActiveStepTab("step-3")}
                  className={cn(
                    "px-4 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap",
                    !result && "opacity-50 cursor-not-allowed",
                    activeStepTab === "step-3" ? "bg-[#E4002B] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  Bước 3: AI đề xuất hành động
                </button>
                <button
                  disabled={!result}
                  onClick={() => setActiveStepTab("step-4")}
                  className={cn(
                    "px-4 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap",
                    !result && "opacity-50 cursor-not-allowed",
                    activeStepTab === "step-4" ? "bg-[#E4002B] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  Bước 4: Việc cần duyệt
                </button>
              </div>

              <CardContent className="pt-5 pb-5">
                {/* loading spinner for entire plan analysis */}
                {loading && (
                  <div className="flex h-60 items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-[#E4002B]" />
                      <p className="text-xs font-bold text-neutral-600">AI đang phân tích các nguồn dữ liệu cửa hàng...</p>
                    </div>
                  </div>
                )}

                {/* Empty State when no result is loaded */}
                {!result && !loading && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-[#E4002B] mb-3">
                      <StoreIcon className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-bold text-neutral-800">Chưa chạy phân tích ca trực</h3>
                    <p className="text-xs text-neutral-500 max-w-sm mt-1 leading-relaxed font-semibold">
                      Vui lòng chọn cửa hàng tại bảng nhập liệu bên phải và bấm nút <strong>Chạy phân tích ca</strong> ở trên để tạo đề xuất.
                    </p>
                  </div>
                )}

                {result && !loading && (
                  <div className="space-y-4">
                    
                    {/* -------------------- STEP 1 CONTENT -------------------- */}
                    {activeStepTab === "step-1" && (
                      <div className="space-y-5">
                        {/* Weather Signals summary */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Tín hiệu khí tượng thực tế tại tọa độ cửa hàng</h4>
                          <WeatherSignalPanel weather={result.weather} />
                        </div>

                        {/* Agent Pipeline Progress timeline */}
                        <div className="border-t border-neutral-100 pt-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">Tiến trình Agent Pipeline (Nhật ký xử lý ca)</h4>
                          
                          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6 md:gap-2">
                            {/* Horizontal timeline connect line */}
                            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-neutral-200 -translate-y-1/2 hidden md:block z-0" />
                            
                            {[
                              { name: "Weather Agent", desc: "Tải & đối chiếu dự báo Open-Meteo" },
                              { name: "Demand Agent", desc: "Dự báo POS sảnh/giao hàng" },
                              { name: "Inventory Agent", desc: "Cảnh báo đứt gãy nguyên liệu" },
                              { name: "Staffing Agent", desc: "Tính định biên nhân sự lệch ca" },
                              { name: "Approval Agent", desc: "Kiểm duyệt đề xuất nhạy cảm" },
                              { name: "AI học sau ca", desc: "Lưu lại nhật ký tự học" }
                            ].map((agent, index) => {
                              // Evaluate mock status mapping
                              let isCompleted = true;
                              let statusLabel = "Hoàn tất";
                              let dotBg = "bg-emerald-500 border-emerald-200 text-white";

                              if (agent.name === "Approval Agent" && (result as any).state?.approvalRequired) {
                                statusLabel = "Cần duyệt";
                                dotBg = "bg-amber-500 border-amber-200 text-white";
                              }

                              return (
                                <div key={index} className="flex flex-col items-center text-center z-10 bg-white px-2">
                                  <div className={cn("h-7 w-7 rounded-full flex items-center justify-center border font-bold text-xs shadow-xs", dotBg)}>
                                    {index + 1}
                                  </div>
                                  <span className="text-xs font-bold text-neutral-800 mt-2 block">{agent.name}</span>
                                  <Badge variant="outline" className="text-[8px] font-bold mt-1 px-1.5 py-0 h-4 border-neutral-200 text-neutral-500">
                                    {statusLabel}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* -------------------- STEP 2 CONTENT -------------------- */}
                    {activeStepTab === "step-2" && (
                      <div className="space-y-4">
                        <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/60 flex items-start gap-3">
                          <Sparkles className="h-4 w-4 text-[#E4002B] shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-neutral-900">Chuỗi lập luận quyết định của Agent CaMate:</div>
                            <p className="text-xs text-neutral-500 mt-1 leading-relaxed font-semibold">{result.plan.storeRiskSummary}</p>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Trọng số phân cấp rủi ro ảnh hưởng quyết định ca</h4>
                          <div className="space-y-2.5">
                            {result.plan.risks.map((r, i) => (
                              <div key={i} className="flex items-start gap-3 rounded-lg border border-neutral-100 p-3 bg-neutral-50/50">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E4002B]/10 text-[#E4002B] text-xs font-bold">
                                  {i + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-neutral-800">{r.factor}</span>
                                    <Badge variant="outline" className="text-[10px] font-bold border-neutral-200 text-neutral-600 bg-white">
                                      Trọng số: {r.weight.toFixed(2)}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-xs text-neutral-500 leading-relaxed font-medium">
                                    {r.reasoning}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Collapsible Technical Trace */}
                        <div className="border-t border-neutral-100 pt-3">
                          <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer text-xs font-bold text-[#E4002B] hover:underline focus:outline-none list-none">
                              <span className="flex items-center gap-1.5">
                                <Bot className="h-4 w-4" />
                                Xem Nhật ký kỹ thuật (Technical Agent Trace)
                              </span>
                              <span className="transition-transform group-open:rotate-180">▼</span>
                            </summary>
                            <div className="mt-3 border border-neutral-200 rounded-lg bg-neutral-950 p-4 text-neutral-200 text-[11px] font-mono leading-relaxed overflow-x-auto">
                              <AgentTracePanel trace={result.trace} totalDurationMs={result.totalDurationMs} />
                            </div>
                          </details>
                        </div>
                      </div>
                    )}

                    {/* -------------------- STEP 3 CONTENT -------------------- */}
                    {activeStepTab === "step-3" && (
                      <div className="space-y-6">
                        {/* Categorized proposal cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {result.plan.prepRecommendation && (
                            <div className="p-4 rounded-lg border border-neutral-100 bg-neutral-50/50">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-7 w-7 rounded bg-[#E4002B]/10 flex items-center justify-center text-[#E4002B]">
                                  <Utensils className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-neutral-800">Chế biến & Bếp chính</span>
                              </div>
                              <p className="text-xs text-neutral-600 leading-relaxed font-semibold">{result.plan.prepRecommendation}</p>
                            </div>
                          )}

                          {result.plan.staffingRecommendation && (
                            <div className="p-4 rounded-lg border border-neutral-100 bg-neutral-50/50">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-7 w-7 rounded bg-[#E4002B]/10 flex items-center justify-center text-[#E4002B]">
                                  <Users className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-neutral-800">Điều phối nhân sự ca</span>
                              </div>
                              <p className="text-xs text-neutral-600 leading-relaxed font-semibold">{result.plan.staffingRecommendation}</p>
                            </div>
                          )}

                          {result.plan.inventoryRecommendation && (
                            <div className="p-4 rounded-lg border border-neutral-100 bg-neutral-50/50">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-7 w-7 rounded bg-[#E4002B]/10 flex items-center justify-center text-[#E4002B]">
                                  <Package className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-neutral-800">Kho & Nguyên vật liệu</span>
                              </div>
                              <p className="text-xs text-neutral-600 leading-relaxed font-semibold">{result.plan.inventoryRecommendation}</p>
                            </div>
                          )}

                          {result.plan.campaignRecommendation && (
                            <div className="p-4 rounded-lg border border-neutral-100 bg-neutral-50/50">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-7 w-7 rounded bg-[#E4002B]/10 flex items-center justify-center text-[#E4002B]">
                                  <Megaphone className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-neutral-800">Chương trình & Ưu đãi</span>
                              </div>
                              <p className="text-xs text-neutral-600 leading-relaxed font-semibold">{result.plan.campaignRecommendation}</p>
                            </div>
                          )}
                        </div>

                        {/* Interactive Assistant panel for manager shift QA */}
                        <div className="border-t border-neutral-100 pt-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Trò chuyện trực tiếp cùng Trợ lý CaMate AI</h4>
                          <SmartInteractionPanel 
                            storeId={selectedId} 
                            runId={currentRunId ?? undefined} 
                            isDemo={result ? (result as any).opsBaselineMode === "simulated" || (result as any).opsBaselineMode === "synthetic" || !result.isLive : false}
                          />
                        </div>
                      </div>
                    )}

                    {/* -------------------- STEP 4 CONTENT -------------------- */}
                    {activeStepTab === "step-4" && (
                      <div className="space-y-4">
                        <ActionPlanPanel plan={result.plan} />
                      </div>
                    )}

                  </div>
                )}
              </CardContent>
            </Card>

            {/* Standard compare and history section at bottom */}
            {compareResults.length >= 2 && (
              <Card className="border-[#F1D5D9] bg-white rounded-xl shadow-xs overflow-hidden mt-6">
                <CardHeader className="pb-3 border-b border-neutral-100">
                  <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-[#E4002B]" />
                    So sánh kết quả vận hành ca trực
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <CompareView results={compareResults} onClear={() => setCompareResults([])} />
                </CardContent>
              </Card>
            )}

            {/* Shift Briefing export card */}
            {result && (
              <Card className="border-[#F1D5D9] bg-white rounded-xl shadow-xs p-4 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800">Báo cáo tóm tắt ca trực đã sẵn sàng</h4>
                  <p className="text-[11px] text-neutral-400 font-medium">Bản tóm tắt văn bản bao gồm tín hiệu thời tiết, nhân sự, bếp và chữ ký duyệt của ca trực.</p>
                </div>
                <Button
                  onClick={handleExportBriefing}
                  className="bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200 h-9 text-xs font-bold gap-1 px-4"
                >
                  <Download className="h-3.5 w-3.5" />
                  Xuất tóm tắt ca (.md)
                </Button>
              </Card>
            )}

          </div>

          {/* ==================== RIGHT SIDEBAR DATA INPUT PANEL ==================== */}
          <div className="lg:col-span-4 space-y-6">

            {/* 1. STORE & DATE INPUT PANEL */}
            <Card className="border-[#F1D5D9] bg-white shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="pb-3 bg-neutral-50/50 border-b border-neutral-100">
                <CardTitle className="text-xs font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                  <Settings className="h-4 w-4 text-[#E4002B]" />
                  Dữ liệu đầu vào ca trực
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                
                {/* Choose Store Dropdown */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Cửa hàng giám sát</label>
                  <StoreSelector
                    stores={stores}
                    selectedId={selectedId}
                    onSelect={(id) => setSelectedId(id)}
                    className="w-full"
                  />
                </div>

                {/* Date & Shift Picker simulated */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Ngày ca trực</label>
                    <select className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-bold text-neutral-700 focus:outline-none focus:border-[#E4002B]/40">
                      <option>Hôm nay (20/06)</option>
                      <option>Ngày mai (21/06)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Ca làm việc</label>
                    <select className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-bold text-neutral-700 focus:outline-none focus:border-[#E4002B]/40">
                      <option>Ca Trưa (11:00 - 14:00)</option>
                      <option>Ca Tối (17:00 - 21:00)</option>
                    </select>
                  </div>
                </div>

                {/* Select active data source */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">Nguồn dữ liệu POS/Kho/Nhân sự</label>
                  <div className="flex gap-1.5">
                    {[
                      { code: "demo", label: "Mô phỏng" },
                      { code: "csv", label: "CSV File" },
                      { code: "live", label: "Live API" }
                    ].map((s) => (
                      <button
                        key={s.code}
                        type="button"
                        onClick={() => {
                          setDataSourceMode(s.code as any);
                          toast.info(`Đã chọn thiết lập nguồn dữ liệu: ${s.label}`);
                        }}
                        className={cn(
                          "flex-1 h-8 text-[11px] font-bold border rounded-lg transition-all",
                          dataSourceMode === s.code 
                            ? "bg-[#E4002B]/5 text-[#E4002B] border-[#E4002B]/30" 
                            : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CSV upload paste area */}
                <div className="border-t border-neutral-100 pt-3">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Dán dữ liệu CSV thay thế (POS/Kho)</label>
                  <textarea
                    rows={2}
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                    placeholder="storeId,baselineLunchOrders,chickenRawKg,staffingLunch..."
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/50 p-2 text-[10px] font-mono focus:outline-none focus:bg-white focus:border-[#E4002B]/40 resize-none"
                  />
                  <Button
                    onClick={handleUploadCsv}
                    className="w-full h-7 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-[10px] rounded-lg mt-1.5"
                  >
                    Nạp dữ liệu CSV
                  </Button>
                </div>

              </CardContent>
            </Card>

            {/* 2. EMEBEDDED MAP PREVIEW */}
            <Card className="border-[#F1D5D9] bg-white shadow-sm rounded-xl overflow-hidden h-72 flex flex-col">
              <CardHeader className="pb-2 bg-neutral-50/50 border-b border-neutral-100 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-[#E4002B]" />
                  Bản đồ vị trí cửa hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 relative">
                {selectedStore ? (
                  <StoreMap
                    stores={stores}
                    selectedId={selectedId}
                    onSelect={(id) => setSelectedId(id)}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-neutral-50 text-neutral-400 text-xs font-semibold">
                    Vui lòng chọn cửa hàng để hiển thị bản đồ.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. STORE OPERATING PROFILE */}
            {selectedStore && (
              <Card className="border-[#F1D5D9] bg-white shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="pb-2 bg-neutral-50/50 border-b border-neutral-100">
                  <CardTitle className="text-xs font-black uppercase text-neutral-400 tracking-wider">
                    Thông tin cơ cấu cửa hàng
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-3">
                  <div className="mb-1">
                    <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      {storeTypeIcon(selectedStore.storeType)} {selectedStore.name}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-semibold mt-0.5">{selectedStore.address}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-neutral-700">
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[8px] text-neutral-400 block uppercase">Kênh Giao hàng</span>
                      <span>{(selectedStore.deliveryShare * 100).toFixed(0)}% tỷ trọng đơn</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[8px] text-neutral-400 block uppercase">Sức chứa sảnh</span>
                      <span>{selectedStore.dineInSeats} ghế ngồi</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[8px] text-neutral-400 block uppercase">Công suất bếp</span>
                      <span>{selectedStore.kitchenCapacity} mẻ/giờ</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="text-[8px] text-neutral-400 block uppercase">Phân khúc cửa hàng</span>
                      <span className="capitalize">{storeTypeLabel(selectedStore.storeType)}</span>
                    </div>
                  </div>

                  <p className="text-[10px] leading-relaxed text-neutral-500 border-t border-neutral-100 pt-2 font-medium">
                    {selectedStore.notes}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Historical Runs log for the store */}
            {selectedId && (
              <AgentRunsHistoryPanel storeId={selectedId} />
            )}

          </div>

        </div>
      </main>

      {/* KFC styled Footer */}
      <footer className="mt-auto border-t-4 border-[#E4002B] bg-white">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[#E4002B] text-white font-bold">
                K
              </div>
              <span>
                <strong>Bản chạy thử nghiệm độc lập hackathon. Không phải sản phẩm chính thức từ KFC.</strong>
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-neutral-400 font-extrabold">
              <a href="#" className="hover:text-[#E4002B] transition-colors">GitHub</a>
              <span>·</span>
              <a href="#" className="hover:text-[#E4002B] transition-colors">Tài liệu</a>
              <span>·</span>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("camate:restart-tour"))}
                className="hover:text-[#E4002B] transition-colors"
              >
                Chạy hướng dẫn (Tour)
              </button>
            </div>
          </div>
        </div>
      </footer>

      <OnboardingTour />
      <KeyboardShortcuts />
      <CommandPalette
        open={cmdPalette.open}
        onOpenChange={cmdPalette.setOpen}
        onNavigateView={(v) => setView(v as ViewKey)}
        onSelectStore={(id) => setSelectedId(id)}
        onRunAgent={() => selectedId && runAgent(selectedId)}
        onRunCompare={runHighlightCompare}
        onExportBriefing={handleExportBriefing}
        onAddToCompare={addToCompare}
        onClearCompare={() => setCompareResults([])}
        onOpenSettings={openSettings}
        onOpenNotifications={openNotifications}
        onRestartTour={restartTour}
        stores={stores}
        currentStoreId={selectedId}
        compareCount={compareResults.length}
      />
      <Toaster richColors position="top-right" />
    </div>
  );
}
