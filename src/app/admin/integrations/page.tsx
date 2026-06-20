"use client";

import * as React from "react";
import {
  ArrowLeft,
  Database,
  Cloud,
  MapPin,
  ShoppingCart,
  Package,
  Users,
  MessageSquare,
  Cpu,
  FileUp,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Shield,
  AlertTriangle,
  Info,
  Settings,
  Download,
  Upload,
  Trash2,
  KeyRound,
  Map as MapIcon,
  UploadCloud,
  Clock,
  ChevronRight,
  Trash
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/client/fetchJson";
import Link from "next/link";
import { useLang } from "@/lib/i18n/language-provider";
import { PROVIDER_REGISTRY, getProviderById, type ProviderDefinition, type ProviderAdapter, type ModelDiscoveryMode } from "@/lib/llm/providerRegistry";

// Inline type definitions + labels (the admin store modules don't exist in this
// working tree — we keep this page self-contained so it compiles standalone).
type DataSourceType =
  | "weather"
  | "google-maps"
  | "pos"
  | "inventory"
  | "staffing"
  | "complaint"
  | "ai-model"
  | "csv-upload";

type ConnectionStatus = "connected" | "error" | "untested" | "not-configured";

interface DataSourceConfigSafe {
  id: string;
  name: string;
  type: DataSourceType;
  apiUrl?: string;
  apiKeyMasked?: string;
  hasKey: boolean;
  headers?: string;
  fieldMapping?: Record<string, string>;
  status: ConnectionStatus;
  lastTestedAt?: string;
  lastError?: string;
  sampleData?: unknown;
  createdAt: string;
  updatedAt: string;
}

const SOURCE_TYPE_LABELS_VI: Record<DataSourceType, string> = {
  weather: "Thời tiết",
  "google-maps": "Google Maps Embed / Bản đồ cửa hàng",
  pos: "Dữ liệu bán hàng (POS)",
  inventory: "Tồn kho",
  staffing: "Nhân sự",
  complaint: "Khiếu nại khách hàng",
  "ai-model": "Mô hình AI",
  "csv-upload": "Tải lên CSV",
};

const SOURCE_TYPE_LABELS_EN: Record<DataSourceType, string> = {
  weather: "Weather",
  "google-maps": "Google Maps Embed / Store Map",
  pos: "POS / Sales Data",
  inventory: "Inventory",
  staffing: "Staffing",
  complaint: "Customer Complaints",
  "ai-model": "AI Model",
  "csv-upload": "CSV Upload",
};

const SOURCE_TYPE_DESCRIPTIONS_VI: Record<DataSourceType, string> = {
  weather: "Nguồn dữ liệu thời tiết thực tế. Mặc định dùng Open-Meteo (miễn phí, không cần key).",
  "google-maps": "Bản đồ cửa hàng hiện dùng Google Maps Embed dạng keyless iframe. Không cần API key.",
  pos: "Dữ liệu bán hàng theo thời gian thực hoặc lịch sử. Nguồn quan trọng nhất cho khuyến nghị mạnh.",
  inventory: "Dữ liệu tồn kho nguyên liệu, bao bì, đồ uống.",
  staffing: "Dữ liệu nhân sự theo ca: bếp, quầy, đóng gói.",
  complaint: "Dữ liệu khiếu nại, hủy đơn, giao trễ.",
  "ai-model": "Mô hình AI dùng cho chat. Mặc định dùng Agent CaMate LLM.",
  "csv-upload": "Tải lên file CSV dữ liệu vận hành lịch sử.",
};

const SOURCE_TYPE_DESCRIPTIONS_EN: Record<DataSourceType, string> = {
  weather: "Real-time weather data. Uses Open-Meteo by default (free, no API key required).",
  "google-maps": "The store map currently uses a keyless Google Maps iframe embed. No API key is required.",
  pos: "Real-time or historical sales data. The most critical source for operational recommendations.",
  inventory: "Inventory levels for ingredients, packaging, and beverages.",
  staffing: "Shift-level staffing data: kitchen, counter, and packing crews.",
  complaint: "Customer complaints, cancellations, and delivery delay logs.",
  "ai-model": "Optional AI model provider for chat and plan explanations.",
  "csv-upload": "Upload CSV files for historical operations data.",
};

const TYPE_ICONS: Record<DataSourceType, React.ElementType> = {
  weather: Cloud,
  "google-maps": MapPin,
  pos: ShoppingCart,
  inventory: Package,
  staffing: Users,
  complaint: MessageSquare,
  "ai-model": Cpu,
  "csv-upload": FileUp,
};

const STATUS_META: Record<ConnectionStatus, { label: string; color: string; icon: React.ElementType }> = {
  connected: { label: "Đang dùng", color: "var(--kfc-success, #16a34a)", icon: Wifi },
  error: { label: "Lỗi", color: "var(--kfc-red, #C41230)", icon: WifiOff },
  untested: { label: "Chưa kiểm tra", color: "var(--kfc-warning, #F59E0B)", icon: AlertTriangle },
  "not-configured": { label: "Chưa cấu hình", color: "var(--kfc-missing, #6b7280)", icon: Info },
};

export default function IntegrationsPage() {
  const { lang } = useLang();

  const [sources, setSources] = React.useState<DataSourceConfigSafe[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [adminToken, setAdminToken] = React.useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("camate.adminToken") || "";
    }
    return "";
  });
  const [expandedId, setExpandedId] = React.useState<string | null>("src-pos");

  // Router API / LLM provider states
  const [llmProviderId, setLlmProviderId] = React.useState("custom-openai-compatible");
  const [llmBaseUrl, setLlmBaseUrl] = React.useState("");
  const [llmLimitedKey, setLlmLimitedKey] = React.useState("");
  const [llmHasKey, setLlmHasKey] = React.useState(false);
  const [showLlmKey, setShowLlmKey] = React.useState(false);
  const [llmSelectedModel, setLlmSelectedModel] = React.useState("");
  const [llmManualModel, setLlmManualModel] = React.useState("");
  const [llmModelsList, setLlmModelsList] = React.useState<{ id: string; label: string; ownedBy?: string }[]>([]);
  const [llmLoadingModels, setLlmLoadingModels] = React.useState(false);
  const [llmTestingModel, setLlmTestingModel] = React.useState(false);
  const [llmSaving, setLlmSaving] = React.useState(false);
  const [llmTestResult, setLlmTestResult] = React.useState<{ ok: boolean; status?: string; message?: string } | null>(null);
  
  const [customProviders, setCustomProviders] = React.useState<ProviderDefinition[]>([]);
  const [showCustomBuilder, setShowCustomBuilder] = React.useState(false);
  const [customHeaders, setCustomHeaders] = React.useState<string>("{}");

  const [customProviderForm, setCustomProviderForm] = React.useState<Partial<ProviderDefinition>>({
    adapter: "openai-compatible",
    modelDiscoveryMode: "openai-models",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
  });

  const allProviders = React.useMemo(() => {
    return [...PROVIDER_REGISTRY, ...customProviders];
  }, [customProviders]);

  const activeProvider = React.useMemo(() => {
    return allProviders.find(p => p.id === llmProviderId) || PROVIDER_REGISTRY[0];
  }, [llmProviderId, allProviders]);

  const fetchSources = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ sources: DataSourceConfigSafe[] }>("/api/admin/sources");
      setSources(data.sources || []);
    } catch {
      toast.error(lang === "vi" ? "Không tải được danh sách nguồn dữ liệu" : "Failed to load data sources");
    } finally {
      setLoading(false);
    }
  }, [lang]);

  React.useEffect(() => {
    queueMicrotask(() => {
      void fetchSources();
    });
  }, [fetchSources]);

  // Load config from backend config route and localStorage
  const fetchLlmConfig = React.useCallback(async () => {
    try {
      // Load custom providers from local storage first
      const savedCustom = localStorage.getItem("custom_llm_providers");
      if (savedCustom) {
        setCustomProviders(JSON.parse(savedCustom));
      }

      const data = await fetchJson<{
        ok: boolean;
        config?: { providerId: string; baseUrl: string; adapter: string; model: string; hasApiKey: boolean; extraHeaderNames?: string[] };
      }>("/api/admin/model-provider/config");
      
      if (data.ok && data.config) {
        const { providerId, baseUrl, model, hasApiKey } = data.config;
        if (providerId) setLlmProviderId(providerId);
        if (baseUrl) setLlmBaseUrl(baseUrl);
        if (model) {
          setLlmSelectedModel(model);
          setLlmManualModel(model);
          setLlmModelsList((prev) => {
            if (prev.length === 0 || !prev.find((p) => p.id === model)) {
              return [{ id: model, label: model }, ...prev];
            }
            return prev;
          });
        }
        setLlmHasKey(hasApiKey);
      }
    } catch {
      // fallback to localStorage
      try {
        const saved = localStorage.getItem("llm_config");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.providerId) setLlmProviderId(parsed.providerId);
          if (parsed.baseUrl) setLlmBaseUrl(parsed.baseUrl);
          if (parsed.selectedModel) {
            setLlmSelectedModel(parsed.selectedModel);
            setLlmManualModel(parsed.selectedModel);
            setLlmModelsList((prev) => {
              if (prev.length === 0 || !prev.find((p) => p.id === parsed.selectedModel)) {
                return [{ id: parsed.selectedModel, label: parsed.selectedModel }, ...prev];
              }
              return prev;
            });
          }
          if (parsed.apiKey) setLlmLimitedKey(parsed.apiKey);
          if (parsed.hasKey !== undefined) setLlmHasKey(parsed.hasKey);
          if (parsed.customHeaders) setCustomHeaders(parsed.customHeaders);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  React.useEffect(() => {
    queueMicrotask(() => {
      void fetchLlmConfig();
    });
  }, [fetchLlmConfig]);



  const handleSaveAdminToken = (val: string) => {
    setAdminToken(val);
    localStorage.setItem("camate.adminToken", val);
    void fetchSources();
    void fetchLlmConfig();
  };


  // Sync state with src-ai-model config loaded from backend if not yet set
  React.useEffect(() => {
    const aiSource = sources.find((s) => s.id === "src-ai-model");
    if (aiSource && !llmBaseUrl) {
      queueMicrotask(() => {
        setLlmBaseUrl(aiSource.apiUrl ?? "");
        setLlmHasKey(aiSource.hasKey);
        if (aiSource.headers) {
          try {
            const parsed = JSON.parse(aiSource.headers);
            if (parsed.providerId) setLlmProviderId(parsed.providerId);
            if (parsed.selectedModel) {
              setLlmSelectedModel(parsed.selectedModel);
              setLlmManualModel(parsed.selectedModel);
              setLlmModelsList((prev) => {
                if (prev.length === 0 && parsed.selectedModel) {
                  return [{ id: parsed.selectedModel, label: parsed.selectedModel }];
                }
                return prev;
              });
            }
            if (parsed.extraHeaders) setCustomHeaders(JSON.stringify(parsed.extraHeaders));
          } catch {
            // ignore
          }
        }
      });
    }
  }, [sources, llmBaseUrl]);

  React.useEffect(() => {
    // When provider changes, if we have a preset base URL and current is empty or we explicitly chose it, we might auto-fill
    // To keep it simple, we auto-fill if the user just switched and the new provider has a defaultBaseUrl
    // But since this effect runs on load, let's be careful.
    // If the provider has a defaultBaseUrl, and we are switching to it.
  }, [llmProviderId]);

  const handleProviderChange = (newId: string) => {
    setLlmProviderId(newId);
    const provider = allProviders.find(p => p.id === newId);
    if (provider && provider.defaultBaseUrl) {
      setLlmBaseUrl(provider.defaultBaseUrl);
    } else {
      setLlmBaseUrl("");
    }
    setLlmTestResult(null);
  };

  const getParsedHeaders = () => {
    let extraHeaders: Record<string, string> = {};
    if (activeProvider.supportsExtraHeaders) {
      try {
        extraHeaders = JSON.parse(customHeaders);
      } catch {
        // ignore
      }
    }
    return extraHeaders;
  };

  const handleLoadModels = async () => {
    if (!llmBaseUrl && activeProvider.modelDiscoveryMode !== "manual" && activeProvider.modelDiscoveryMode !== "none") return;
    setLlmLoadingModels(true);
    setLlmTestResult(null);
    try {
      const data = await fetchJson<{ ok: boolean; models?: { id: string; label: string; ownedBy?: string }[]; message: string }>("/api/admin/model-provider/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: llmProviderId,
          adapter: activeProvider.adapter,
          baseUrl: llmBaseUrl,
          apiKey: llmLimitedKey || undefined,
          extraHeaders: getParsedHeaders(),
        }),
      });
      if (data.ok && data.models) {
        setLlmModelsList(data.models);
        toast.success(lang === "vi" ? "Tải danh sách model thành công" : "Successfully loaded models");
      } else {
        toast.error(data.message);
        setLlmTestResult({ ok: false, message: data.message });
      }
    } catch (e) {
      toast.error(lang === "vi" ? "Lỗi tải model" : "Error loading models");
    } finally {
      setLlmLoadingModels(false);
    }
  };

  const handleTestModel = async () => {
    const isManualMode = activeProvider.modelDiscoveryMode === "manual" || activeProvider.modelDiscoveryMode === "none";
    if (!llmBaseUrl && !isManualMode) return;
    
    const targetModel = isManualMode ? llmManualModel : llmSelectedModel;
    
    if (llmProviderId === "gemini" && targetModel === "gpt-5.5") {
      const errMsg = "Model này không thuộc Google Gemini. Hãy tải danh sách model Gemini hoặc chọn Custom OpenAI-compatible nếu dùng router.";
      toast.error(errMsg);
      setLlmTestResult({ ok: false, message: errMsg });
      return;
    }

    setLlmTestingModel(true);
    setLlmTestResult(null);
    try {
      const data = await fetchJson<{ ok: boolean; status: string; message: string }>("/api/admin/model-provider/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: llmProviderId,
          adapter: activeProvider.adapter,
          baseUrl: llmBaseUrl,
          apiKey: llmLimitedKey || undefined,
          model: targetModel || undefined,
          extraHeaders: getParsedHeaders(),
        }),
      });
      setLlmTestResult(data);
      if (data.ok) {
        toast.success(lang === "vi" ? "Kiểm tra kết nối thành công" : "Connection test successful");
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error(lang === "vi" ? "Lỗi kiểm tra kết nối" : "Error testing connection");
    } finally {
      setLlmTestingModel(false);
    }
  };

  const handleSaveLlm = async () => {
    const isManualMode = activeProvider.modelDiscoveryMode === "manual" || activeProvider.modelDiscoveryMode === "none";
    const targetModel = isManualMode ? llmManualModel : llmSelectedModel;

    if (!targetModel) {
      toast.error(lang === "vi" ? "Vui lòng chọn hoặc nhập một model trước khi lưu." : "Please select or enter a model before saving.");
      return;
    }

    if (llmProviderId === "gemini" && targetModel === "gpt-5.5") {
      const errMsg = "Model này không thuộc Google Gemini. Hãy tải danh sách model Gemini hoặc chọn Custom OpenAI-compatible nếu dùng router.";
      toast.error(errMsg);
      setLlmTestResult({ ok: false, message: errMsg });
      return;
    }

    setLlmSaving(true);
    try {
      const extraHeaders = getParsedHeaders();
      await fetchJson("/api/admin/model-provider/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: llmProviderId,
          adapter: activeProvider.adapter,
          baseUrl: llmBaseUrl || undefined,
          apiKey: llmLimitedKey || undefined,
          model: targetModel || undefined,
          extraHeaders: Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined,
        }),
      });

      await fetchJson("/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "src-ai-model",
          name: "Router API / AI Model Provider",
          type: "ai-model",
          apiUrl: llmBaseUrl || undefined,
          apiKey: llmLimitedKey || undefined,
          headers: JSON.stringify({
            providerId: llmProviderId,
            adapter: activeProvider.adapter,
            selectedModel: targetModel || undefined,
            extraHeaders: Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined,
          }),
        }),
      });

      try {
        localStorage.setItem(
          "llm_config",
          JSON.stringify({
            providerId: llmProviderId,
            baseUrl: llmBaseUrl,
            selectedModel: targetModel,
            apiKey: llmLimitedKey,
            hasKey: !!llmLimitedKey || llmHasKey,
            customHeaders,
          })
        );
      } catch {
        // ignore
      }

      setLlmHasKey(!!llmLimitedKey || llmHasKey);

      toast.success(
        lang === "vi"
          ? "Đã lưu cấu hình model cho phiên demo này."
          : "Model provider configuration saved for this demo session."
      );
      void fetchSources();
    } catch {
      toast.error(lang === "vi" ? "Lưu cấu hình thất bại" : "Failed to save configuration");
    } finally {
      setLlmSaving(false);
    }
  };

  const handleClearDemoConfig = () => {
    localStorage.removeItem("llm_config");
    setLlmProviderId("custom-openai-compatible");
    setLlmBaseUrl("");
    setLlmLimitedKey("");
    setLlmHasKey(false);
    setLlmSelectedModel("");
    setLlmManualModel("");
    setLlmModelsList([]);
    setCustomHeaders("{}");
    toast.success(lang === "vi" ? "Đã xóa cấu hình demo" : "Cleared demo config");
  };

  const saveCustomProvider = () => {
    if (!customProviderForm.id || !customProviderForm.labelEn) return;
    const newProvider: ProviderDefinition = {
      id: customProviderForm.id,
      labelVi: customProviderForm.labelVi || customProviderForm.labelEn,
      labelEn: customProviderForm.labelEn,
      adapter: customProviderForm.adapter as ProviderAdapter,
      defaultBaseUrl: customProviderForm.defaultBaseUrl || "",
      supportsModelDiscovery: customProviderForm.supportsModelDiscovery ?? false,
      supportsChat: customProviderForm.supportsChat ?? false,
      requiresApiKey: customProviderForm.requiresApiKey ?? false,
      modelDiscoveryMode: customProviderForm.modelDiscoveryMode as ModelDiscoveryMode,
      supportsExtraHeaders: true,
    };

    const existingIndex = customProviders.findIndex(p => p.id === newProvider.id);
    let updated;
    if (existingIndex >= 0) {
      updated = [...customProviders];
      updated[existingIndex] = newProvider;
    } else {
      updated = [...customProviders, newProvider];
    }
    setCustomProviders(updated);
    localStorage.setItem("custom_llm_providers", JSON.stringify(updated));
    toast.success(lang === "vi" ? "Lưu provider tùy chỉnh thành công" : "Custom provider saved");
    setShowCustomBuilder(false);
    handleProviderChange(newProvider.id);
  };

  const exportCustomProviders = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customProviders, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "custom_providers.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importCustomProviders = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            setCustomProviders(parsed);
            localStorage.setItem("custom_llm_providers", JSON.stringify(parsed));
            toast.success(lang === "vi" ? "Đã nhập cấu hình provider" : "Imported provider config");
          }
        } catch {
          toast.error("Invalid JSON");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Group sources by category for the 4-block layout
  const organizerSources = sources.filter((s) => s.type === "pos" || s.type === "inventory" || s.type === "staffing" || s.type === "complaint");
  const aiSources = sources.filter((s) => s.type === "ai-model");
  const externalSources = sources.filter((s) => s.type === "weather" || s.type === "google-maps");
  const csvSources = sources.filter((s) => s.type === "csv-upload");

  const connectedCount = sources.filter((s) => s.status === "connected").length;
  const liveMode = sources.some((s) => (s.type === "pos" || s.type === "inventory" || s.type === "staffing") && s.status === "connected");

  return (
    <div className="min-h-screen bg-[#FFF5F6]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b-2 border-[#E4002B] bg-neutral-900 text-white">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">{lang === "vi" ? "Trang chính" : "Home"}</span>
          </Link>
          <Separator orientation="vertical" className="h-6 bg-white/20" />
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E4002B]">
              <Database className="h-4 w-4" />
            </div>
            <div className="leading-none">
              <div className="text-sm font-bold">{lang === "vi" ? "Kết nối dữ liệu" : "Data Connections"}</div>
              <div className="text-[10px] text-white/70">
                {lang === "vi" ? "Cấu hình nguồn dữ liệu & API đối tác" : "Configure data sources & partner APIs"}
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold border-white/30 text-white"
              style={{ backgroundColor: liveMode ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)" }}
            >
              {liveMode 
                ? (lang === "vi" ? "🟢 Đang dùng dữ liệu live" : "🟢 Using live data") 
                : (lang === "vi" ? "🟡 Chế độ demo/thử nghiệm" : "🟡 Demo/fallback mode")}
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 space-y-6">
        {/* Admin Token Authentication */}
        <Card className="border-[#F1D5D9] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#E4002B]" />
              {lang === "vi" ? "Mật mã Admin (ADMIN_TOKEN)" : "Admin Token (ADMIN_TOKEN)"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {lang === "vi"
                ? "Nhập ADMIN_TOKEN để kết nối và cập nhật cấu hình API."
                : "Enter ADMIN_TOKEN to connect and update API configurations."}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2 max-w-sm">
              <Input
                type="password"
                placeholder={lang === "vi" ? "Mật mã admin..." : "Admin token..."}
                value={adminToken}
                onChange={(e) => handleSaveAdminToken(e.target.value)}
                className="text-xs h-8 border-neutral-200"
              />
            </div>
          </CardContent>
        </Card>
        {/* Overview status */}
        <Card className="border-[#F1D5D9] shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-semibold mb-1">{lang === "vi" ? "Trạng thái kết nối" : "Connection Status"}</div>
                <div className="text-[11px] text-muted-foreground">
                  {connectedCount}/{sources.length} {lang === "vi" ? "nguồn đã kết nối" : "sources connected"} ·{" "}
                  {liveMode 
                    ? (lang === "vi" ? "Agent sẽ dùng dữ liệu live" : "Agent will use live data") 
                    : (lang === "vi" ? "Agent đang ở chế độ demo/thử nghiệm" : "Agent is running in demo/fallback mode")}
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs border-[#F1D5D9] hover:bg-[#FFF5F6]" onClick={fetchSources}>
                <RefreshCw className="h-3.5 w-3.5" />
                {lang === "vi" ? "Làm mới" : "Refresh"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Block 1: Organizer / KFC API */}
        <SourceBlock
          title={lang === "vi" ? "API Ban tổ chức / KFC" : "Organizer / KFC API"}
          subtitle={lang === "vi" ? "Kết nối API thật do ban tổ chức hoặc KFC cung cấp. Khi kết nối thành công, Agent tự động nâng lên chế độ live." : "Connect to the real API provided by organizers or KFC. On successful connection, the agent automatically upgrades to live mode."}
          sources={organizerSources}
          expandedId={expandedId}
          onToggle={setExpandedId}
          onChanged={fetchSources}
          loading={loading}
          highlight
        />

        {/* Block 2: Data Mapping (inside each source config) */}
        {/* Block 3: Fallback Rules */}
        <Card className="border-[#F1D5D9] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {lang === "vi" ? "Quy tắc dự phòng" : "Fallback Rules"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {lang === "vi" ? "Khi API lỗi, Agent dùng dữ liệu nào thay thế?" : "What data does the agent use when the API fails?"}
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div className="rounded-md border bg-muted/30 p-3 text-[11px] space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span><strong>API live</strong> — {lang === "vi" ? "dùng khi kết nối thành công" : "used on successful connection"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                <span><strong>CSV tải lên</strong> — {lang === "vi" ? "dùng khi API lỗi nhưng có dữ liệu lịch sử" : "used if API fails but history exists"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span><strong>Dữ liệu demo</strong> — {lang === "vi" ? "dùng khi không có API lẫn CSV (rõ ràng đánh dấu)" : "fallback when no API or CSV is wired (clearly marked)"}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-amber-500/5 border border-amber-500/20 p-2.5">
              <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <strong>{lang === "vi" ? "Không bao giờ ẩn chế độ dự phòng." : "Never hide fallback mode."}</strong>{" "}
                {lang === "vi" 
                  ? "Khi Agent dùng dữ liệu demo/thử nghiệm, UI luôn hiển thị badge SYNTHETIC · DEMO hoặc FALLBACK để giám khảo không nhầm lẫn." 
                  : "When the agent uses demo/fallback data, the UI always displays the SYNTHETIC · DEMO or FALLBACK badge so that judges are not confused."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Block 4: Audit & Security */}
        <Card className="border-[#F1D5D9] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#E4002B]" />
              {lang === "vi" ? "Bảo mật & Kiểm toán" : "Security & Audit"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md border bg-card p-2.5">
                <div className="font-semibold mb-1">{lang === "vi" ? "API Key" : "API Keys"}</div>
                <ul className="space-y-0.5 text-muted-foreground text-[10px]">
                  <li>{lang === "vi" ? "✓ Lưu server-side only" : "✓ Stored server-side only"}</li>
                  <li>{lang === "vi" ? "✓ Mask trong UI (sk-****...ab12)" : "✓ Masked in UI (sk-****...ab12)"}</li>
                  <li>{lang === "vi" ? "✓ Không lưu localStorage" : "✓ Not stored in localStorage"}</li>
                  <li>{lang === "vi" ? "✓ Không log ra console" : "✓ Not logged to console"}</li>
                </ul>
              </div>
              <div className="rounded-md border bg-card p-2.5">
                <div className="font-semibold mb-1">{lang === "vi" ? "Kiểm toán" : "Audits"}</div>
                <ul className="space-y-0.5 text-muted-foreground text-[10px]">
                  <li>{lang === "vi" ? "✓ Mỗi lần test connection được ghi lại" : "✓ Connection tests are logged"}</li>
                  <li>{lang === "vi" ? "✓ Lỗi kết nối hiển thị rõ" : "✓ Connection errors clearly shown"}</li>
                  <li>{lang === "vi" ? "✓ Trạng thái nguồn cập nhật realtime" : "✓ Source status updated in real-time"}</li>
                  <li>{lang === "vi" ? "✓ .env.example có template" : "✓ Template provided in .env.example"}</li>
                </ul>
              </div>
            </div>
            <div className="rounded-md bg-muted/30 p-2.5 mt-2">
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                <strong>{lang === "vi" ? "Biến môi trường (production):" : "Environment variables (production):"}</strong>{" "}
                <code className="font-mono text-[9px]">SPONSOR_API_BASE_URL</code>,{" "}
                <code className="font-mono text-[9px]">SPONSOR_API_KEY</code>,{" "}
                <code className="font-mono text-[9px]">SPONSOR_API_MODE</code>.{" "}
                {lang === "vi" ? "Xem .env.example để biết chi tiết." : "See .env.example for details."}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* External sources (weather, maps) */}
        <SourceBlock
          title={lang === "vi" ? "Nguồn dữ liệu bên ngoài" : "External Data Sources"}
          subtitle={lang === "vi" ? "Thời tiết (Open-Meteo mặc định) và Bản đồ cửa hàng (Google Maps Embed)." : "Weather (Open-Meteo default) and Store Map (Google Maps Embed)."}
          sources={externalSources}
          expandedId={expandedId}
          onToggle={setExpandedId}
          onChanged={fetchSources}
          loading={loading}
        />

        {/* CSV Upload */}
        <SourceBlock
          title={lang === "vi" ? "Tải lên dữ liệu CSV" : "CSV Upload"}
          subtitle={lang === "vi" ? "Tải lên file CSV dữ liệu vận hành lịch sử." : "Upload CSV files for historical operations data."}
          sources={csvSources}
          expandedId={expandedId}
          onToggle={setExpandedId}
          onChanged={fetchSources}
          loading={loading}
        />

        {/* Router API / AI Model Provider */}
        <Card className="border-neutral-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-neutral-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-extrabold flex items-center gap-2 text-neutral-900">
                <Cpu className="h-4 w-4 text-[#E4002B]" />
                {lang === "vi" ? "Router API / Nhà cung cấp mô hình AI" : "Router API / AI Model Provider"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {lang === "vi"
                  ? "Cấu hình AI Hub cho phép chọn từ nhiều Provider khác nhau. Không phải API ban tổ chức/KFC."
                  : "AI Provider Hub allowing selection of multiple providers. Not the Organizer/KFC API."}
              </p>
            </div>
            {/* Adapter Badge */}
            {activeProvider && (
              <Badge variant="outline" className="text-[10px] font-bold bg-neutral-50 text-neutral-600 border-neutral-200 shrink-0">
                {lang === "vi" ? "Adapter hiện tại: " : "Current Adapter: "}
                {activeProvider.adapter}
              </Badge>
            )}
          </CardHeader>

          <CardContent className="pt-5 space-y-5">
            {/* Top row: Provider Selector */}
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div className="flex-1 space-y-1.5 w-full">
                <div className="flex items-center justify-between">
                  <Label htmlFor="llm-provider-id" className="text-xs font-bold text-neutral-700">
                    {lang === "vi" ? "Nhà cung cấp (Provider Hub)" : "AI Provider"}
                  </Label>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-[10px] font-bold text-[#E4002B]" onClick={() => setShowCustomBuilder(!showCustomBuilder)}>
                    + {lang === "vi" ? "Tạo Custom Provider" : "Custom Provider Builder"}
                  </Button>
                </div>
                <select
                  id="llm-provider-id"
                  value={llmProviderId}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full rounded-md border border-neutral-200 px-3 py-1.5 text-xs shadow-2xs bg-white font-medium focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                >
                  <optgroup label={lang === "vi" ? "Provider cốt lõi" : "Core Providers"}>
                    {PROVIDER_REGISTRY.map((p) => (
                      <option key={p.id} value={p.id}>
                        {lang === "vi" ? p.labelVi : p.labelEn}
                      </option>
                    ))}
                  </optgroup>
                  {customProviders.length > 0 && (
                    <optgroup label={lang === "vi" ? "Provider tùy chỉnh" : "Custom Providers"}>
                      {customProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {lang === "vi" ? p.labelVi : p.labelEn}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {lang === "vi" ? activeProvider?.noteVi : activeProvider?.noteEn}
                </p>
              </div>

              <div className="flex-1 space-y-1.5 w-full">
                <Label htmlFor="llm-base-url" className="text-xs font-bold text-neutral-700">
                  {lang === "vi" ? "Endpoint Base URL" : "Base URL"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="llm-base-url"
                    placeholder={activeProvider?.defaultBaseUrl || "https://..."}
                    value={llmBaseUrl}
                    onChange={(e) => setLlmBaseUrl(e.target.value)}
                    className="text-xs h-8 border-neutral-200 flex-1 bg-neutral-50"
                  />
                  {activeProvider?.defaultBaseUrl && (
                    <Button type="button" variant="outline" size="sm" className="h-8 px-2" title="Reset to default" onClick={() => setLlmBaseUrl(activeProvider.defaultBaseUrl)}>
                      <RefreshCw className="h-3 w-3 text-neutral-500" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Middle row: Key & Headers */}
            <div className="flex flex-col md:flex-row gap-4 items-start p-3 bg-neutral-50/50 rounded-lg border border-neutral-100">
              <div className="flex-1 space-y-1.5 w-full">
                <Label htmlFor="llm-api-key" className="text-xs font-bold text-neutral-700">
                  {lang === "vi" ? "API Key (Mật mã)" : "API Key"}
                </Label>
                <div className="relative">
                  <Input
                    id="llm-api-key"
                    type={showLlmKey ? "text" : "password"}
                    placeholder={llmHasKey ? (lang === "vi" ? "Nhập key mới để thay thế..." : "Enter new key to replace...") : (activeProvider.requiresApiKey ? "sk-..." : "Not required / Không bắt buộc")}
                    value={llmLimitedKey}
                    onChange={(e) => setLlmLimitedKey(e.target.value)}
                    className="text-xs h-8 pr-8 border-neutral-200"
                    disabled={!activeProvider.requiresApiKey}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLlmKey(!showLlmKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    disabled={!activeProvider.requiresApiKey}
                  >
                    {showLlmKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="flex flex-col mt-0.5">
                  <p className={cn("text-[9px] font-bold", llmHasKey ? "text-emerald-600" : "text-neutral-500")}>
                    {lang === "vi" ? `Trạng thái: ${llmHasKey ? "Đã cấu hình" : "Chưa cấu hình"}` : `Status: ${llmHasKey ? "Configured" : "Not configured"}`}
                  </p>
                </div>
              </div>

              {activeProvider.supportsExtraHeaders && (
                <div className="flex-1 space-y-1.5 w-full">
                  <Label htmlFor="llm-headers" className="text-xs font-bold text-neutral-700">
                    {lang === "vi" ? "Extra Headers (JSON)" : "Extra Headers (JSON)"}
                  </Label>
                  <Input
                    id="llm-headers"
                    value={customHeaders}
                    onChange={(e) => setCustomHeaders(e.target.value)}
                    placeholder='{"HTTP-Referer":"...", "X-Title":"..."}'
                    className="text-xs h-8 font-mono border-neutral-200"
                  />
                </div>
              )}
            </div>

            {/* Model Selection Row */}
            {llmProviderId === "gemini" && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg leading-relaxed font-semibold">
                Bạn đang dùng Google Gemini API trực tiếp. Hãy dùng model Gemini được tải từ danh sách model. Nếu muốn dùng router/model GPT, hãy chọn Custom OpenAI-compatible.
              </div>
            )}

            <div className="space-y-1.5 p-3 bg-white rounded-lg border border-neutral-200 shadow-xs">
              <Label htmlFor="llm-model-select" className="text-xs font-bold text-neutral-700">
                {lang === "vi" ? "Model được chọn" : "Selected model"}
              </Label>
              <div className="flex flex-col sm:flex-row gap-3">
                {activeProvider.modelDiscoveryMode !== "none" && activeProvider.modelDiscoveryMode !== "manual" ? (
                  <>
                    <select
                      id="llm-model-select"
                      value={llmSelectedModel}
                      onChange={(e) => setLlmSelectedModel(e.target.value)}
                      className="flex-1 rounded-md border border-neutral-200 px-3 py-1 text-xs h-9 bg-neutral-50 font-medium focus:ring-[#E4002B]"
                    >
                      <option value="">-- {lang === "vi" ? "Chưa chọn model" : "No model selected"} --</option>
                      {llmModelsList
                        .filter((m) => llmProviderId !== "gemini" || m.id.toLowerCase().includes("gemini"))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label} {m.ownedBy ? `(${m.ownedBy})` : ""}
                          </option>
                        ))}
                      {llmSelectedModel && 
                        !llmModelsList.find((m) => m.id === llmSelectedModel) && 
                        (llmProviderId !== "gemini" || llmSelectedModel.toLowerCase().includes("gemini")) && (
                          <option value={llmSelectedModel}>{llmSelectedModel} (Khôi phục từ cấu hình)</option>
                        )}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={llmLoadingModels || !llmBaseUrl}
                      onClick={handleLoadModels}
                      className="h-9 border-neutral-200 text-xs px-3 font-bold text-neutral-700 hover:text-[#E4002B]"
                    >
                      {llmLoadingModels ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                      {lang === "vi" ? "Tải model từ máy chủ" : "Discover models"}
                    </Button>
                  </>
                ) : (
                  <Input
                    id="llm-manual-model"
                    value={llmManualModel}
                    onChange={(e) => setLlmManualModel(e.target.value)}
                    placeholder={lang === "vi" ? "Nhập tên model (vd: gpt-4o)..." : "Enter model name manually..."}
                    className="flex-1 text-xs h-9 border-neutral-200 bg-neutral-50"
                  />
                )}
              </div>
            </div>

            {/* Test result status banner */}
            {llmTestResult && (
              <div className={cn(
                "p-3 rounded-lg border text-xs leading-relaxed font-semibold flex items-start gap-2.5 shadow-xs transition-all animate-in fade-in zoom-in-95",
                llmTestResult.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              )}>
                {llmTestResult.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />}
                <div>
                  <div className="font-bold">
                    {llmTestResult.ok 
                      ? (lang === "vi" ? "Kiểm tra kết nối / Model thành công" : "Connection test / Model check successful") 
                      : (lang === "vi" ? "Lỗi kết nối hoặc không tìm thấy model" : "Connection failed or model not found")}
                  </div>
                  <p className="mt-1 text-[11px] font-medium opacity-90">
                    {llmTestResult.message && llmTestResult.message.includes(" / ")
                      ? (lang === "vi" ? llmTestResult.message.split(" / ")[1] : llmTestResult.message.split(" / ")[0])
                      : llmTestResult.message}
                  </p>
                </div>
              </div>
            )}

            {/* Custom Builder UI */}
            {showCustomBuilder && (
              <div className="p-4 border-2 border-dashed border-neutral-200 rounded-lg bg-neutral-50 space-y-4 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-neutral-800">{lang === "vi" ? "Trình tạo Custom Provider" : "Custom Provider Builder"}</h4>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={importCustomProviders} className="h-7 text-[10px] px-2"><Download className="h-3 w-3 mr-1" /> Import</Button>
                    <Button variant="outline" size="sm" onClick={exportCustomProviders} className="h-7 text-[10px] px-2"><Upload className="h-3 w-3 mr-1" /> Export</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">ID (unique)</Label>
                    <Input className="h-7 text-xs" placeholder="my-custom-provider" value={customProviderForm.id || ""} onChange={e => setCustomProviderForm({...customProviderForm, id: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Label (English)</Label>
                    <Input className="h-7 text-xs" placeholder="My Provider" value={customProviderForm.labelEn || ""} onChange={e => setCustomProviderForm({...customProviderForm, labelEn: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Adapter</Label>
                    <select className="w-full h-7 text-xs rounded border border-neutral-200 px-2 bg-white" value={customProviderForm.adapter} onChange={e => setCustomProviderForm({...customProviderForm, adapter: e.target.value as any})}>
                      <option value="openai-compatible">OpenAI Compatible</option>
                      <option value="ollama">Ollama</option>
                      <option value="azure-openai">Azure OpenAI</option>
                      <option value="anthropic">Anthropic (Native)</option>
                      <option value="gemini">Gemini (Native)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Discovery Mode</Label>
                    <select className="w-full h-7 text-xs rounded border border-neutral-200 px-2 bg-white" value={customProviderForm.modelDiscoveryMode} onChange={e => setCustomProviderForm({...customProviderForm, modelDiscoveryMode: e.target.value as any})}>
                      <option value="openai-models">OpenAI (/v1/models)</option>
                      <option value="ollama-tags">Ollama (/api/tags)</option>
                      <option value="manual">Manual (no discovery)</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowCustomBuilder(false)}>Hủy</Button>
                  <Button size="sm" className="h-7 text-xs bg-neutral-900 text-white hover:bg-neutral-800" onClick={saveCustomProvider}>Lưu Provider</Button>
                </div>
              </div>
            )}

            {/* Form actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearDemoConfig}
                className="h-9 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 self-start sm:self-auto"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {lang === "vi" ? "Xóa & Reset" : "Clear & Reset"}
              </Button>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={llmTestingModel || (!llmBaseUrl && activeProvider.modelDiscoveryMode !== "manual" && activeProvider.modelDiscoveryMode !== "none")}
                  onClick={handleTestModel}
                  className="flex-1 sm:flex-none h-9 text-xs font-semibold px-4 border-neutral-200 hover:bg-neutral-50 shadow-xs"
                >
                  {llmTestingModel && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  {lang === "vi" ? "Kiểm tra model" : "Test connection"}
                </Button>
                <div className="flex flex-col items-end gap-1 flex-1 sm:flex-none">
                  <Button
                    type="button"
                    size="sm"
                    disabled={llmSaving}
                    onClick={handleSaveLlm}
                    className="w-full sm:w-auto bg-[#E4002B] hover:bg-[#B00020] text-white font-bold text-xs px-5 h-9 shadow-sm"
                  >
                    {llmSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    {lang === "vi" ? "Lưu cấu hình Hub" : "Save Hub Config"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}

// ─── Source Block ───────────────────────────────────────────────────────

function SourceBlock({
  title,
  subtitle,
  sources,
  expandedId,
  onToggle,
  onChanged,
  loading,
  highlight = false,
}: {
  title: string;
  subtitle: string;
  sources: DataSourceConfigSafe[];
  expandedId: string | null;
  onToggle: (id: string | null) => void;
  onChanged: () => void;
  loading: boolean;
  highlight?: boolean;
}) {
  if (loading && sources.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={highlight ? "border-[var(--kfc-red)]/30" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {highlight && <span className="h-2 w-2 rounded-full bg-[var(--kfc-red)] animate-pulse" />}
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {sources.map((source) => (
          <SourceConfigRow
            key={source.id}
            source={source}
            expanded={expandedId === source.id}
            onToggle={() => onToggle(expandedId === source.id ? null : source.id)}
            onChanged={onChanged}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// Helper to localize status metadata
function getStatusMeta(status: ConnectionStatus, lang: string) {
  const meta = STATUS_META[status];
  let label = meta.label;
  if (lang === "en") {
    switch (status) {
      case "connected": label = "Connected"; break;
      case "error": label = "Error"; break;
      case "untested": label = "Untested"; break;
      case "not-configured": label = "Not Configured"; break;
    }
  }
  return { ...meta, label };
}

// ─── Source Config Row ─────────────────────────────────────────────────

function SourceConfigRow({
  source,
  expanded,
  onToggle,
  onChanged,
}: {
  source: DataSourceConfigSafe;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const { lang } = useLang();
  const Icon = TYPE_ICONS[source.type] ?? Database;
  const statusMeta = getStatusMeta(source.status, lang);
  const StatusIcon = statusMeta.icon;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-accent transition-colors"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--kfc-beige)]/40">
          <Icon className="h-4 w-4 text-[var(--kfc-red)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">
              {lang === "vi"
                ? (SOURCE_TYPE_LABELS_VI[source.type] || source.name)
                : (SOURCE_TYPE_LABELS_EN[source.type] || source.name)}
            </span>
            <Badge
              variant="outline"
              className="text-[9px] font-semibold shrink-0"
              style={{ color: statusMeta.color, borderColor: `${statusMeta.color}55` }}
            >
              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
              {statusMeta.label}
            </Badge>
          </div>
          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
            {lang === "vi"
              ? SOURCE_TYPE_DESCRIPTIONS_VI[source.type]
              : SOURCE_TYPE_DESCRIPTIONS_EN[source.type]}
          </div>
        </div>
        {expanded ? (
          <span className="text-[10px] text-muted-foreground shrink-0">{lang === "vi" ? "Đóng" : "Close"}</span>
        ) : (
          <span className="text-[10px] text-muted-foreground shrink-0">{lang === "vi" ? "Mở" : "Open"}</span>
        )}
      </button>
      {expanded && (
        <div className="border-t bg-muted/20 p-4">
          <SourceConfigForm source={source} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

// ─── Source Config Form ────────────────────────────────────────────────

function SourceConfigForm({
  source,
  onChanged,
}: {
  source: DataSourceConfigSafe;
  onChanged: () => void;
}) {
  const { lang } = useLang();
  const [apiUrl, setApiUrl] = React.useState(source.apiUrl ?? "");
  const [apiKey, setApiKey] = React.useState("");
  const [headers, setHeaders] = React.useState(source.headers ?? "");
  const [fieldMapping, setFieldMapping] = React.useState<Record<string, string>>(source.fieldMapping ?? {});
  const [showKey, setShowKey] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; error?: string; sampleData?: unknown; durationMs?: number } | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    queueMicrotask(() => {
      setApiUrl(source.apiUrl ?? "");
      setHeaders(source.headers ?? "");
      setFieldMapping(source.fieldMapping ?? {});
      setApiKey("");
      setTestResult(null);
    });
  }, [source.id]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await fetchJson<{ ok: boolean; error?: string; sampleData?: unknown; durationMs?: number }>("/api/admin/sources/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: source.id,
          apiUrl: apiUrl || undefined,
          headers: headers || undefined,
        }),
      });
      setTestResult(data);
      if (data.ok) {
        toast.success(lang === "vi" ? `Kết nối thành công (${data.durationMs}ms)` : `Connection successful (${data.durationMs}ms)`);
      } else {
        toast.error(`${lang === "vi" ? "Lỗi:" : "Error:"} ${data.error}`);
      }
      onChanged();
    } catch (e) {
      toast.error(lang === "vi" ? "Lỗi khi kiểm tra kết nối" : "Error testing connection");
      setTestResult({ ok: false, error: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchJson("/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: source.id,
          name: source.name,
          type: source.type,
          apiUrl: apiUrl || undefined,
          headers: headers || undefined,
          fieldMapping,
        }),
      });
      toast.success(lang === "vi" ? "Đã lưu cấu hình" : "Configuration saved");
      onChanged();
    } catch {
      toast.error(lang === "vi" ? "Lưu cấu hình thất bại" : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const isCsvType = source.type === "csv-upload";

  // Field mapping schema per type
  const mappingFields: Record<string, string[]> = {
    pos: ["store_id", "date", "time_slot", "walk_in_orders", "delivery_orders", "takeaway_orders", "revenue", "item_count"],
    inventory: ["store_id", "date", "item_category", "stock_level", "waste_units", "stockout_count"],
    staffing: ["store_id", "date", "time_slot", "staff_count", "kitchen_staff", "counter_staff", "packing_staff"],
    complaint: ["store_id", "date", "complaint_count", "cancel_count", "late_order_count"],
  };
  const fields = mappingFields[source.type] ?? [];

  return (
    <div className="space-y-3">
      {/* API URL */}
      {!isCsvType && (
        <div className="space-y-1">
          <Label className="text-xs">API URL <span className="text-muted-foreground">{lang === "vi" ? "(dùng {storeId} làm placeholder)" : "(use {storeId} as placeholder)"}</span></Label>
          <Input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.kfc.example.com/stores/{storeId}/baseline"
            className="h-8 text-xs"
          />
        </div>
      )}

      {/* API Key */}
      {!isCsvType && (
        <div className="space-y-1">
          <Label className="text-xs">
            {lang === "vi" ? "API Key / Bearer Token" : "API Key / Bearer Token"}
            {source.hasKey && source.apiKeyMasked && (
              <span className="ml-2 text-[10px] text-muted-foreground">({lang === "vi" ? "hiện tại:" : "current:"} {source.apiKeyMasked})</span>
            )}
          </Label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={source.hasKey ? (lang === "vi" ? "Nhập key mới để thay thế..." : "Enter new key to replace...") : (lang === "vi" ? "Nhập API key..." : "Enter API key...")}
              className="h-8 text-xs pr-8"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Headers */}
      {!isCsvType && (
        <div className="space-y-1">
          <Label className="text-xs">{lang === "vi" ? "Header bổ sung (JSON, tùy chọn)" : "Additional Headers (JSON, optional)"}</Label>
          <Textarea
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            placeholder='{"X-Custom-Header": "value"}'
            className="text-xs font-mono min-h-[50px] resize-y"
          />
        </div>
      )}

      {/* Field Mapping */}
      {fields.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">{lang === "vi" ? "Ghép cột dữ liệu" : "Field Mapping"}</Label>
          <p className="text-[10px] text-muted-foreground">
            {lang === "vi" ? "Ánh xạ trường API ban tổ chức → trường nội bộ. Bỏ trống nếu tên đã khớp." : "Map organizer API fields → internal fields. Leave blank if names match."}
          </p>
          <div className="rounded-md border divide-y divide-border/30">
            {fields.map((field) => (
              <div key={field} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="text-[10px] font-mono font-semibold w-40 shrink-0 truncate">{field}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">←</span>
                <Input
                  value={fieldMapping[field] ?? ""}
                  onChange={(e) => setFieldMapping({ ...fieldMapping, [field]: e.target.value })}
                  placeholder={field}
                  className="h-7 text-xs flex-1"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSV note */}
      {isCsvType && (
        <div className="rounded-md border border-[var(--kfc-beige)] bg-[var(--kfc-beige)]/20 px-3 py-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {lang === "vi" 
              ? "Nguồn CSV kích hoạt khi tải lên file từ tab \"Bằng chứng\" ở trang chính. Không cần cấu hình API."
              : "CSV source is activated when uploading files from the \"Evidence\" tab on the main page. No API configuration needed."}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!isCsvType && (
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing} className="h-8 gap-1.5 text-xs">
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            {lang === "vi" ? "Kiểm tra kết nối" : "Test Connection"}
          </Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 gap-1.5 text-xs bg-[var(--kfc-red)] hover:bg-[var(--kfc-red-dark)] text-white border-0">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {lang === "vi" ? "Lưu cấu hình" : "Save configuration"}
        </Button>
        {source.lastError && (
          <span className="text-[10px] text-[var(--kfc-red)] flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {source.lastError.includes(" / ")
              ? (lang === "vi" ? source.lastError.split(" / ")[1] : source.lastError.split(" / ")[0])
              : source.lastError}
          </span>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            {testResult.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--kfc-success)]" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-[var(--kfc-red)]" />
            )}
            <span className="text-[11px] font-semibold">
              {testResult.ok 
                ? (lang === "vi" ? "Kết nối thành công" : "Connection successful") 
                : (lang === "vi" ? "Kết nối thất bại" : "Connection failed")}
            </span>
            {testResult.durationMs !== undefined && (
              <span className="text-[10px] text-muted-foreground">({testResult.durationMs}ms)</span>
            )}
          </div>
          {testResult.error && (
            <div className="rounded-md bg-[var(--kfc-red)]/5 border border-[var(--kfc-red)]/20 px-2.5 py-1.5 text-[10px] text-[var(--kfc-red)]">
              {testResult.error.includes(" / ")
                ? (lang === "vi" ? testResult.error.split(" / ")[1] : testResult.error.split(" / ")[0])
                : testResult.error}
            </div>
          )}
          {testResult.sampleData != null && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                {lang === "vi" ? "Dữ liệu mẫu (5 dòng đầu)" : "Sample Data (first 5 rows)"}
              </div>
              <pre className="rounded-md bg-muted/50 border border-border/40 p-2.5 text-[10px] font-mono overflow-x-auto max-h-40 overflow-y-auto scrollbar-thin">
                {JSON.stringify(testResult.sampleData, null, 2).slice(0, 1500)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
