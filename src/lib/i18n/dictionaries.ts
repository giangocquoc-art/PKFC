// Bilingual (English / Vietnamese) UI + manager-facing output dictionary
// for Agent CaMate — StoreOps Decision Agent for KFC.
//
// Keys are namespaced by component/section. Manager-facing outputs (briefing,
// action plan) are generated bilingually by the agent engine; this dictionary
// covers the static UI chrome.

export type Lang = "en" | "vi";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "vi", label: "Tiếng Việt", short: "VI" },
];

export interface Dictionary {
  // Header
  productName: string;
  productTagline: string;
  cityStores: (n: number) => string;
  agentPipeline: string;
  rerunAgent: string;
  rerunning: string;
  language: string;

  // Hero
  heroLine1: string;
  heroLine2: string;
  heroDesc: string;
  run3StoreCompare: string;
  running3Store: string;
  demoStory: string;

  // Store selector
  selectStore: string;
  storeCount: (n: number) => string;
  searchPlaceholder: string;
  clearSearch: string;
  noStoresMatch: (q: string) => string;
  selectThisStore: string;
  deliveryShare: string;
  seats: string;
  batchesPerHr: string;
  demoHighlight: string;

  // Map
  storeNetworkMap: string;
  store: string;
  demoHighlightLegend: string;

  // Weather panel
  weatherSignals: string;
  weatherSub: string;
  temperature: string;
  feelsLike: string;
  humidity: string;
  pressure: string;
  pressureTrend: string;
  wind: string;
  rain1h: string;
  cloudCover: string;
  lastUpdated: string;
  derivedRisk: string;
  rainRisk: string;
  heatRisk: string;
  deliveryDisruption: string;
  walkInDrop: string;
  fallbackMode: string;
  fallbackDesc: (source: string) => string;
  rainLikely: string;
  clearing: string;
  stable: string;

  // Action plan
  dailyActionPlan: string;
  targeting: (date: string, generated: string) => string;
  storeRiskSummary: string;
  slotPlans: string;
  recommendations: string;
  prep: string;
  inventory: string;
  staffing: string;
  deliveryReadiness: string;
  campaign: string;
  wasteRisk: string;
  stockoutRisk: string;
  serviceDelay: string;
  lunch: string;
  dinner: string;
  walkInDelta: string;
  deliveryDelta: string;
  prepBatchDelta: string;
  packagingDelta: string;
  staffingDelta: string;
  warnings: string;
  overallRisk: string;

  // Agent trace
  agentTrace: string;
  agentFlow: string;
  agentsLabel: (n: number) => string;
  total: string;
  inputUsed: string;
  outputGenerated: string;
  structuredOutput: string;
  step: string;
  conf: string;
  live: string;
  fallback: string;

  // Before/after
  beforeVsAfter: string;
  beforeVsAfterSub: string;
  withoutAgent: string;
  withAgent: string;
  methodology: string;

  // Manager briefing
  managerBriefing: string;
  briefingSub: string;
  headline: string;
  tldr: string;
  topActions: string;
  watchItems: string;
  closingNote: string;
  highConfidence: string;
  mediumConfidence: string;
  lowConfidence: string;
  confidence: string;
  exportMd: string;
  exporting: string;

  // Compare
  multiStoreCompare: string;
  multiStoreCompareSub: string;
  clearComparison: string;
  addToComparison: string;
  alreadyInCompare: string;
  compareFull: string;
  compareDemoStory: string;

  // Why agentic
  whyAgentic: string;
  whyAgenticSub: string;
  agentFlow2: string;
  eightAgents: string;
  notAChatbot: string;
  notAChatbotDesc: string;
  notAForecast: string;
  notAForecastDesc: string;
  honestAboutData: string;
  honestAboutDataDesc: string;

  // Data sources panel
  dataSources: string;
  dataSourcesSub: string;
  storeSource: string;
  locationSource: string;
  weatherSource: string;
  rainEvidence: string;
  historicalSource: string;
  aviationBaseline: string;
  operationsData: string;
  source: string;
  mode: string;
  purpose: string;
  fallbackStrategy: string;
  reliabilityNote: string;
  usedIn: string;
  freshness: string;

  // Risk levels
  riskLow: string;
  riskMedium: string;
  riskHigh: string;
  riskCritical: string;

  // Footer
  footerDisclaimer: string;
  footerData: string;
  footerLlm: string;
  footerMap: string;

  // Toasts
  toastAgentRunning: string;
  toastPlanReady: (store: string, live: boolean, ms: number) => string;
  toastAgentFailed: string;
  toastAddedToCompare: (store: string, n: number) => string;
  toastAlreadyInCompare: string;
  toastCompareFull: string;
  toastCompared: (n: number) => string;
  toastCompareFailed: string;
  toastExported: string;
  toastExportFailed: string;
}

const en: Dictionary = {
  productName: "Agent CaMate",
  productTagline: "StoreOps Decision Agent for KFC · Agentic AI Build Week 2026",
  cityStores: (n) => `Ho Chi Minh City · ${n} stores`,
  agentPipeline: "8-agent pipeline",
  rerunAgent: "Run StoreOps Plan",
  rerunning: "Running…",
  language: "Language",

  heroLine1: "Agent CaMate is not a weather chatbot. It is a StoreOps Decision Agent for KFC.",
  heroLine2: "It turns weather and store operation signals into approved, evidence-backed actions.",
  heroDesc:
    "Pilot-oriented prototype. Select a KFC store. Agent CaMate observes weather + operations baseline, reasons about demand shifts, plans prep/staffing/delivery/campaign, verifies data quality, and creates an evidence-backed action plan with manager approval gates.",
  run3StoreCompare: "Run 3-store demo compare",
  running3Store: "Running…",
  demoStory: "Urban · Residential · Suburban storytelling",

  selectStore: "Select a store",
  storeCount: (n) => `${n} KFC stores seeded across TP.HCM districts`,
  searchPlaceholder: "Search by name, district, or type…",
  clearSearch: "Clear search",
  noStoresMatch: (q) => `No stores match “${q}”.`,
  selectThisStore: "Select this store →",
  deliveryShare: "delivery",
  seats: "seats",
  batchesPerHr: "batches/hr",
  demoHighlight: "demo",

  storeNetworkMap: "Store network map",
  store: "store",
  demoHighlightLegend: "demo highlight",

  weatherSignals: "Weather & Store-Area Signals",
  weatherSub: "Micro-local observations interpolated to store coordinates",
  temperature: "Temperature",
  feelsLike: "Feels",
  humidity: "Humidity",
  pressure: "Pressure",
  pressureTrend: "Pressure trend",
  wind: "Wind",
  rain1h: "Rain (1h)",
  cloudCover: "Cloud cover",
  lastUpdated: "Last updated",
  derivedRisk: "Derived operational risk scores",
  rainRisk: "Rain risk",
  heatRisk: "Heat risk",
  deliveryDisruption: "Delivery disruption",
  walkInDrop: "Walk-in drop",
  fallbackMode: "Fallback weather mode",
  fallbackDesc: (source) =>
    `Live Open-Meteo API was unavailable. The agent is using a deterministic synthetic signal derived from the store profile, season & time of day. Risk scores are directional only — re-run when connectivity restores. Source: ${source}`,
  rainLikely: "rain likely",
  clearing: "clearing",
  stable: "stable",

  dailyActionPlan: "Daily StoreOps Action Plan",
  targeting: (date, generated) => `Targeting ${date} · generated ${generated}`,
  storeRiskSummary: "Store risk summary",
  slotPlans: "Slot plans",
  recommendations: "Recommendations",
  prep: "Prep",
  inventory: "Inventory",
  staffing: "Staffing",
  deliveryReadiness: "Delivery readiness",
  campaign: "Campaign",
  wasteRisk: "Waste risk",
  stockoutRisk: "Stockout risk",
  serviceDelay: "Service delay",
  lunch: "Lunch",
  dinner: "Dinner",
  walkInDelta: "Walk-in delta",
  deliveryDelta: "Delivery delta",
  prepBatchDelta: "Prep batch delta",
  packagingDelta: "Packaging delta",
  staffingDelta: "Staffing delta",
  warnings: "Warnings",
  overallRisk: "Overall risk",

  agentTrace: "Agent Execution Trace",
  agentFlow: "Agent flow",
  agentsLabel: (n) => `${n} agents`,
  total: "total",
  inputUsed: "Input used",
  outputGenerated: "Output generated",
  structuredOutput: "Structured output (JSON)",
  step: "STEP",
  conf: "conf",
  live: "LIVE",
  fallback: "FALLBACK",

  beforeVsAfter: "Without Agent vs With Agent",
  beforeVsAfterSub:
    "Simulated operational impact of using store-specific agentic planning vs generic city-level weather intuition.",
  withoutAgent: "Without agent",
  withAgent: "With agent",
  methodology: "Methodology",

  managerBriefing: "Manager Briefing",
  briefingSub: "30-second shift-ready summary",
  headline: "Headline",
  tldr: "TL;DR",
  topActions: "Top actions (priority order)",
  watchItems: "Watch items during shift",
  closingNote: "Closing note",
  highConfidence: "High confidence",
  mediumConfidence: "Medium confidence",
  lowConfidence: "Low confidence",
  confidence: "confidence",
  exportMd: "Export .md",
  exporting: "Exporting…",

  multiStoreCompare: "Multi-Store Comparison",
  multiStoreCompareSub:
    "Side-by-side: the same agentic pipeline applied to different store contexts → different operational decisions.",
  clearComparison: "Clear comparison",
  addToComparison: "Add to comparison",
  alreadyInCompare: "This store is already in the comparison.",
  compareFull: "Comparison supports up to 4 stores.",
  compareDemoStory:
    "Demo story: notice how an urban CBD store, a residential store, and an outer suburban store receive materially different prep, staffing & campaign recommendations from the same agent pipeline — because their store type, delivery share, and rider-distance risk differ. That is the hyperlocal value.",

  whyAgentic: "Why this is agentic — not just a dashboard",
  whyAgenticSub:
    "Weather apps tell managers what the weather may be. This agent tells each F&B store what to do because of local weather risk.",
  agentFlow2: "Agent flow",
  eightAgents: "Eight specialized agents",
  notAChatbot: "Not a chatbot",
  notAChatbotDesc:
    "The agent doesn't wait for questions. It observes signals, runs a multi-step workflow, calls data APIs, and produces a decision.",
  notAForecast: "Not a forecast",
  notAForecastDesc:
    "It doesn't predict weather better than weather apps. It converts any weather signal into store-level operations decisions — that's the value.",
  honestAboutData: "Honest about data",
  honestAboutDataDesc:
    "Every output labels its source (live / fallback / computed / LLM), confidence, and timestamp. Fallback mode is surfaced, never hidden.",

  dataSources: "Data Sources & Confidence",
  dataSourcesSub:
    "Every signal is traced to a registered source with mode, freshness, confidence and fallback strategy.",
  storeSource: "Store source",
  locationSource: "Location source",
  weatherSource: "Weather source",
  rainEvidence: "Rain evidence",
  historicalSource: "Historical source",
  aviationBaseline: "Aviation baseline",
  operationsData: "Operations data",
  source: "Source",
  mode: "Mode",
  purpose: "Purpose",
  fallbackStrategy: "Fallback strategy",
  reliabilityNote: "Reliability note",
  usedIn: "Used in",
  freshness: "Freshness",

  riskLow: "low",
  riskMedium: "medium",
  riskHigh: "high",
  riskCritical: "critical",

  footerDisclaimer:
    "Agent CaMate — Agentic AI Build Week 2026 pilot-oriented prototype. Not an official KFC product.",
  footerData: "Data: Open-Meteo (live) · fallback (synthetic)",
  footerLlm: "LLM provider: Optional",
  footerMap: "Map: Google Maps",

  toastAgentRunning:
    "Agent pipeline running — observing → collecting → analyzing → planning → recommending → explaining…",
  toastPlanReady: (store, live, ms) =>
    `Plan ready for ${store} · ${live ? "live data" : "fallback mode"} · ${ms}ms`,
  toastAgentFailed: "Agent run failed",
  toastAddedToCompare: (store, n) => `Added ${store} to comparison (${n}/4).`,
  toastAlreadyInCompare: "This store is already in the comparison.",
  toastCompareFull: "Comparison supports up to 4 stores.",
  toastCompared: (n) => `Compared ${n} stores — see how plans differ by location.`,
  toastCompareFailed: "Compare failed",
  toastExported: "Manager briefing exported as Markdown",
  toastExportFailed: "Export failed",
};

const vi: Dictionary = {
  productName: "Agent CaMate",
  productTagline: "Trợ lý đồng quản lý ca cho cửa hàng KFC · Agentic AI Build Week 2026",
  cityStores: (n) => `TP. Hồ Chí Minh · ${n} cửa hàng`,
  agentPipeline: "Luồng 8 agent",
  rerunAgent: "Tạo kế hoạch vận hành",
  rerunning: "Đang chạy…",
  language: "Ngôn ngữ",

  heroLine1: "Agent CaMate không phải chatbot và không phải dashboard thời tiết.",
  heroLine2: "Đây là trợ lý AI đồng quản lý ca, giúp biến tín hiệu thời tiết và vận hành thành kế hoạch có bằng chứng.",
  heroDesc:
    "Bản prototype định hướng pilot. Chọn cửa hàng KFC. Agent CaMate quan sát thời tiết + dữ liệu vận hành, suy luận thay đổi nhu cầu, lập kế hoạch nhập hàng/nhân sự/giao hàng/chiến dịch, kiểm chứng chất lượng dữ liệu, và tạo kế hoạch hành động có bằng chứng, cần quản lý duyệt trước khi thực thi.",
  run3StoreCompare: "So sánh 3 cửa hàng demo",
  running3Store: "Đang chạy…",
  demoStory: "Đô thị · Dân cư · Ngoại ô",

  selectStore: "Chọn cửa hàng",
  storeCount: (n) => `${n} cửa hàng KFC đã seed tại TP.HCM`,
  searchPlaceholder: "Tìm theo tên, quận, hoặc loại hình…",
  clearSearch: "Xóa tìm kiếm",
  noStoresMatch: (q) => `Không có cửa hàng nào khớp “${q}”.`,
  selectThisStore: "Chọn cửa hàng này →",
  deliveryShare: "giao hàng",
  seats: "chỗ ngồi",
  batchesPerHr: "mẻ/giờ",
  demoHighlight: "demo",

  storeNetworkMap: "Bản đồ mạng lưới cửa hàng",
  store: "cửa hàng",
  demoHighlightLegend: "demo nổi bật",

  weatherSignals: "Tín hiệu thời tiết & khu vực cửa hàng",
  weatherSub: "Quan sát vi mô nội suy theo tọa độ cửa hàng",
  temperature: "Nhiệt độ",
  feelsLike: "Cảm giác",
  humidity: "Độ ẩm",
  pressure: "Áp suất",
  pressureTrend: "Xu hướng áp suất",
  wind: "Gió",
  rain1h: "Mưa (1h)",
  cloudCover: "Mây che",
  lastUpdated: "Cập nhật lúc",
  derivedRisk: "Điểm rủi ro vận hành suy diễn",
  rainRisk: "Rủi ro mưa",
  heatRisk: "Rủi ro nóng",
  deliveryDisruption: "Gián đoạn giao hàng",
  walkInDrop: "Giảm khách vào cửa hàng",
  fallbackMode: "Chế độ dự phòng",
  fallbackDesc: (source) =>
    `API Open-Meteo thời gian thực không khả dụng. Agent đang dùng tín hiệu tổng hợp tất định suy ra từ hồ sơ cửa hàng, mùa và thời gian trong ngày. Điểm rủi ro chỉ mang tính định hướng — chạy lại khi có kết nối. Nguồn: ${source}`,
  rainLikely: "có thể mưa",
  clearing: "trời quang",
  stable: "ổn định",

  dailyActionPlan: "Kế hoạch vận hành hàng ngày",
  targeting: (date, generated) => `Hướng tới ${date} · tạo lúc ${generated}`,
  storeRiskSummary: "Tóm tắt rủi ro cửa hàng",
  slotPlans: "Kế hoạch theo khung giờ",
  recommendations: "Khuyến nghị",
  prep: "Prep bếp",
  inventory: "Tồn kho",
  staffing: "Điều phối nhân sự",
  deliveryReadiness: "Sẵn sàng giao hàng",
  campaign: "Chiến dịch",
  wasteRisk: "Rủi ro hao hụt",
  stockoutRisk: "Rủi ro tồn kho",
  serviceDelay: "Chậm dịch vụ",
  lunch: "Trưa",
  dinner: "Tối",
  walkInDelta: "Biến động khách vào cửa hàng",
  deliveryDelta: "Biến động giao hàng",
  prepBatchDelta: "Biến động mẻ prep",
  packagingDelta: "Biến động bao bì",
  staffingDelta: "Biến động điều phối nhân sự",
  warnings: "Cảnh báo",
  overallRisk: "Rủi ro tổng thể",

  agentTrace: "Nhật ký kỹ thuật",
  agentFlow: "Luồng agent",
  agentsLabel: (n) => `${n} agent`,
  total: "tổng",
  inputUsed: "Đầu vào sử dụng",
  outputGenerated: "Đầu ra sinh ra",
  structuredOutput: "Đầu ra có cấu trúc (JSON)",
  step: "BƯỚC",
  conf: "độ tin cậy",
  live: "LIVE",
  fallback: "CHẾ ĐỘ DỰ PHÒNG",

  beforeVsAfter: "Không có Agent vs Có Agent",
  beforeVsAfterSub:
    "Mô phỏng tác động vận hành khi dùng kế hoạch agentic theo từng cửa hàng so với trực giác từ thời tiết cấp thành phố chung.",
  withoutAgent: "Không có agent",
  withAgent: "Có agent",
  methodology: "Phương pháp",

  managerBriefing: "Tóm tắt cho quản lý",
  briefingSub: "Tóm tắt sẵn sàng cho ca làm việc trong 30 giây",
  headline: "Tiêu đề",
  tldr: "Tóm tắt nhanh",
  topActions: "Hành động ưu tiên (theo thứ tự)",
  watchItems: "Cần theo dõi trong ca",
  closingNote: "Ghi chú kết",
  highConfidence: "Độ tin cậy cao",
  mediumConfidence: "Độ tin cậy trung bình",
  lowConfidence: "Độ tin cậy thấp",
  confidence: "độ tin cậy",
  exportMd: "Xuất .md",
  exporting: "Đang xuất…",

  multiStoreCompare: "So sánh nhiều cửa hàng",
  multiStoreCompareSub:
    "Song song: cùng một luồng agentic áp dụng cho các bối cảnh cửa hàng khác nhau → quyết định vận hành khác nhau.",
  clearComparison: "Xóa so sánh",
  addToComparison: "Thêm vào so sánh",
  alreadyInCompare: "Cửa hàng này đã có trong so sánh.",
  compareFull: "So sánh hỗ trợ tối đa 4 cửa hàng.",
  compareDemoStory:
    "Câu chuyện demo: một cửa hàng đô thị CBD, một cửa hàng dân cư, và một cửa hàng ngoại ô sẽ nhận được khuyến nghị prep, nhân sự và chiến dịch khác nhau từ cùng một luồng agent — vì loại hình, tỷ trọng delivery và rủi ro khoảng cách rider khác nhau. Đó là giá trị theo từng khu vực/cửa hàng.",

  whyAgentic: "Vì sao đây là agentic — không chỉ là dashboard",
  whyAgenticSub:
    "App thời tiết cho quản lý biết thời tiết có thể ra sao. Agent này cho mỗi cửa hàng F&B biết phải làm gì vì rủi ro thời tiết địa phương.",
  agentFlow2: "Luồng agent",
  eightAgents: "Tám agent chuyên biệt",
  notAChatbot: "Không phải chatbot",
  notAChatbotDesc:
    "Agent không chờ câu hỏi. Nó quan sát tín hiệu, chạy luồng nhiều bước, gọi API dữ liệu và đưa ra quyết định.",
  notAForecast: "Không phải dự báo",
  notAForecastDesc:
    "Nó không dự báo thời tiết giỏi hơn app thời tiết. Nó chuyển mọi tín hiệu thời tiết thành quyết định vận hành cấp cửa hàng — đó mới là giá trị.",
  honestAboutData: "Minh bạch về dữ liệu",
  honestAboutDataDesc:
    "Mọi đầu ra đều ghi nguồn (live / dự phòng / tính toán / LLM), độ tin cậy và mốc thời gian. Chế độ dự phòng được hiển thị rõ, không bao giờ giấu.",

  dataSources: "Nguồn dữ liệu & độ tin cậy",
  dataSourcesSub:
    "Mọi tín hiệu đều được truy về nguồn đã đăng ký kèm chế độ, độ tươi, độ tin cậy và chiến lược dự phòng.",
  storeSource: "Nguồn cửa hàng",
  locationSource: "Nguồn tọa độ",
  weatherSource: "Nguồn thời tiết",
  rainEvidence: "Bằng chứng mưa",
  historicalSource: "Nguồn lịch sử",
  aviationBaseline: "Baseline hàng không",
  operationsData: "Dữ liệu vận hành",
  source: "Nguồn",
  mode: "Chế độ",
  purpose: "Mục đích",
  fallbackStrategy: "Chiến lược dự phòng",
  reliabilityNote: "Ghi chú độ tin cậy",
  usedIn: "Dùng trong",
  freshness: "Độ tươi",

  riskLow: "thấp",
  riskMedium: "trung bình",
  riskHigh: "cao",
  riskCritical: "nghiêm trọng",

  footerDisclaimer:
    "Agent CaMate — bản prototype định hướng pilot cho Agentic AI Build Week 2026. Không phải sản phẩm chính thức của KFC.",
  footerData: "Dữ liệu: Open-Meteo (live) · dự phòng (tổng hợp)",
  footerLlm: "LLM: Tùy chọn",
  footerMap: "Bản đồ: Google Maps",

  toastAgentRunning:
    "Luồng agent đang chạy — quan sát → thu thập → phân tích → lập kế hoạch → khuyến nghị → giải thích…",
  toastPlanReady: (store, live, ms) =>
    `Kế hoạch sẵn sàng cho ${store} · ${live ? "dữ liệu live" : "chế độ dự phòng"} · ${ms}ms`,
  toastAgentFailed: "Chạy agent thất bại",
  toastAddedToCompare: (store, n) => `Đã thêm ${store} vào so sánh (${n}/4).`,
  toastAlreadyInCompare: "Cửa hàng này đã có trong so sánh.",
  toastCompareFull: "So sánh hỗ trợ tối đa 4 cửa hàng.",
  toastCompared: (n) => `Đã so sánh ${n} cửa hàng — xem kế hoạch khác nhau theo địa điểm.`,
  toastCompareFailed: "So sánh thất bại",
  toastExported: "Đã xuất tóm tắt quản lý dạng Markdown",
  toastExportFailed: "Xuất thất bại",
};

export const dictionaries: Record<Lang, Dictionary> = { en, vi };
