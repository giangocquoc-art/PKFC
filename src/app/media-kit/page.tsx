"use client";

import * as React from "react";
import {
  Store as StoreIcon,
  MapPin,
  RefreshCw,
  Sparkles,
  CloudSun,
  Users,
  Package,
  Zap,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ArrowRight,
  Send,
  User,
  Bot,
  Database,
  Cpu,
  ShieldCheck,
  Code,
  KeyRound,
  FileText,
  Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function MediaKitPage() {
  const [lang, setLang] = React.useState<"vi" | "en">("en");

  const t = {
    en: {
      title: "Agent CaMate — Presentation & Media Kit Gallery",
      subtitle: "3:2 Ratio Screenshot-Ready Panels for Devpost & Hackathon Showcases",
      langToggle: "Tiếng Việt",
      heroTitle: "1. Hero Command Center Dashboard",
      actionPlanTitle: "2. Today's Operational Action Plan",
      approvalTitle: "3. Manager Approval & Guardrails",
      evidenceTitle: "4. Observe-Reason-Plan Evidence Trace",
      askAgentTitle: "5. Grounded 'Ask Agent CaMate'",
      providerTitle: "6. Model & Operations Provider Hub",
      pkfcTitle: "7. P-KFC API Integration Settings",
      disclaimerTitle: "IMPORTANT NOTICE",
      disclaimerDesc: "This is an independent hackathon demo pilot prototype, not an official product of KFC or Yum! Brands. Operational recommendations are simulated and require manager verification.",
      runCta: "Run StoreOps Plan",
      storeSelected: "KFC Nguyễn Thị Minh Khai",
      storeType: "Drive-Thru / Standard",
      weatherTitle: "Weather Signals",
      posTitle: "POS / Sales Signals",
      inventoryTitle: "Inventory Level",
      staffingTitle: "Staffing Status",
      actionsTitle: "Shift Recommended Actions",
      approvalRequired: "MANAGER APPROVAL REQUIRED",
      riskLevel: "High risk adjustment",
      confidence: "94% confidence",
      evidenceChips: "Operational Evidence Collected",
      groundedInRun: "Grounded in Active Run:",
      providerStatus: "Live Connections",
      apiKeyStatus: "API Key Active",
      endpointHeading: "Endpoint Settings",
      externalAccess: "P-KFC External Access"
    },
    vi: {
      title: "Agent CaMate — Thư viện Media & Trình diễn",
      subtitle: "Các panel tỉ lệ 3:2 sẵn sàng chụp ảnh màn hình cho Devpost & Thuyết trình",
      langToggle: "English",
      heroTitle: "1. Bàn Điều Khiển Trung Tâm (Hero)",
      actionPlanTitle: "2. Kế Hoạch Hành Động Ca Trực",
      approvalTitle: "3. Phê Duyệt Của Quản Lý & Rào Cản",
      evidenceTitle: "4. Dòng Bằng Chứng Quan Sát → Kế Hoạch",
      askAgentTitle: "5. Hỏi Đáp Grounded 'Hỏi Agent CaMate'",
      providerTitle: "6. Trung Tâm Quản Lý Mô Hình & Dữ Liệu",
      pkfcTitle: "7. Tích Hợp API P-KFC Cho Bên Thứ Ba",
      disclaimerTitle: "LƯU Ý QUAN TRỌNG",
      disclaimerDesc: "Đây là sản phẩm thử nghiệm độc lập tham gia hackathon, không phải là sản phẩm chính thức của KFC hoặc Yum! Brands. Các đề xuất vận hành là mô phỏng và cần quản lý đối chiếu.",
      runCta: "Tạo kế hoạch vận hành",
      storeSelected: "KFC Nguyễn Thị Minh Khai",
      storeType: "Drive-Thru / Tiêu chuẩn",
      weatherTitle: "Tín hiệu Thời tiết",
      posTitle: "Tín hiệu bán hàng (POS)",
      inventoryTitle: "Trạng thái tồn kho",
      staffingTitle: "Bố trí nhân sự",
      actionsTitle: "Hành động đề xuất ca trực",
      approvalRequired: "CẦN QUẢN LÝ PHÊ DUYỆT HÀNH ĐỘNG",
      riskLevel: "Rủi ro thay đổi cao",
      confidence: "Độ tin cậy 94%",
      evidenceChips: "Bằng chứng vận hành thu thập",
      groundedInRun: "Liên kết với Phiên chạy:",
      providerStatus: "Trạng thái kết nối",
      apiKeyStatus: "Mã API Đang hoạt động",
      endpointHeading: "Cấu hình Điểm cuối",
      externalAccess: "Cổng API P-KFC mở rộng"
    }
  }[lang];

  return (
    <div className="min-h-screen bg-[#FFF5F6] text-neutral-900 p-8 font-sans">
      {/* Top Header */}
      <div className="max-w-[1200px] mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#F1D5D9] pb-6">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-[#E4002B] text-white font-black text-sm">KFC</span>
            {t.title}
          </h1>
          <p className="text-xs text-neutral-500 font-medium mt-1">{t.subtitle}</p>
        </div>
        <div className="flex gap-2 shrink-0 self-start md:self-auto">
          <Link href="/" className="inline-flex items-center justify-center rounded border border-neutral-200 bg-white hover:bg-neutral-50 px-4 h-9 text-xs font-bold text-neutral-700">
            {lang === "en" ? "← Back to App" : "← Quay lại App"}
          </Link>
          <Button
            onClick={() => setLang(l => l === "en" ? "vi" : "en")}
            className="bg-[#E4002B] hover:bg-[#B00020] text-white font-extrabold text-xs px-4 h-9 shadow-sm"
          >
            {t.langToggle}
          </Button>
        </div>
      </div>

      {/* Grid of 3:2 aspect panels */}
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 pb-16">
        
        {/* PANEL 1: Hero Dashboard */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{t.heroTitle}</span>
          <div className="aspect-[3/2] border border-[#F1D5D9] rounded-2xl bg-white p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-[#E4002B] text-white font-black text-xs shadow-sm">KFC</div>
                <div className="leading-none">
                  <div className="text-xs font-black text-neutral-900">Agent CaMate</div>
                  <span className="text-[9px] text-[#E4002B] font-bold uppercase tracking-wide">StoreOps Command Center</span>
                </div>
              </div>
              <Badge variant="outline" className="h-5 text-[8px] font-bold bg-[#E4002B]/10 text-[#E4002B] border-[#E4002B]/20">
                {t.storeType}
              </Badge>
            </div>

            {/* Main Visual: Store Map Simulation & Store Selector */}
            <div className="grid grid-cols-12 gap-3 flex-1 py-3 items-center">
              <div className="col-span-5 space-y-2.5">
                <div className="p-3.5 rounded-lg border border-[#F1D5D9] bg-[#FFF5F6] space-y-1">
                  <span className="text-[8px] font-bold text-neutral-400 block uppercase tracking-wide">SELECTED STORE</span>
                  <span className="text-xs font-black text-neutral-900 block truncate">{t.storeSelected}</span>
                  <span className="text-[9px] text-neutral-500 font-medium">District 1, TP.HCM · Standard</span>
                </div>
                <div className="p-2.5 rounded-lg border border-neutral-100 bg-neutral-50 space-y-1">
                  <span className="text-[8px] font-bold text-neutral-400 block uppercase tracking-wide">SHIFT MANAGER</span>
                  <span className="text-[10px] font-bold text-neutral-800">Nguyen Van A</span>
                </div>
              </div>
              
              <div className="col-span-7 h-full rounded-lg border border-[#F1D5D9] bg-neutral-100 relative overflow-hidden flex items-center justify-center">
                {/* Fake Map Layout */}
                <div className="absolute inset-0 bg-[#FFF5F6] opacity-40 pattern-grid" />
                <div className="absolute h-3 w-3 bg-[#E4002B] rounded-full animate-ping" />
                <div className="absolute h-2 w-2 bg-[#E4002B] rounded-full border border-white shadow-sm" />
                <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-xs border px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-1 shadow-xs">
                  <MapPin className="h-2 w-2 text-[#E4002B]" /> HCM City center map
                </div>
              </div>
            </div>

            {/* Bottom: Main CTA */}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-[9px] font-bold text-neutral-500">
                {lang === "en" ? "Hôm nay cửa hàng cần làm gì, và vì sao?" : "Hôm nay cửa hàng cần làm gì, và vì sao?"}
              </span>
              <Button className="bg-[#E4002B] hover:bg-[#B00020] text-white font-extrabold text-[10px] h-8 px-4 rounded shadow-sm gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin-slow" />
                {t.runCta}
              </Button>
            </div>
          </div>
        </div>

        {/* PANEL 2: Today's Action Plan */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{t.actionPlanTitle}</span>
          <div className="aspect-[3/2] border border-[#F1D5D9] rounded-2xl bg-white p-6 shadow-md flex flex-col justify-between">
            {/* Top Header info */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <CloudSun className="h-4 w-4 text-[#E4002B]" />
                <span className="text-xs font-black text-neutral-800">{lang === "en" ? "Today's Shift Plan" : "Kế hoạch Hành động Ca trực"}</span>
              </div>
              <Badge className="bg-[#E4002B]/10 text-[#E4002B] border border-[#E4002B]/20 text-[8px] font-bold px-2">
                {lang === "en" ? "Sponsor API Live" : "API Ban tổ chức Kết nối"}
              </Badge>
            </div>

            {/* Signal Badges & Signals strip */}
            <div className="grid grid-cols-4 gap-2 py-2.5">
              <div className="p-2 border border-neutral-100 bg-neutral-50/50 rounded flex flex-col justify-between">
                <span className="text-[8px] font-bold text-neutral-400 block uppercase">{t.weatherTitle}</span>
                <span className="text-[11px] font-black text-amber-600 block mt-1">75% Rain Risk</span>
              </div>
              <div className="p-2 border border-neutral-100 bg-neutral-50/50 rounded flex flex-col justify-between">
                <span className="text-[8px] font-bold text-neutral-400 block uppercase">{t.posTitle}</span>
                <span className="text-[11px] font-black text-rose-500 block mt-1">-15% Walk-in</span>
              </div>
              <div className="p-2 border border-neutral-100 bg-neutral-50/50 rounded flex flex-col justify-between">
                <span className="text-[8px] font-bold text-neutral-400 block uppercase">{t.inventoryTitle}</span>
                <span className="text-[11px] font-black text-emerald-600 block mt-1">Stock Safe</span>
              </div>
              <div className="p-2 border border-neutral-100 bg-neutral-50/50 rounded flex flex-col justify-between">
                <span className="text-[8px] font-bold text-neutral-400 block uppercase">{t.staffingTitle}</span>
                <span className="text-[11px] font-black text-neutral-800 block mt-1">+1 Packer Needed</span>
              </div>
            </div>

            {/* Top 3 actions */}
            <div className="flex-1 space-y-2 py-1 overflow-hidden">
              <span className="text-[9px] font-bold text-neutral-400 block uppercase tracking-wider">{t.actionsTitle}</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2 border border-[#F1D5D9]/40 bg-[#FFF5F6]/40 rounded-lg flex gap-2">
                  <div className="h-5 w-5 rounded bg-[#E4002B]/10 flex items-center justify-center text-[#E4002B] shrink-0 text-[10px] font-bold">1</div>
                  <div className="text-[10px] leading-tight font-semibold text-neutral-700">
                    {lang === "en" ? "Reduce lunch prep batch by 15% due to walk-in drop risk." : "Giảm mẻ chế biến trưa 15% để tránh hao hụt vì khách walk-in giảm."}
                  </div>
                </div>
                <div className="p-2 border border-[#F1D5D9]/40 bg-[#FFF5F6]/40 rounded-lg flex gap-2">
                  <div className="h-5 w-5 rounded bg-[#E4002B]/10 flex items-center justify-center text-[#E4002B] shrink-0 text-[10px] font-bold">2</div>
                  <div className="text-[10px] leading-tight font-semibold text-neutral-700">
                    {lang === "en" ? "Pre-stage combo packaging at the delivery station." : "Chuẩn bị sẵn bao bì combo tại khu đóng gói giao hàng."}
                  </div>
                </div>
                <div className="p-2 border border-[#F1D5D9]/40 bg-[#FFF5F6]/40 rounded-lg flex gap-2">
                  <div className="h-5 w-5 rounded bg-[#E4002B]/10 flex items-center justify-center text-[#E4002B] shrink-0 text-[10px] font-bold">3</div>
                  <div className="text-[10px] leading-tight font-semibold text-neutral-700">
                    {lang === "en" ? "Redeploy 1 counter staff to packer role during peak rain hours." : "Điều chuyển 1 nhân viên quầy sang phụ đóng gói lúc mưa cao điểm."}
                  </div>
                </div>
                <div className="p-2 border border-[#F1D5D9]/40 bg-[#FFF5F6]/40 rounded-lg flex gap-2">
                  <div className="h-5 w-5 rounded bg-[#E4002B]/10 flex items-center justify-center text-[#E4002B] shrink-0 text-[10px] font-bold">4</div>
                  <div className="text-[10px] leading-tight font-semibold text-neutral-700">
                    {lang === "en" ? "Increase delivery rider buffer to +10 mins on aggregator." : "Tăng thời gian dự kiến giao hàng thêm 10 phút trên app."}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom note */}
            <div className="text-[8px] text-neutral-400 font-semibold uppercase tracking-wider text-right border-t pt-2 mt-1">
              {lang === "en" ? "Manager approval required before execution" : "Cần phê duyệt từ quản lý trước khi áp dụng"}
            </div>
          </div>
        </div>

        {/* PANEL 3: Manager Approval Required */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{t.approvalTitle}</span>
          <div className="aspect-[3/2] border border-amber-500/30 rounded-2xl bg-[#FFFBF0] p-6 shadow-md flex flex-col justify-between">
            {/* Warning header */}
            <div className="flex items-center gap-2 border-b border-amber-200 pb-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 animate-pulse" />
              <div className="leading-none">
                <span className="text-xs font-extrabold text-neutral-900 block uppercase tracking-wider">{t.approvalRequired}</span>
                <span className="text-[9px] text-amber-700 font-bold">{lang === "en" ? "Sensitive labor & capacity modifications" : "Thay đổi nhạy cảm về nhân sự & công suất"}</span>
              </div>
            </div>

            {/* Draft action details */}
            <div className="flex-1 py-4 space-y-3">
              <div className="bg-white rounded-lg border border-amber-200 p-3 space-y-2 shadow-2xs">
                <div className="flex justify-between items-center flex-wrap gap-1">
                  <span className="text-xs font-black text-neutral-800">
                    {lang === "en" ? "Action: Redeploy 1 Counter Staff to Delivery Packing" : "Hành động: Điều chuyển 1 NV Quầy sang Đóng gói giao hàng"}
                  </span>
                  <div className="flex gap-1.5">
                    <Badge className="bg-amber-500/10 text-amber-700 border border-amber-200 text-[8px] font-bold px-1.5 h-4 flex items-center shrink-0">
                      {t.riskLevel}
                    </Badge>
                    <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-200 text-[8px] font-bold px-1.5 h-4 flex items-center shrink-0">
                      {t.confidence}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1">
                  <span className="text-[8px] font-bold text-neutral-400 block uppercase">REASONING & EVIDENCE</span>
                  <p className="text-[10px] text-neutral-600 font-semibold leading-relaxed">
                    {lang === "en" 
                      ? "Precipitation is forecasted to cross 10mm/h from 11:30 to 13:00. Store profile dictates walk-in demand collapses by 20%, shifting to delivery. Counter queue is low, but delivery packing station faces critical bottleneck."
                      : "Lượng mưa được dự báo vượt 10mm/h từ 11:30 đến 13:00. Dữ liệu cửa hàng cho thấy lượng khách trực tiếp giảm 20%, chuyển dịch hoàn toàn sang giao hàng. Lượng khách xếp hàng tại quầy thấp, trong khi quầy đóng gói đang quá tải."}
                  </p>
                </div>
              </div>
            </div>

            {/* Approval controls */}
            <div className="flex items-center justify-between pt-3 border-t border-amber-200">
              <span className="text-[9px] text-amber-800 font-bold">
                {lang === "en" ? "Independent hackathon demo recommendation" : "Đề xuất độc lập của demo hackathon"}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50/50">
                  <XCircle className="h-3.5 w-3.5" />
                  {lang === "en" ? "Reject" : "Từ chối"}
                </Button>
                <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#E4002B] hover:bg-[#B00020] text-white border-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {lang === "en" ? "Approve" : "Duyệt áp dụng"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 4: Evidence / Trace */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{t.evidenceTitle}</span>
          <div className="aspect-[3/2] border border-[#F1D5D9] rounded-2xl bg-white p-6 shadow-md flex flex-col justify-between">
            {/* Observe Ribbon */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-neutral-400 block uppercase tracking-wider">
                {lang === "en" ? "Agent Execution Flow Ribbon" : "Luồng xử lý quy trình của Agent"}
              </span>
              <div className="grid grid-cols-6 gap-1 text-center text-[9px] font-bold bg-[#FFF5F6] p-1.5 rounded-lg border border-[#F1D5D9]/40">
                <div className="text-neutral-700 bg-white shadow-2xs border rounded py-1">OBSERVE</div>
                <div className="text-neutral-700 py-1">REASON</div>
                <div className="text-neutral-700 py-1">PLAN</div>
                <div className="text-neutral-700 py-1">VERIFY</div>
                <div className="text-neutral-700 py-1">APPROVE</div>
                <div className="text-neutral-700 py-1">REPORT</div>
              </div>
            </div>

            {/* Evidence Chips */}
            <div className="flex-1 py-3.5 space-y-2.5">
              <span className="text-[9px] font-bold text-neutral-400 block uppercase tracking-wider">{t.evidenceChips}</span>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1 text-[9px] py-1 border border-neutral-200">
                  <Globe className="h-3 w-3 text-sky-600" /> Weather: rain (75%), Open-Meteo
                </Badge>
                <Badge variant="secondary" className="gap-1 text-[9px] py-1 border border-neutral-200">
                  <Database className="h-3 w-3 text-indigo-600" /> Store Profile: Drive-Thru, Standard
                </Badge>
                <Badge variant="secondary" className="gap-1 text-[9px] py-1 border border-neutral-200">
                  <Users className="h-3 w-3 text-emerald-600" /> Staffing: 4 crews, Shift Roster
                </Badge>
                <Badge variant="secondary" className="gap-1 text-[9px] py-1 border border-neutral-200">
                  <Package className="h-3 w-3 text-amber-600" /> Inventory: Chicken buckets & packaging OK
                </Badge>
              </div>

              {/* Collapsed Technical Trace */}
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold text-neutral-400 block uppercase">Technical Observability Logs (Trace)</span>
                  <Badge variant="outline" className="text-[8px] bg-neutral-100 text-neutral-500 border-neutral-300">Collapsed</Badge>
                </div>
                <p className="text-[9px] font-mono text-neutral-500 truncate">
                  {"[Weather Signal Agent] -> [Operations Baseline Agent] -> [Risk Intelligence Agent] -> [Approval Guardrail] -> [Manager Briefing Agent]"}
                </p>
              </div>
            </div>

            {/* Bottom Status */}
            <div className="border-t pt-2 flex items-center justify-between text-[9px] font-semibold text-neutral-500">
              <span>Run ID: <span className="font-mono bg-neutral-100 px-1 py-0.5 rounded">run-d8f8a6c8-912f</span></span>
              <span>Observed at: 2026-06-20 06:47:00</span>
            </div>
          </div>
        </div>

        {/* PANEL 5: Ask Agent CaMate */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{t.askAgentTitle}</span>
          <div className="aspect-[3/2] border border-[#F1D5D9] rounded-2xl bg-white p-6 shadow-md flex flex-col justify-between">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#E4002B]" />
                <span className="text-xs font-black text-neutral-800">{lang === "en" ? "Ask Agent CaMate Bubble" : "Hội thoại Trợ lý Ca trực"}</span>
              </div>
              <div className="flex gap-1.5 items-center">
                <Badge variant="outline" className="text-[8px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200 h-4">
                  Router API Mode
                </Badge>
                <span className="text-[9px] text-neutral-400 font-bold">GPT-4o</span>
              </div>
            </div>

            {/* Chat conversation area */}
            <div className="flex-1 py-3.5 space-y-3 overflow-y-auto scrollbar-thin">
              {/* User Question */}
              <div className="flex gap-2 justify-end">
                <div className="max-w-[80%] rounded-2xl p-2.5 text-[10px] bg-[#E4002B] text-white rounded-tr-sm font-semibold">
                  {lang === "en" ? "Why does the agent recommend reducing the batch size today?" : "Tại sao agent lại khuyến nghị giảm lượng chế biến trưa nay?"}
                </div>
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E4002B] text-white text-[9px] font-bold">
                  <User className="h-3 w-3" />
                </div>
              </div>

              {/* Agent Grounded Answer */}
              <div className="flex gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[#E4002B] text-[9px] font-bold border">
                  <Bot className="h-3 w-3" />
                </div>
                <div className="max-w-[80%] rounded-2xl p-2.5 text-[10px] bg-neutral-100 rounded-tl-sm text-neutral-800 leading-relaxed font-semibold">
                  {lang === "en" 
                    ? "The recommendation to reduce batch prep size by 15% is based on the 75% precipitation (rain) risk from 11:30 to 13:00. Historical POS data shows a suburban store like yours experiences a 20% drop in walk-in traffic during rain. Continuing standard prep size would cause excessive chicken waste."
                    : "Khuyến nghị giảm mẻ chế biến trưa 15% được đưa ra dựa trên rủi ro mưa lớn 75% từ 11:30 đến 13:00. Lịch sử giao dịch cho thấy các cửa hàng ven ô/Drive-thru sẽ giảm 20% lượng khách ăn tại chỗ khi trời mưa. Nếu giữ nguyên công suất chiên sẽ gây hao hụt/hủy cao."}
                  
                  {/* Sources attribution */}
                  <div className="mt-2 pt-1.5 border-t border-neutral-200/60 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[8px] font-bold text-neutral-400 uppercase">Grounded Sources:</span>
                    <Badge variant="outline" className="text-[8px] font-bold bg-neutral-50 px-1 py-0 h-4">POS Baseline</Badge>
                    <Badge variant="outline" className="text-[8px] font-bold bg-neutral-50 px-1 py-0 h-4">Open-Meteo API</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Input simulator */}
            <div className="flex items-center gap-2 rounded-lg border bg-neutral-50 p-1">
              <div className="text-[10px] text-neutral-400 flex-1 px-2 font-medium">
                {lang === "en" ? "Grounded in run: run-d8f8a6c8-912f" : "Đang dùng phiên chạy: run-d8f8a6c8-912f"}
              </div>
              <Button size="icon" className="h-6 w-6 bg-[#E4002B] hover:bg-[#B00020] text-white shrink-0 rounded">
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* PANEL 6: Provider Hub */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{t.providerTitle}</span>
          <div className="aspect-[3/2] border border-[#F1D5D9] rounded-2xl bg-white p-6 shadow-md flex flex-col justify-between">
            {/* Header info */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[#E4002B]" />
                <span className="text-xs font-black text-neutral-800">{lang === "en" ? "Model & Operations Provider Hub" : "Cấu hình AI Hub & Nguồn Dữ Liệu"}</span>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-200 text-[8px] font-bold px-2 h-5">
                {t.providerStatus}
              </Badge>
            </div>

            {/* Provider hub cards (3 categories) */}
            <div className="flex-1 py-3.5 space-y-2.5">
              {/* Category 1: Sponsor API / Operations Data */}
              <div className="p-2.5 rounded-lg border border-[#F1D5D9]/40 bg-[#FFF5F6]/40 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-extrabold text-neutral-900 block uppercase">1. Sponsor / KFC API</span>
                  <span className="text-[9px] text-neutral-500 font-medium">Retrieves live store baseline, inventory levels, shift schedule, POS.</span>
                </div>
                <Badge variant="outline" className="text-[8px] font-bold border-emerald-300 text-emerald-600 bg-emerald-50">Active</Badge>
              </div>

              {/* Category 2: Router API / AI Model Provider */}
              <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-extrabold text-neutral-900 block uppercase">2. Router API / LLM Provider</span>
                  <span className="text-[9px] text-neutral-500 font-medium">Model provider for explanation generation (OpenRouter, Groq, DeepSeek).</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[8px] font-bold border-indigo-300 text-indigo-600 bg-indigo-50">Configured</Badge>
                </div>
              </div>

              {/* Category 3: P-KFC API */}
              <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-extrabold text-neutral-900 block uppercase">3. P-KFC Cổng API mở rộng</span>
                  <span className="text-[9px] text-neutral-500 font-medium">Allow other systems to call CaMate pipelines via standard tokens.</span>
                </div>
                <Badge variant="outline" className="text-[8px] font-bold border-sky-300 text-sky-600 bg-sky-50">OpenAPI</Badge>
              </div>
            </div>

            {/* Disclaimer disclaimer */}
            <div className="text-[8px] text-neutral-400 font-semibold uppercase tracking-wider text-left border-t pt-2">
              {lang === "en" ? "Sponsor data is distinct from natural language AI routing" : "Dữ liệu nghiệp vụ tách biệt hoàn toàn với mô hình ngôn ngữ AI"}
            </div>
          </div>
        </div>

        {/* PANEL 7: P-KFC API */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{t.pkfcTitle}</span>
          <div className="aspect-[3/2] border border-[#F1D5D9] rounded-2xl bg-white p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
            {/* Header info */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-[#E4002B]" />
                <span className="text-xs font-black text-neutral-800">{t.externalAccess}</span>
              </div>
              <Badge variant="outline" className="text-[8px] font-bold border-emerald-300 text-emerald-600 bg-emerald-50 h-5">
                {t.apiKeyStatus}
              </Badge>
            </div>

            {/* Content: Endpoint list */}
            <div className="flex-1 py-3.5 space-y-2.5">
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div className="p-2 rounded-lg border bg-neutral-50 space-y-1 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] bg-sky-500 text-white font-extrabold px-1 rounded">GET</span>
                    <span className="font-bold text-neutral-800">/api/agent/run</span>
                  </div>
                  <span className="text-[8px] text-neutral-400 block">Trigger agent pipeline</span>
                </div>
                
                <div className="p-2 rounded-lg border bg-neutral-50 space-y-1 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] bg-emerald-500 text-white font-extrabold px-1 rounded">POST</span>
                    <span className="font-bold text-neutral-800">/api/chat</span>
                  </div>
                  <span className="text-[8px] text-neutral-400 block">Interactive grounded chat</span>
                </div>
              </div>

              {/* Masked API Key display */}
              <div className="p-2.5 rounded-lg border border-neutral-100 bg-[#FFF5F6] flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[#E4002B] shrink-0" />
                  <div className="leading-none">
                    <span className="text-[8px] font-bold text-neutral-400 block uppercase">P-KFC EXT KEY</span>
                    <code className="text-[9px] font-mono font-bold text-neutral-800">pkfc_live_7a3d9...9fbc</code>
                  </div>
                </div>
                <Badge variant="outline" className="text-[8px] border-neutral-300 text-neutral-600 bg-white">Masked</Badge>
              </div>
            </div>

            {/* Disclaimer box at the bottom */}
            <div className="border-t pt-2 mt-1">
              <div className="bg-amber-500/5 border border-amber-500/10 rounded p-1.5 flex items-start gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[7.5px] text-neutral-500 leading-tight">
                  <strong>{t.disclaimerTitle}:</strong> {t.disclaimerDesc}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
