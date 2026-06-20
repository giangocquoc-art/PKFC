// Store Operating Profile
// =======================
// Before any decision agent runs, the system builds a Store Operating Profile
// that classifies the store, its key time windows, primary sales channels,
// principal operational risks, and the data that must be monitored. Every
// downstream agent (Demand, Inventory, Staffing, Campaign, Task Automation,
// Risk Intelligence) consumes this profile so decisions are tailored to the
// store type — not generic.

import type { KfcStore, StoreType } from "@/lib/stores/seed-stores";

export type OperatingStoreType =
  | "urban-center"
  | "mall"
  | "residential"
  | "commuter"
  | "suburban";

export interface TimeWindow {
  id: string;
  label: string;
  startHour: number; // 0-23
  endHour: number;
  intensity: "peak" | "high" | "moderate" | "low" | "prep";
  focus: string;
}

export type SalesChannel = "dine-in" | "takeaway" | "delivery" | "online-order";

export interface ChannelMix {
  channel: SalesChannel;
  share: number; // 0-1 baseline
  weatherSensitivity: "high" | "medium" | "low";
  note: string;
}

export interface StoreRisk {
  id: string;
  label: string;
  baseProbability: number; // 0-1 baseline
  weatherAmplifier: number; // multiplier on weather risk
  description: string;
}

export interface MonitoredMetric {
  id: string;
  label: string;
  source: string; // adapter id
  freshness: string; // expected freshness
  required: boolean;
}

export interface StoreOperatingProfile {
  storeId: string;
  storeName: string;
  storeType: StoreType;
  operatingType: OperatingStoreType;
  timeWindows: TimeWindow[];
  channelMix: ChannelMix[];
  primaryChannels: SalesChannel[];
  keyRisks: StoreRisk[];
  monitoredMetrics: MonitoredMetric[];
  operatingRules: string[]; // store-type-specific operating rules
  prepPhilosophy: string;
  campaignBias: string;
  generatedAt: string;
}

/** Map the seed store type to the richer operating type. */
export function toOperatingType(storeType: StoreType): OperatingStoreType {
  switch (storeType) {
    case "urban-street":
      return "urban-center";
    case "office-area":
      return "urban-center"; // office-area stores behave like urban-center with lunch skew
    case "mall":
      return "mall";
    case "residential":
      return "residential";
    case "suburban":
      return "suburban";
    default:
      return "residential";
  }
}

const URBAN_CENTER_WINDOWS: TimeWindow[] = [
  { id: "morning-prep", label: "Morning prep", startHour: 7, endHour: 10, intensity: "prep", focus: "Initial batch + station setup" },
  { id: "lunch-peak", label: "Lunch peak", startHour: 11, endHour: 13, intensity: "peak", focus: "Office worker walk-in surge + delivery" },
  { id: "afternoon-low", label: "Afternoon low", startHour: 14, endHour: 17, intensity: "low", focus: "Clean-down + light prep" },
  { id: "dinner-peak", label: "Dinner peak", startHour: 18, endHour: 20, intensity: "high", focus: "Mixed walk-in + delivery" },
  { id: "late-close", label: "Late evening close", startHour: 21, endHour: 22, intensity: "moderate", focus: "Wind-down + waste log" },
];

const MALL_WINDOWS: TimeWindow[] = [
  { id: "morning-prep", label: "Morning prep", startHour: 9, endHour: 10, intensity: "prep", focus: "Open with mall" },
  { id: "lunch-peak", label: "Lunch peak", startHour: 11, endHour: 13, intensity: "peak", focus: "Mall shopper dine-in" },
  { id: "afternoon-low", label: "Afternoon steady", startHour: 14, endHour: 17, intensity: "moderate", focus: "Shelter effect — rain pushes footfall UP" },
  { id: "dinner-peak", label: "Dinner peak", startHour: 18, endHour: 21, intensity: "peak", focus: "Family dine-in heavy" },
  { id: "late-close", label: "Mall close", startHour: 21, endHour: 22, intensity: "low", focus: "Close with mall" },
];

const RESIDENTIAL_WINDOWS: TimeWindow[] = [
  { id: "morning-prep", label: "Morning prep", startHour: 8, endHour: 10, intensity: "prep", focus: "Light prep, low morning demand" },
  { id: "lunch-peak", label: "Lunch moderate", startHour: 11, endHour: 13, intensity: "moderate", focus: "Local walk-in + some delivery" },
  { id: "afternoon-low", label: "Afternoon low", startHour: 14, endHour: 17, intensity: "low", focus: "Light delivery" },
  { id: "dinner-peak", label: "Dinner peak", startHour: 18, endHour: 21, intensity: "peak", focus: "Returning residents + family delivery" },
  { id: "late-close", label: "Late evening", startHour: 21, endHour: 22, intensity: "moderate", focus: "Late delivery tail" },
];

const SUBURBAN_WINDOWS: TimeWindow[] = [
  { id: "morning-prep", label: "Morning prep", startHour: 8, endHour: 10, intensity: "prep", focus: "Prep + confirm replenishment" },
  { id: "lunch-peak", label: "Lunch moderate", startHour: 11, endHour: 13, intensity: "moderate", focus: "Delivery-dominant" },
  { id: "afternoon-low", label: "Afternoon low", startHour: 14, endHour: 17, intensity: "low", focus: "Monitor replenishment" },
  { id: "dinner-peak", label: "Dinner peak", startHour: 18, endHour: 21, intensity: "peak", focus: "Delivery + family orders" },
  { id: "late-close", label: "Late evening", startHour: 21, endHour: 22, intensity: "low", focus: "Close + next-day replenishment request" },
];

function windowsFor(type: OperatingStoreType): TimeWindow[] {
  switch (type) {
    case "urban-center":
      return URBAN_CENTER_WINDOWS;
    case "mall":
      return MALL_WINDOWS;
    case "residential":
      return RESIDENTIAL_WINDOWS;
    case "suburban":
      return SUBURBAN_WINDOWS;
    default:
      return RESIDENTIAL_WINDOWS;
  }
}

function channelMixFor(store: KfcStore, type: OperatingStoreType): ChannelMix[] {
  const delivery = store.deliveryShare;
  const dineIn = type === "mall" ? 0.5 : type === "urban-center" ? 0.4 : 0.3;
  const takeaway = Math.max(0.1, 1 - delivery - dineIn - 0.05);
  const online = 0.05;
  const base: ChannelMix[] = [
    {
      channel: "dine-in",
      share: dineIn,
      weatherSensitivity: type === "mall" ? "low" : "high",
      note:
        type === "mall"
          ? "Shelter effect — rain can push footfall up"
          : type === "urban-center"
            ? "Rain collapses walk-in sharply"
            : "Moderate walk-in, dinner-skewed",
    },
    {
      channel: "takeaway",
      share: takeaway,
      weatherSensitivity: "medium",
      note: "Commuter pickup — rain slightly reduces",
    },
    {
      channel: "delivery",
      share: delivery,
      weatherSensitivity: type === "suburban" ? "high" : "medium",
      note:
        type === "suburban"
          ? "Long rider distances — rain = severe delay"
          : "Rain drives delivery surge but rider dispatch strains",
    },
    {
      channel: "online-order",
      share: online,
      weatherSensitivity: "low",
      note: "App pre-order — stable",
    },
  ];
  return base;
}

function risksFor(store: KfcStore, type: OperatingStoreType): StoreRisk[] {
  const risks: StoreRisk[] = [
    {
      id: "over-prep",
      label: "Over-prep / waste (prep too early)",
      baseProbability: type === "urban-center" ? 0.35 : type === "mall" ? 0.2 : 0.28,
      weatherAmplifier: 1.6,
      description: "Frying large batches before confirmed demand leads to waste when walk-in drops.",
    },
    {
      id: "stockout",
      label: "Stockout from delivery surge",
      baseProbability: 0.25 + store.deliveryShare * 0.2,
      weatherAmplifier: 1.8,
      description: "Delivery spike depletes high-demand SKUs (buckets, combos) before replenishment.",
    },
    {
      id: "understaff-peak",
      label: "Understaffing at peak",
      baseProbability: type === "urban-center" ? 0.3 : 0.22,
      weatherAmplifier: 1.4,
      description: "Staffing follows yesterday's pattern; delivery surge needs packing staff.",
    },
    {
      id: "delivery-delay",
      label: "Delivery delay (rain/traffic)",
      baseProbability: type === "suburban" ? 0.45 : type === "commuter" ? 0.35 : 0.25,
      weatherAmplifier: 2.0,
      description: "Rain + traffic slows rider dispatch; ETA breaches rise.",
    },
    {
      id: "wrong-campaign-channel",
      label: "Wrong campaign channel (dine-in push in rain)",
      baseProbability: 0.2,
      weatherAmplifier: 1.5,
      description: "Pushing dine-in discount during rain wastes campaign spend; delivery combo wins.",
    },
    {
      id: "complaint-slow",
      label: "Customer complaints (slow/missing items)",
      baseProbability: 0.18,
      weatherAmplifier: 1.7,
      description: "Service delay + stockout → complaints, refunds, churn.",
    },
  ];
  return risks;
}

const MONITORED_METRICS: MonitoredMetric[] = [
  { id: "weather", label: "Weather / store-area signals", source: "open-meteo", freshness: "5 min", required: true },
  { id: "walk-in", label: "Walk-in orders", source: "pos-data", freshness: "1 min", required: true },
  { id: "delivery", label: "Delivery orders", source: "delivery-data", freshness: "1 min", required: true },
  { id: "takeaway", label: "Takeaway orders", source: "pos-data", freshness: "1 min", required: true },
  { id: "inventory", label: "Inventory level", source: "inventory-data", freshness: "5 min", required: true },
  { id: "batch-prep", label: "Batch prep", source: "kitchen-data", freshness: "5 min", required: false },
  { id: "waste", label: "Waste", source: "waste-log", freshness: "15 min", required: true },
  { id: "stockout", label: "Stockout", source: "inventory-data", freshness: "5 min", required: true },
  { id: "staff", label: "Staff schedule", source: "staffing-data", freshness: "1 hr", required: true },
  { id: "service-time", label: "Average service time", source: "pos-data", freshness: "5 min", required: true },
  { id: "complaints", label: "Customer complaints", source: "complaint-data", freshness: "15 min", required: false },
  { id: "refund", label: "Refund / cancel reason", source: "complaint-data", freshness: "15 min", required: false },
];

function operatingRulesFor(type: OperatingStoreType): string[] {
  switch (type) {
    case "urban-center":
      return [
        "Prioritise lunch peak (11:30–13:00) — office worker surge.",
        "Monitor walk-in drop when rain; do NOT over-prep before 10:45.",
        "Watch delivery surge — pre-stage rider packaging.",
        "Briefing must cover lunch explicitly.",
      ];
    case "mall":
      return [
        "Rain does NOT necessarily reduce walk-in — shelter effect.",
        "Do not cut prep aggressively just because of rain.",
        "Campaign can favour dine-in family bundles.",
        "Monitor mall traffic pattern (simulated in this build).",
      ];
    case "residential":
      return [
        "Prioritise dinner (18:00–21:00) and delivery.",
        "Increase delivery packaging if afternoon/evening rain.",
        "Watch family combo orders at dinner.",
        "Staff plan must prioritise packing + kitchen for dinner.",
      ];
    case "commuter":
      return [
        "Monitor rush hour, traffic, delivery delay.",
        "Takeaway campaign can be effective.",
        "Staffing flexible across counter + packing.",
      ];
    case "suburban":
      return [
        "Watch stockout risk — replenishment is slow.",
        "Do not drop inventory too low.",
        "Delivery delay risk is the dominant concern.",
      ];
    default:
      return [];
  }
}

function prepPhilosophyFor(type: OperatingStoreType): string {
  switch (type) {
    case "urban-center":
      return "Smaller early batches, refresh toward confirmed lunch demand. Never fry a full batch before 10:45.";
    case "mall":
      return "Steady batches aligned to mall footfall; rain does not justify aggressive cuts.";
    case "residential":
      return "Light morning prep, build toward dinner; keep delivery packaging buffer.";
    case "commuter":
      return "Batch around rush hours; keep takeaway packaging ready.";
    case "suburban":
      return "Conservative — maintain inventory floor, batch for dinner delivery, confirm replenishment early.";
    default:
      return "Standard prep cadence.";
  }
}

function campaignBiasFor(type: OperatingStoreType): string {
  switch (type) {
    case "urban-center":
      return "Rain → delivery + takeaway combo; suppress dine-in discount.";
    case "mall":
      return "Rain → dine-in family bundles (shelter effect).";
    case "residential":
      return "Rain → delivery family combo + app push.";
    case "commuter":
      return "Rain → takeaway combo + delivery.";
    case "suburban":
      return "Rain → delivery combo; manage ETA expectations.";
    default:
      return "Balanced.";
  }
}

/** Build the Store Operating Profile for a store. */
export function buildStoreOperatingProfile(store: KfcStore): StoreOperatingProfile {
  const operatingType = toOperatingType(store.storeType);
  return {
    storeId: store.id,
    storeName: store.name,
    storeType: store.storeType,
    operatingType,
    timeWindows: windowsFor(operatingType),
    channelMix: channelMixFor(store, operatingType),
    primaryChannels: channelMixFor(store, operatingType)
      .sort((a, b) => b.share - a.share)
      .slice(0, 2)
      .map((c) => c.channel),
    keyRisks: risksFor(store, operatingType),
    monitoredMetrics: MONITORED_METRICS,
    operatingRules: operatingRulesFor(operatingType),
    prepPhilosophy: prepPhilosophyFor(operatingType),
    campaignBias: campaignBiasFor(operatingType),
    generatedAt: new Date().toISOString(),
  };
}

export const OPERATING_TYPE_LABELS: Record<OperatingStoreType, string> = {
  "urban-center": "Urban Center",
  mall: "Mall Store",
  residential: "Residential Store",
  commuter: "Commuter Store",
  suburban: "Suburban / Outer Store",
};
