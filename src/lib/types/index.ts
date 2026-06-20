// Shared domain types for the Agent CaMate.

import type { KfcStore } from "@/lib/stores/seed-stores";

export type { KfcStore, StoreType, RiskProfile, DemandProfile } from "@/lib/stores/seed-stores";

/** A single weather/store-area signal bundle for one store. */
export interface WeatherSignal {
  storeId: string;
  lat: number;
  lng: number;
  // Raw observations
  temperatureC: number;
  apparentTempC: number;
  humidity: number; // %
  pressureHpa: number;
  pressureTrend: "rising" | "falling" | "stable";
  windSpeedKmh: number;
  windDir: number;
  precipitationMm: number; // last hour
  cloudCover: number; // %
  // Derived risk scores (0-1)
  rainRiskScore: number;
  heatRiskScore: number;
  deliveryDisruptionRisk: number;
  walkInDropRisk: number;
  // Metadata — production-grade provenance
  dataConfidence: number; // 0-1
  isLive: boolean;
  source: string;
  fetchedAt: string; // ISO
  hourlyForecast: HourlyForecastPoint[];
  dailyForecast: DailyForecastPoint[];
  /** Why live data was unavailable (only set in fallback mode). */
  fallbackReason?: string;
  /** Human-readable reliability note shown in the Data Sources panel. */
  reliabilityNote?: string;
}

export interface HourlyForecastPoint {
  time: string; // ISO
  tempC: number;
  precipProb: number; // 0-1
  precipMm: number;
  windKmh: number;
  humidity: number;
}

export interface DailyForecastPoint {
  date: string; // ISO date
  tempMaxC: number;
  tempMinC: number;
  precipProb: number;
  precipSumMm: number;
  windMaxKmh: number;
}

/** One step in the agent execution trace. */
export interface AgentStep {
  step: number;
  agentName: string;
  agentRole: string;
  phase:
    | "observe"
    | "collect"
    | "analyze"
    | "classify"
    | "diagnose"
    | "simulate"
    | "plan"
    | "decide"
    | "recommend"
    | "automate"
    | "approval"
    | "execute"
    | "learn"
    | "explain";
  input: string; // human-readable summary of input used
  output: string; // human-readable summary of output generated
  structuredOutput?: Record<string, unknown>;
  confidence: number; // 0-1
  timestamp: string; // ISO
  dataSource: "live" | "fallback" | "computed" | "llm";
  durationMs: number;
  status: "running" | "done" | "error";
}

export interface RiskExplanation {
  factor: string;
  weight: number; // 0-1 contribution
  reasoning: string;
}

export interface SlotPlan {
  slot: "lunch" | "dinner";
  windowLabel: string; // e.g. "11:30–13:30"
  expectedWalkInDelta: number; // signed % vs baseline
  expectedDeliveryDelta: number; // signed % vs baseline
  prepBatchDelta: number; // signed % vs baseline
  staffingDelta: number; // signed headcount delta
  packagingDelta: number; // signed % vs baseline (delivery packaging)
  warnings: string[];
  baselineLunchOrders?: number;
  baselineDinnerOrders?: number;
}

export interface ActionPlan {
  storeId: string;
  storeName: string;
  generatedAt: string;
  planningDate: string; // ISO date the plan targets
  overallRisk: number; // 0-1
  confidence: number; // 0-1
  storeRiskSummary: string;
  slots: SlotPlan[];
  inventoryRecommendation: string;
  prepRecommendation: string;
  staffingRecommendation: string;
  deliveryReadiness: string;
  campaignRecommendation: string;
  wasteWarnings: string[];
  stockoutWarnings: string[];
  serviceDelayWarnings: string[];
  risks: RiskExplanation[];
}

export interface BeforeAfterMetric {
  key: string;
  label: string;
  withoutAgent: number;
  withAgent: number;
  unit: string;
  betterIs: "lower" | "higher";
  explanation: string;
}

export interface ManagerBriefing {
  storeId: string;
  storeName: string;
  generatedAt: string;
  headline: string;
  tldr: string[];
  topActions: string[];
  watchItems: string[];
  confidenceLabel: "low" | "medium" | "high";
  closingNote: string;
  /** Bilingual (English) headline — kept alongside the primary (which may be bilingual). */
  headlineVi?: string;
  tldrVi?: string[];
  topActionsVi?: string[];
  watchItemsVi?: string[];
  closingNoteVi?: string;
}

export interface WeatherProvenance {
  primarySource: string;
  primaryMode: "live" | "fallback";
  contributors: {
    sourceId: string;
    sourceName: string;
    mode: string;
    contributed: boolean;
    note?: string;
  }[];
}

export interface AgentRunResult {
  storeId: string;
  storeName: string;
  trace: AgentStep[];
  plan: ActionPlan;
  briefing: ManagerBriefing;
  beforeAfter: BeforeAfterMetric[];
  weather: WeatherSignal;
  weatherProvenance: WeatherProvenance;
  isLive: boolean;
  generatedAt: string;
  totalDurationMs: number;
  serverDurationMs?: number;
}

export interface StoreWithContext extends KfcStore {
  contextNotes: string;
  customerBehavior: string;
  peakWindows: string[];
}
