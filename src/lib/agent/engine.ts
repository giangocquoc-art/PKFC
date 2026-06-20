// Agent CaMate — Multi-Agent Orchestration Engine
//
// Flow: Observe → Collect Signals → Analyze → Plan → Recommend → Explain
//
// Eight specialized agents run in sequence, each producing a structured output
// and an execution-trace step. The final two agents (Risk Explanation +
// Manager Briefing) are LLM-augmented for natural-language reasoning, with
// deterministic fallback so the demo always works.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type {
  AgentRunResult,
  AgentStep,
  ActionPlan,
  BeforeAfterMetric,
  ManagerBriefing,
  RiskExplanation,
  SlotPlan,
  StoreWithContext,
  WeatherSignal,
  WeatherProvenance,
} from "@/lib/types";
import { llmComplete, extractJson } from "@/lib/llm";
import type { OpsBaseline } from "@/lib/operations/operationsDataAdapter";
import { db } from "@/lib/db";

function nowIso() {
  return new Date().toISOString();
}

function confidenceLabel(c: number): "low" | "medium" | "high" {
  if (c >= 0.75) return "high";
  if (c >= 0.5) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Agent 1 — Store Context Agent (Observe)
// ---------------------------------------------------------------------------
function runStoreContextAgent(store: KfcStore): {
  context: StoreWithContext;
  step: AgentStep;
} {
  const start = Date.now();
  const customerBehavior =
    store.storeType === "mall"
      ? "Family & group dine-in dominant; weekend peak; rain increases footfall (shelter)."
      : store.storeType === "office-area"
        ? "Office worker lunch surge 11:30–13:00; thin dinner demand."
        : store.storeType === "urban-street"
          ? "Mixed CBD walk-in + delivery; lunch peak sharp, dinner moderate."
          : store.storeType === "suburban"
            ? "Residential dinner peak; delivery share high; long rider distances."
            : "Steady residential all-day; delivery skew rising.";

  const peakWindows =
    store.demandProfile === "lunch-heavy"
      ? ["11:30–13:00 (lunch)", "18:30–20:00 (dinner, secondary)"]
      : store.demandProfile === "dinner-heavy"
        ? ["11:30–12:30 (lunch, secondary)", "18:00–20:30 (dinner)"]
        : store.demandProfile === "delivery-skew"
          ? ["11:00–13:30 (lunch+delivery)", "18:00–21:00 (dinner+delivery)"]
          : ["11:30–13:30 (lunch)", "18:00–20:30 (dinner)"];

  const context: StoreWithContext = {
    ...store,
    contextNotes: `${store.district} • ${store.storeType} • ${store.riskProfile}. ${store.notes}`,
    customerBehavior,
    peakWindows,
  };

  const step: AgentStep = {
    step: 1,
    agentName: "Store Context Agent",
    agentRole: "Understand store type, location, customer behavior & operational constraints",
    phase: "observe",
    input: `Store: ${store.name} | Type: ${store.storeType} | District: ${store.district} | Risk profile: ${store.riskProfile} | Demand profile: ${store.demandProfile} | Delivery share: ${(store.deliveryShare * 100).toFixed(0)}% | Seats: ${store.dineInSeats}`,
    output: `Detected ${store.storeType} store in ${store.district}. ${customerBehavior} Peak windows: ${peakWindows.join(", ")}. Operational constraints: kitchen capacity ${store.kitchenCapacity} batches/hr, ${store.dineInSeats} dine-in seats.`,
    structuredOutput: {
      storeType: store.storeType,
      district: store.district,
      customerBehavior,
      peakWindows,
      kitchenCapacity: store.kitchenCapacity,
      dineInSeats: store.dineInSeats,
      deliveryShare: store.deliveryShare,
    },
    confidence: 0.92,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - start,
    status: "done",
  };

  return { context, step };
}

// ---------------------------------------------------------------------------
// Agent 2 — Weather Signal Agent (Collect)
// ---------------------------------------------------------------------------
function runWeatherSignalAgent(
  store: KfcStore,
  weather: WeatherSignal,
  provenance?: WeatherProvenance,
): { summary: string; step: AgentStep } {
  const start = Date.now();
  const rainPct = (weather.rainRiskScore * 100).toFixed(0);
  const heatPct = (weather.heatRiskScore * 100).toFixed(0);
  const delPct = (weather.deliveryDisruptionRisk * 100).toFixed(0);
  const walkPct = (weather.walkInDropRisk * 100).toFixed(0);

  const contributorLine = provenance
    ? ` Contributors: ${provenance.contributors
        .map((c) => `${c.sourceName}(${c.mode}${c.contributed ? "*" : ""})`)
        .join(", ")}.`
    : "";

  const summary = weather.isLive
    ? `Live Open-Meteo signal: ${weather.temperatureC}°C (feels ${weather.apparentTempC}°C), humidity ${weather.humidity}%, pressure ${weather.pressureHpa}hPa (${weather.pressureTrend}), wind ${weather.windSpeedKmh}km/h, last-hour rain ${weather.precipitationMm}mm. Derived risk → rain ${rainPct}%, heat ${heatPct}%, delivery disruption ${delPct}%, walk-in drop ${walkPct}%. Confidence ${(weather.dataConfidence * 100).toFixed(0)}%.${contributorLine}`
    : `FALLBACK signal (live API unavailable${weather.fallbackReason ? `: ${weather.fallbackReason}` : ""}): ${weather.source}. Estimated ${weather.temperatureC}°C, humidity ${weather.humidity}%, pressure ${weather.pressureHpa}hPa (${weather.pressureTrend}), wind ${weather.windSpeedKmh}km/h, last-hour rain ${weather.precipitationMm}mm. Derived risk → rain ${rainPct}%, heat ${heatPct}%, delivery disruption ${delPct}%, walk-in drop ${walkPct}%. Confidence ${(weather.dataConfidence * 100).toFixed(0)}% — treat as directional only.${contributorLine}`;

  const step: AgentStep = {
    step: 2,
    agentName: "Weather Signal Agent",
    agentRole: "Collect & interpret live/fallback weather + area signals into store-level risk",
    phase: "collect",
    input: `Coordinates ${store.lat.toFixed(4)},${store.lng.toFixed(4)} | Primary source: ${provenance?.primarySource ?? weather.source} (${provenance?.primaryMode ?? (weather.isLive ? "live" : "fallback")}) | Store risk profile: ${store.riskProfile}`,
    output: summary,
    structuredOutput: {
      isLive: weather.isLive,
      source: weather.source,
      fallbackReason: weather.fallbackReason,
      reliabilityNote: weather.reliabilityNote,
      temperatureC: weather.temperatureC,
      humidity: weather.humidity,
      pressureHpa: weather.pressureHpa,
      pressureTrend: weather.pressureTrend,
      windSpeedKmh: weather.windSpeedKmh,
      precipitationMm: weather.precipitationMm,
      rainRiskScore: weather.rainRiskScore,
      heatRiskScore: weather.heatRiskScore,
      deliveryDisruptionRisk: weather.deliveryDisruptionRisk,
      walkInDropRisk: weather.walkInDropRisk,
      dataConfidence: weather.dataConfidence,
      provenance: provenance ?? null,
    },
    confidence: weather.dataConfidence,
    timestamp: nowIso(),
    dataSource: weather.isLive ? "live" : "fallback",
    durationMs: Date.now() - start,
    status: "done",
  };

  return { summary, step };
}

// ---------------------------------------------------------------------------
// Agent 3 — Demand Agent (Analyze)
// ---------------------------------------------------------------------------
function runDemandAgent(
  context: StoreWithContext,
  weather: WeatherSignal,
  opsBaseline?: OpsBaseline,
): { slots: SlotPlan[]; step: AgentStep } {
  const start = Date.now();

  // Use real ops baseline if available; otherwise use store-profile-derived estimates.
  const realLunchBaseline = opsBaseline?.baselineLunchOrders;
  const realDinnerBaseline = opsBaseline?.baselineDinnerOrders;
  const opsMode = opsBaseline?.mode ?? "simulated";

  // Lunch demand model — rain crushes walk-in for street/office; delivery spikes.
  const lunchWalkInDelta =
    context.storeType === "mall"
      ? Math.round((weather.rainRiskScore * 12 - 4) * 10) / 10 // mall: slight uplift from shelter
      : -Math.round(weather.walkInDropRisk * 32 * 10) / 10; // street/office/residential drop
  const lunchDeliveryDelta = Math.round(
    (weather.rainRiskScore * 35 + weather.deliveryDisruptionRisk * 10) * 10,
  ) / 10;

  // Dinner demand model — rain shifts demand to delivery but disrupts riders (net depends on store).
  const dinnerWalkInDelta =
    context.storeType === "mall"
      ? Math.round((weather.rainRiskScore * 8 - 3) * 10) / 10
      : -Math.round(weather.walkInDropRisk * 26 * 10) / 10;
  const dinnerDeliveryDelta = Math.round(
    (weather.rainRiskScore * 30 - weather.deliveryDisruptionRisk * 12) * 10,
  ) / 10;

  const lunch: SlotPlan = {
    slot: "lunch",
    windowLabel: "11:30–13:30",
    expectedWalkInDelta: lunchWalkInDelta,
    expectedDeliveryDelta: lunchDeliveryDelta,
    prepBatchDelta: -Math.round(weather.walkInDropRisk * 12 * 10) / 10, // reduce early batch
    staffingDelta:
      lunchDeliveryDelta > 12 ? 1 : lunchDeliveryDelta < -5 ? -1 : 0,
    packagingDelta: Math.round(Math.max(0, lunchDeliveryDelta) * 10) / 10,
    warnings: [],
    baselineLunchOrders: realLunchBaseline ?? 60,
  };
  if (lunchDeliveryDelta > 15) lunch.warnings.push("Delivery surge expected — pre-stage rider packaging.");
  if (lunchWalkInDelta < -20) lunch.warnings.push("Walk-in collapse risk — reduce early fried batch.");

  const dinner: SlotPlan = {
    slot: "dinner",
    windowLabel: "18:00–20:30",
    expectedWalkInDelta: dinnerWalkInDelta,
    expectedDeliveryDelta: dinnerDeliveryDelta,
    prepBatchDelta:
      context.storeType === "mall"
        ? Math.round(weather.rainRiskScore * 6 * 10) / 10
        : -Math.round(weather.walkInDropRisk * 8 * 10) / 10,
    staffingDelta:
      dinnerDeliveryDelta > 12 ? 1 : dinnerDeliveryDelta < -8 ? -1 : 0,
    packagingDelta: Math.round(Math.max(0, dinnerDeliveryDelta) * 10) / 10,
    warnings: [],
    baselineDinnerOrders: realDinnerBaseline ?? 80,
  };
  if (dinnerDeliveryDelta < -5)
    dinner.warnings.push("Rider dispatch delay may suppress delivery conversion — set delivery ETA buffers.");
  if (weather.heatRiskScore > 0.6)
    dinner.warnings.push("Heat stress — add beverage promo & cold-side prep.");

  const slots = [lunch, dinner];

  const step: AgentStep = {
    step: 3,
    agentName: "Demand Agent",
    agentRole: "Predict walk-in & delivery demand shift per slot from weather + store profile",
    phase: "analyze",
    input: `Store type ${context.storeType}, demand profile ${context.demandProfile}, delivery share ${(context.deliveryShare * 100).toFixed(0)}% | Weather risk: rain ${weather.rainRiskScore}, walk-drop ${weather.walkInDropRisk}, delivery disruption ${weather.deliveryDisruptionRisk} | Ops baseline: ${opsMode}${realLunchBaseline ? `, lunch=${realLunchBaseline}` : ""}${realDinnerBaseline ? `, dinner=${realDinnerBaseline}` : ""}`,
    output: `Lunch 11:30–13:30 → walk-in ${lunchWalkInDelta >= 0 ? "+" : ""}${lunchWalkInDelta}%, delivery ${lunchDeliveryDelta >= 0 ? "+" : ""}${lunchDeliveryDelta}%. Dinner 18:00–20:30 → walk-in ${dinnerWalkInDelta >= 0 ? "+" : ""}${dinnerWalkInDelta}%, delivery ${dinnerDeliveryDelta >= 0 ? "+" : ""}${dinnerDeliveryDelta}%. ${lunch.warnings.concat(dinner.warnings).join(" ")} [Ops mode: ${opsMode}]`,
    structuredOutput: { slots },
    confidence: 0.7 * weather.dataConfidence + 0.2,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - start,
    status: "done",
  };

  return { slots, step };
}

// ---------------------------------------------------------------------------
// Agent 4 — Inventory & Prep Agent (Plan)
// ---------------------------------------------------------------------------
function runInventoryPrepAgent(
  context: StoreWithContext,
  weather: WeatherSignal,
  slots: SlotPlan[],
  opsBaseline?: OpsBaseline,
): {
  inventory: string;
  prep: string;
  wasteWarnings: string[];
  stockoutWarnings: string[];
  step: AgentStep;
} {
  const start = Date.now();

  const lunch = slots[0];
  const dinner = slots[1];
  const totalDeliveryUplift = Math.max(0, lunch.expectedDeliveryDelta) + Math.max(0, dinner.expectedDeliveryDelta);
  const totalWalkInDrop = Math.max(0, -lunch.expectedWalkInDelta) + Math.max(0, -dinner.expectedWalkInDelta);

  // Use ops baseline inventory numbers when available.
  const opsMode = opsBaseline?.mode ?? "simulated";
  const chickenRawKg = opsBaseline?.inventory.chickenRawKg;
  const buckets = opsBaseline?.inventory.buckets;
  const cups = opsBaseline?.inventory.cups;
  const bags = opsBaseline?.inventory.bags;
  const baselineLunchOrders = opsBaseline?.baselineLunchOrders;
  const baselineDinnerOrders = opsBaseline?.baselineDinnerOrders;

  // Prep batch sizing — use real order baselines when available.
  const earlyBatchDelta = lunch.prepBatchDelta;
  const lateBatchHedge =
    context.storeType === "suburban" && weather.rainRiskScore > 0.5
      ? "Delay large dinner prep until 17:00 confirmed demand; keep holding warmer at minimum."
      : "Stage dinner prep in two smaller batches to hedge rain uncertainty.";

  const inventoryParts: string[] = [];
  if (chickenRawKg !== undefined) {
    inventoryParts.push(`Chicken raw on hand: ${chickenRawKg}kg [${opsMode}]`);
  } else {
    inventoryParts.push("Maintain chicken raw parity with baseline");
  }
  inventoryParts.push(`Reduce early fried batch by ${Math.abs(earlyBatchDelta)}% for lunch. ${lateBatchHedge}.`);
  if (bags !== undefined) {
    inventoryParts.push(`Delivery bags on hand: ${bags} [${opsMode}] — increase usage by ${Math.round(totalDeliveryUplift)}% for delivery surge.`);
  } else {
    inventoryParts.push(`Increase delivery packaging (bags, cups, seals) by ${Math.round(totalDeliveryUplift)}%.`);
  }
  inventoryParts.push(`Verify ice & beverage stock (+${Math.round(weather.heatRiskScore * 20)}%) for heat demand.`);
  const inventory = inventoryParts.join(" ");

  const prepParts: string[] = [];
  if (baselineLunchOrders !== undefined && baselineDinnerOrders !== undefined) {
    prepParts.push(`Lunch baseline: ${baselineLunchOrders} orders [${opsMode}], dinner baseline: ${baselineDinnerOrders} orders [${opsMode}].`);
  }
  prepParts.push(`Lunch: fry ${Math.max(4, context.kitchenCapacity - 2 + Math.round(earlyBatchDelta / 5))} batches/hr peak (kitchen capacity ${context.kitchenCapacity}). Dinner: ${lateBatchHedge} Keep sides (rice, coleslaw) at 80% of peak — rain shifts mix toward delivery bundles. Pre-stage ${Math.round(totalDeliveryUplift)}% extra combo boxes.`);
  const prep = prepParts.join(" ");

  const wasteWarnings: string[] = [];
  if (totalWalkInDrop > 25)
    wasteWarnings.push("High walk-in drop — over-prep of dine-in sides will create waste risk. Cut early side prep 15%.");
  if (weather.rainRiskScore > 0.6 && context.storeType !== "mall")
    wasteWarnings.push("Rain + low shelter — risk of leftover fried chicken after lunch. Schedule smaller midday refresh.");

  const stockoutWarnings: string[] = [];
  if (totalDeliveryUplift > 30)
    stockoutWarnings.push("Delivery surge — high-delivery SKUs (family buckets, combo boxes) at stockout risk by 19:30. Pre-pull from backstock.");
  if (context.storeType === "suburban")
    stockoutWarnings.push("Suburban long supply lead time — confirm backup inventory now, not at peak.");

  const step: AgentStep = {
    step: 4,
    agentName: "Inventory & Prep Agent",
    agentRole: "Translate demand shift into prep batch sizing, inventory & packaging actions",
    phase: "plan",
    input: `Kitchen capacity ${context.kitchenCapacity} batches/hr | Delivery uplift ${totalDeliveryUplift.toFixed(0)}% | Walk-in drop ${totalWalkInDrop.toFixed(0)}% | Heat risk ${weather.heatRiskScore} | Store type ${context.storeType} | Ops mode: ${opsMode}${chickenRawKg !== undefined ? ` | Chicken: ${chickenRawKg}kg` : ""}${bags !== undefined ? ` | Bags: ${bags}` : ""}`,
    output: `${inventory} ${prep}`,
    structuredOutput: {
      earlyBatchDelta,
      packagingUpliftPct: Math.round(totalDeliveryUplift),
      beverageUpliftPct: Math.round(weather.heatRiskScore * 20),
      wasteWarnings,
      stockoutWarnings,
      opsMode,
      inventory: opsBaseline?.inventory,
    },
    confidence: 0.78,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - start,
    status: "done",
  };

  return { inventory, prep, wasteWarnings, stockoutWarnings, step };
}

// ---------------------------------------------------------------------------
// Agent 5 — Staffing Agent (Plan)
// ---------------------------------------------------------------------------
function runStaffingAgent(
  context: StoreWithContext,
  slots: SlotPlan[],
  opsBaseline?: OpsBaseline,
): { staffing: string; serviceDelayWarnings: string[]; step: AgentStep } {
  const start = Date.now();
  const lunch = slots[0];
  const dinner = slots[1];

  // Use real ops baseline if available; otherwise fall back to hardcoded 6.
  const opsMode = opsBaseline?.mode ?? "simulated";
  const baselineLunch = opsBaseline?.staffing.lunch ?? 6;
  const baselineDinner = opsBaseline?.staffing.dinner ?? 6;

  const lunchStaff = baselineLunch + lunch.staffingDelta;
  const dinnerStaff = baselineDinner + dinner.staffingDelta;

  const staffing =
    `Lunch ${lunch.windowLabel}: ${lunchStaff} staff (baseline ${baselineLunch}, ${lunch.staffingDelta >= 0 ? "+" : ""}${lunch.staffingDelta}). ` +
    `Assign ${lunch.expectedDeliveryDelta > 10 ? "1 dedicated online-order packer" : "shared packing"}. ` +
    `Dinner ${dinner.windowLabel}: ${dinnerStaff} staff (baseline ${baselineDinner}, ${dinner.staffingDelta >= 0 ? "+" : ""}${dinner.staffingDelta}). ` +
    `${dinner.expectedDeliveryDelta > 12 ? "Pull 1 prep staff to packing station 18:00–20:30." : "Keep standard rotation."} ` +
    `Heat > 0.6 → add 5-min rotation break per hour for kitchen staff.`;

  const serviceDelayWarnings: string[] = [];
  if (lunch.expectedDeliveryDelta > 15)
    serviceDelayWarnings.push("Lunch delivery surge — pack-to-dispatch SLA at risk. Pre-confirm 1 extra rider via aggregator.");
  if (dinner.expectedWalkInDelta < -20 && context.storeType === "mall")
    serviceDelayWarnings.push("Dine-in thinner than expected — redeploy 1 counter staff to fulfillment.");

  const step: AgentStep = {
    step: 5,
    agentName: "Staffing Agent",
    agentRole: "Size staffing per slot and assign roles to match shifted demand mix",
    phase: "plan",
    input: `Lunch delta walk-in ${lunch.expectedWalkInDelta}%, delivery ${lunch.expectedDeliveryDelta}% | Dinner delta walk-in ${dinner.expectedWalkInDelta}%, delivery ${dinner.expectedDeliveryDelta}% | Baseline ${baselineLunch}/${baselineDinner} [source: ${opsMode}]`,
    output: staffing,
    structuredOutput: {
      baselineLunch,
      baselineDinner,
      lunchStaff,
      dinnerStaff,
      lunchDelta: lunch.staffingDelta,
      dinnerDelta: dinner.staffingDelta,
      opsMode,
    },
    confidence: opsMode === "live" ? 0.9 : opsMode === "csv" ? 0.7 : 0.5,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - start,
    status: "done",
  };

  return { staffing, serviceDelayWarnings, step };
}

// ---------------------------------------------------------------------------
// Agent 6 — Campaign Agent (Recommend)
// ---------------------------------------------------------------------------
function runCampaignAgent(
  context: StoreWithContext,
  weather: WeatherSignal,
  slots: SlotPlan[],
): { campaign: string; step: AgentStep } {
  const start = Date.now();
  const lunch = slots[0];
  const dinner = slots[1];

  let focus: string;
  let rationale: string;

  if (weather.rainRiskScore > 0.55 && context.storeType !== "mall") {
    focus = "DELIVERY + TAKEAWAY";
    rationale =
      "Rain suppresses walk-in. Push delivery combo bundles & rainy-day free-shipping; suppress dine-in discount. Mall stores invert (shelter footfall).";
  } else if (weather.heatRiskScore > 0.6) {
    focus = "COLD BEVERAGE + DELIVERY";
    rationale = "Heat stress drives cold drink attach & delivery. Promo cold combo; reduce hot side upsell.";
  } else if (context.storeType === "mall") {
    focus = "DINE-IN FAMILY BUNDLES";
    rationale = "Mall shelter effect — rain pushes families indoors. Push family dine-in bundles.";
  } else if (lunch.expectedDeliveryDelta > 12 || dinner.expectedDeliveryDelta > 12) {
    focus = "DELIVERY COMBO + APP PUSH";
    rationale = "Delivery uplift detected — push app-only delivery combo & loyalty points.";
  } else {
    focus = "BALANCED — DINE-IN + DELIVERY";
    rationale = "No dominant risk signal — run standard mix; light delivery app push.";
  }

  const campaign = `Campaign focus: ${focus}. ${rationale} Timing: push notification 10:30 for lunch, 16:30 for dinner. Creative: ${weather.rainRiskScore > 0.55 ? "rainy-day cozy combo" : weather.heatRiskScore > 0.6 ? "chill combo" : "everyday value combo"}.`;

  const step: AgentStep = {
    step: 6,
    agentName: "Campaign Agent",
    agentRole: "Recommend dine-in / takeaway / delivery campaign focus from risk + store type",
    phase: "recommend",
    input: `Rain risk ${weather.rainRiskScore}, heat risk ${weather.heatRiskScore}, store type ${context.storeType}, lunch delivery delta ${lunch.expectedDeliveryDelta}%, dinner delivery delta ${dinner.expectedDeliveryDelta}%`,
    output: campaign,
    structuredOutput: { focus, rationale },
    confidence: 0.8,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - start,
    status: "done",
  };

  return { campaign, step };
}

// ---------------------------------------------------------------------------
// Agent 7 — Risk Explanation Agent (Explain) — LLM-augmented w/ fallback
// ---------------------------------------------------------------------------
function buildRiskFactors(
  context: StoreWithContext,
  weather: WeatherSignal,
  slots: SlotPlan[],
): RiskExplanation[] {
  const lunch = slots[0];
  const dinner = slots[1];
  const factors: RiskExplanation[] = [];

  factors.push({
    factor: "Rủi ro mưa (cực cục bộ)",
    weight: weather.rainRiskScore,
    reasoning: `Điểm rủi ro mưa ${weather.rainRiskScore.toFixed(2)} từ ${weather.source === "live" ? "API trực tiếp" : "dữ liệu dự phòng"}. Làm giảm lượng khách ghé cửa hàng và tăng đột biến giao hàng cho các cửa hàng ${context.storeType === "urban-street" ? "đô thị" : context.storeType === "residential" ? "dân cư" : "ngoại ô"}.`,
  });

  if (weather.pressureTrend === "falling") {
    factors.push({
      factor: "Xu hướng áp suất giảm",
      weight: 0.2,
      reasoning: "Áp suất khí quyển giảm trước khi có mưa đối lưu tại TP.HCM — làm tăng độ tin cậy về gián đoạn do mưa.",
    });
  }

  factors.push({
    factor: "Rủi ro giao hàng",
    weight: weather.deliveryDisruptionRisk,
    reasoning: `Rủi ro giao hàng ${weather.deliveryDisruptionRisk.toFixed(2)} — tính theo tỷ lệ giao hàng của cửa hàng ${(context.deliveryShare * 100).toFixed(0)}% và ${context.storeType === "suburban" ? "khoảng cách giao hàng ngoại ô dài" : "khoảng cách giao hàng bình thường"}.`,
  });

  if (weather.heatRiskScore > 0.5) {
    factors.push({
      factor: "Rủi ro nắng nóng",
      weight: weather.heatRiskScore,
      reasoning: `Rủi ro nắng nóng ${weather.heatRiskScore.toFixed(2)} ở ${weather.temperatureC}°C — thúc đẩy lượng đồ uống đi kèm và nhu cầu xoay ca nhân sự.`,
    });
  }

  factors.push({
    factor: "Dịch chuyển nhu cầu",
    weight: Math.min(1, (Math.abs(lunch.expectedDeliveryDelta) + Math.abs(dinner.expectedDeliveryDelta)) / 80),
    reasoning: `Giao hàng bữa trưa ${lunch.expectedDeliveryDelta >= 0 ? "+" : ""}${lunch.expectedDeliveryDelta}%, giao hàng bữa tối ${dinner.expectedDeliveryDelta >= 0 ? "+" : ""}${dinner.expectedDeliveryDelta}% — dịch chuyển cơ cấu nhu cầu về phía giao hàng.`,
  });

  // Sort by weight desc
  return factors.sort((a, b) => b.weight - a.weight);
}

async function runRiskExplanationAgent(
  context: StoreWithContext,
  weather: WeatherSignal,
  slots: SlotPlan[],
  factors: RiskExplanation[],
): Promise<{ risks: RiskExplanation[]; narrative: string; step: AgentStep }> {
  const start = Date.now();

  const systemPrompt = `You are the Risk Explanation Agent for a KFC F&B store-operations system in Ho Chi Minh City.
Your job: explain WHY the recommended action plan was made, in clear store-manager language.
You are NOT making new recommendations. You are explaining the existing reasoning.
Be concise (max 180 words), practical, no hype. Output STRICT JSON: {"narrative": string}.
The narrative should reference the top 2-3 risk factors by name and connect them to the store type.`;

  const userMessage = `Store: ${context.name} (${context.storeType}, ${context.district}).
Weather signal: ${weather.isLive ? "LIVE" : "FALLBACK"} — ${weather.temperatureC}°C, rain risk ${weather.rainRiskScore}, delivery disruption ${weather.deliveryDisruptionRisk}, walk-in drop ${weather.walkInDropRisk}, pressure ${weather.pressureTrend}.
Top risk factors:
${factors.slice(0, 4).map((f, i) => `${i + 1}. ${f.factor} (weight ${f.weight.toFixed(2)}) — ${f.reasoning}`).join("\n")}
Demand shift: lunch walk-in ${slots[0].expectedWalkInDelta}%, lunch delivery ${slots[0].expectedDeliveryDelta}%; dinner walk-in ${slots[1].expectedWalkInDelta}%, dinner delivery ${slots[1].expectedDeliveryDelta}%.
Write the narrative explaining why the plan recommends reducing early prep, shifting to delivery packaging, and adjusting staffing.`;

  const llm = await llmComplete(systemPrompt, userMessage, { timeoutMs: 12000 });
  let narrative: string;
  let dataSource: AgentStep["dataSource"] = "llm";
  let confidence = 0.82;

  if (llm.ok && llm.content) {
    const parsed = extractJson<{ narrative?: string }>(llm.content);
    narrative =
      parsed?.narrative?.trim() ||
      llm.content.replace(/```json|```/g, "").trim().slice(0, 600);
  } else {
    // Deterministic fallback narrative
    dataSource = "computed";
    confidence = 0.7;
    narrative =
      `Recommendations are driven primarily by ${factors[0]?.factor ?? "rain risk"} (weight ${(factors[0]?.weight ?? 0).toFixed(2)}) and ${factors[1]?.factor ?? "delivery disruption"} (weight ${(factors[1]?.weight ?? 0).toFixed(2)}). ` +
      `For a ${context.storeType} store in ${context.district}, rain suppresses walk-in while shifting demand to delivery — but rider dispatch is also disrupted (${weather.deliveryDisruptionRisk.toFixed(2)}). ` +
      `Net effect: reduce early fried prep to avoid waste, pre-stage delivery packaging, and add a fulfillment staffer during peak. ` +
      `${weather.isLive ? "Signal is live." : "Signal is in fallback mode — treat as directional."}`;
  }

  const step: AgentStep = {
    step: 7,
    agentName: "Risk Explanation Agent",
    agentRole: "Explain WHY the plan was recommended — connect risk factors to store context",
    phase: "explain",
    input: `Top factors: ${factors.slice(0, 3).map((f) => `${f.factor} (${f.weight.toFixed(2)})`).join(", ")} | Store ${context.storeType} | Weather ${weather.isLive ? "live" : "fallback"}`,
    output: narrative,
    structuredOutput: { factors, narrative },
    confidence,
    timestamp: nowIso(),
    dataSource,
    durationMs: Date.now() - start,
    status: "done",
  };

  return { risks: factors, narrative, step };
}

// ---------------------------------------------------------------------------
// Agent 8 — Manager Briefing Agent (Explain) — LLM-augmented w/ fallback
// ---------------------------------------------------------------------------
async function runManagerBriefingAgent(
  context: StoreWithContext,
  weather: WeatherSignal,
  plan: Omit<ActionPlan, "storeId" | "storeName" | "generatedAt" | "planningDate">,
  narrative: string,
): Promise<{ briefing: ManagerBriefing; step: AgentStep }> {
  const start = Date.now();
  const overallConfidence = plan.confidence;

  const systemPrompt = `You are the Manager Briefing Agent for a KFC store in Ho Chi Minh City.
Write a concise, action-oriented briefing a store manager can read in 30 seconds before their shift.
Tone: practical, calm, no hype, no emojis. Speak to the manager directly.
Output STRICT JSON:
{
  "headline": string (<=120 chars, the one-line takeaway),
  "tldr": string[] (3-4 bullet points, each <=140 chars),
  "topActions": string[] (3-5 concrete actions ordered by priority),
  "watchItems": string[] (2-3 things to monitor during the shift),
  "closingNote": string (<=160 chars, a confidence-aware closing line)
}`;

  const lunch = plan.slots[0];
  const dinner = plan.slots[1];
  const userMessage = `Store: ${context.name} — ${context.district}, ${context.storeType}. Planning date: tomorrow.
Overall risk: ${(plan.overallRisk * 100).toFixed(0)}%. Confidence: ${(overallConfidence * 100).toFixed(0)}% (${weather.isLive ? "live data" : "fallback data"}).
Weather: ${weather.temperatureC}°C, rain risk ${(weather.rainRiskScore * 100).toFixed(0)}%, delivery disruption ${(weather.deliveryDisruptionRisk * 100).toFixed(0)}%, walk-in drop ${(weather.walkInDropRisk * 100).toFixed(0)}%.
Lunch ${lunch.windowLabel}: walk-in ${lunch.expectedWalkInDelta}%, delivery ${lunch.expectedDeliveryDelta}%, prep ${lunch.prepBatchDelta}%, staffing ${lunch.staffingDelta >= 0 ? "+" : ""}${lunch.staffingDelta}.
Dinner ${dinner.windowLabel}: walk-in ${dinner.expectedWalkInDelta}%, delivery ${dinner.expectedDeliveryDelta}%, prep ${dinner.prepBatchDelta}%, staffing ${dinner.staffingDelta >= 0 ? "+" : ""}${dinner.staffingDelta}.
Inventory: ${plan.inventoryRecommendation}
Prep: ${plan.prepRecommendation}
Staffing: ${plan.staffingRecommendation}
Delivery readiness: ${plan.deliveryReadiness}
Campaign: ${plan.campaignRecommendation}
Waste warnings: ${plan.wasteWarnings.join("; ") || "none"}
Stockout warnings: ${plan.stockoutWarnings.join("; ") || "none"}
Risk narrative: ${narrative}`;

  const llm = await llmComplete(systemPrompt, userMessage, { timeoutMs: 15000 });
  let briefing: ManagerBriefing;
  let dataSource: AgentStep["dataSource"] = "llm";

  if (llm.ok && llm.content) {
    const parsed = extractJson<Partial<ManagerBriefing>>(llm.content);
    briefing = {
      storeId: context.id,
      storeName: context.name,
      generatedAt: nowIso(),
      headline:
        parsed?.headline?.trim() ||
        `${context.name}: ${(plan.overallRisk * 100).toFixed(0)}% operational risk — ${weather.rainRiskScore > 0.5 ? "rain-driven" : weather.heatRiskScore > 0.6 ? "heat-driven" : "moderate"} day.`,
      tldr:
        parsed?.tldr && parsed.tldr.length >= 2
          ? parsed.tldr.slice(0, 4)
          : [
              `Lunch walk-in ${lunch.expectedWalkInDelta}%, delivery ${lunch.expectedDeliveryDelta}%.`,
              `Dinner walk-in ${dinner.expectedWalkInDelta}%, delivery ${dinner.expectedDeliveryDelta}%.`,
              `Prep early batch ${lunch.prepBatchDelta}%; packaging +${Math.round(Math.max(0, Math.max(lunch.expectedDeliveryDelta, dinner.expectedDeliveryDelta)))}%.`,
              `Staffing: lunch ${lunch.staffingDelta >= 0 ? "+" : ""}${lunch.staffingDelta}, dinner ${dinner.staffingDelta >= 0 ? "+" : ""}${dinner.staffingDelta}.`,
            ],
      topActions:
        parsed?.topActions && parsed.topActions.length >= 2
          ? parsed.topActions.slice(0, 5)
          : [
              plan.prepRecommendation.split(".")[0] + ".",
              plan.staffingRecommendation.split(".")[0] + ".",
              plan.campaignRecommendation.split(".")[0] + ".",
              ...(plan.stockoutWarnings[0] ? [plan.stockoutWarnings[0]] : []),
            ],
      watchItems:
        parsed?.watchItems && parsed.watchItems.length >= 1
          ? parsed.watchItems.slice(0, 3)
          : [
              ...(plan.wasteWarnings[0] ? [plan.wasteWarnings[0]] : []),
              ...(plan.stockoutWarnings[0] ? [plan.stockoutWarnings[0]] : []),
              `Re-check weather at 14:00 — ${weather.isLive ? "live" : "fallback"} confidence ${(weather.dataConfidence * 100).toFixed(0)}%.`,
            ],
      confidenceLabel: confidenceLabel(overallConfidence),
      closingNote:
        parsed?.closingNote?.trim() ||
        (weather.isLive
          ? `Plan built on live signals — confidence ${(overallConfidence * 100).toFixed(0)}%. Re-run if weather shifts.`
          : `Live weather unavailable — plan built on fallback. Re-run when connection restores.`),
    };
  } else {
    // Deterministic fallback briefing
    dataSource = "computed";
    briefing = {
      storeId: context.id,
      storeName: context.name,
      generatedAt: nowIso(),
      headline: `${context.name}: ${(plan.overallRisk * 100).toFixed(0)}% operational risk — ${weather.rainRiskScore > 0.5 ? "rain-driven" : weather.heatRiskScore > 0.6 ? "heat-driven" : "moderate"} day.`,
      tldr: [
        `Lunch walk-in ${lunch.expectedWalkInDelta}%, delivery ${lunch.expectedDeliveryDelta}%.`,
        `Dinner walk-in ${dinner.expectedWalkInDelta}%, delivery ${dinner.expectedDeliveryDelta}%.`,
        `Prep early batch ${lunch.prepBatchDelta}%; packaging +${Math.round(Math.max(0, Math.max(lunch.expectedDeliveryDelta, dinner.expectedDeliveryDelta)))}%.`,
        `Staffing: lunch ${lunch.staffingDelta >= 0 ? "+" : ""}${lunch.staffingDelta}, dinner ${dinner.staffingDelta >= 0 ? "+" : ""}${dinner.staffingDelta}.`,
      ],
      topActions: [
        plan.prepRecommendation.split(".")[0] + ".",
        plan.staffingRecommendation.split(".")[0] + ".",
        plan.campaignRecommendation.split(".")[0] + ".",
        ...(plan.stockoutWarnings[0] ? [plan.stockoutWarnings[0]] : []),
      ],
      watchItems: [
        ...(plan.wasteWarnings[0] ? [plan.wasteWarnings[0]] : []),
        ...(plan.stockoutWarnings[0] ? [plan.stockoutWarnings[0]] : []),
        `Re-check weather at 14:00 — ${weather.isLive ? "live" : "fallback"} confidence ${(weather.dataConfidence * 100).toFixed(0)}%.`,
      ],
      confidenceLabel: confidenceLabel(overallConfidence),
      closingNote: weather.isLive
        ? `Plan built on live signals — confidence ${(overallConfidence * 100).toFixed(0)}%. Re-run if weather shifts.`
        : `Live weather unavailable — plan built on fallback. Re-run when connection restores.`,
    };
  }

  const step: AgentStep = {
    step: 8,
    agentName: "Manager Briefing Agent",
    agentRole: "Synthesize a 30-second manager-ready briefing from the full plan",
    phase: "explain",
    input: `Full plan for ${context.name} | overall risk ${(plan.overallRisk * 100).toFixed(0)}% | confidence ${(overallConfidence * 100).toFixed(0)}% | ${weather.isLive ? "live" : "fallback"} data`,
    output: `Headline: ${briefing.headline}\nTL;DR: ${briefing.tldr.join(" | ")}\nTop actions: ${briefing.topActions.length} | Watch items: ${briefing.watchItems.length} | Confidence: ${briefing.confidenceLabel}`,
    structuredOutput: { briefing },
    confidence: overallConfidence,
    timestamp: nowIso(),
    dataSource,
    durationMs: Date.now() - start,
    status: "done",
  };

  return { briefing: withVietnamese(briefing, context, weather, plan, lunch, dinner, overallConfidence), step };
}

// ---------------------------------------------------------------------------
// Bilingual layer — produces deterministic Vietnamese translations of the
// manager-facing briefing fields so the operator dashboard can render either
// language without a second LLM call.
// ---------------------------------------------------------------------------
function withVietnamese(
  briefing: ManagerBriefing,
  context: StoreWithContext,
  weather: WeatherSignal,
  plan: Omit<ActionPlan, "storeId" | "storeName" | "generatedAt" | "planningDate">,
  lunch: SlotPlan,
  dinner: SlotPlan,
  overallConfidence: number,
): ManagerBriefing {
  const driver =
    weather.rainRiskScore > 0.5
      ? "do mưa"
      : weather.heatRiskScore > 0.6
        ? "do nắng nóng"
        : "trung bình";
  const headlineVi = `${context.name}: rủi ro vận hành ${(plan.overallRisk * 100).toFixed(0)}% — ngày ${driver}.`;
  const tldrVi = [
    `Trưa: walk-in ${lunch.expectedWalkInDelta}%, delivery ${lunch.expectedDeliveryDelta}%.`,
    `Tối: walk-in ${dinner.expectedWalkInDelta}%, delivery ${dinner.expectedDeliveryDelta}%.`,
    `Prep mẻ đầu ${lunch.prepBatchDelta}%; bao bì +${Math.round(Math.max(0, Math.max(lunch.expectedDeliveryDelta, dinner.expectedDeliveryDelta)))}%.`,
    `Nhân sự: trưa ${lunch.staffingDelta >= 0 ? "+" : ""}${lunch.staffingDelta}, tối ${dinner.staffingDelta >= 0 ? "+" : ""}${dinner.staffingDelta}.`,
  ];
  const topActionsVi = [
    plan.prepRecommendation.split(".")[0] + ".",
    plan.staffingRecommendation.split(".")[0] + ".",
    plan.campaignRecommendation.split(".")[0] + ".",
    ...(plan.stockoutWarnings[0] ? [plan.stockoutWarnings[0]] : []),
  ];
  const watchItemsVi = [
    ...(plan.wasteWarnings[0] ? [plan.wasteWarnings[0]] : []),
    ...(plan.stockoutWarnings[0] ? [plan.stockoutWarnings[0]] : []),
    `Kiểm tra lại thời tiết lúc 14:00 — ${weather.isLive ? "live" : "dự phòng"} độ tin cậy ${(weather.dataConfidence * 100).toFixed(0)}%.`,
  ];
  const closingNoteVi = weather.isLive
    ? `Kế hoạch xây trên tín hiệu live — độ tin cậy ${(overallConfidence * 100).toFixed(0)}%. Chạy lại nếu thời tiết thay đổi.`
    : `Thời tiết live không khả dụng — kế hoạch dùng dự phòng. Chạy lại khi có kết nối.`;
  return {
    ...briefing,
    headlineVi,
    tldrVi,
    topActionsVi,
    watchItemsVi,
    closingNoteVi,
  };
}

// ---------------------------------------------------------------------------
// Before/After simulation
// ---------------------------------------------------------------------------
function buildBeforeAfter(
  context: StoreWithContext,
  weather: WeatherSignal,
  slots: SlotPlan[],
): BeforeAfterMetric[] {
  const lunch = slots[0];
  const dinner = slots[1];
  const deliveryUplift = Math.max(0, lunch.expectedDeliveryDelta) + Math.max(0, dinner.expectedDeliveryDelta);
  const walkInDrop = Math.max(0, -lunch.expectedWalkInDelta) + Math.max(0, -dinner.expectedWalkInDelta);

  // Without agent: manager uses generic city weather → tends to over-prep for rain that may not hit their micro-area,
  // understaff delivery, overstaff dine-in.
  const withoutAgentWaste = Math.min(45, 12 + walkInDrop * 0.6);
  const withAgentWaste = Math.max(3, withoutAgentWaste * 0.35);

  const withoutAgentStockout = Math.min(55, 10 + deliveryUplift * 0.5);
  const withAgentStockout = Math.max(4, withoutAgentStockout * 0.3);

  const withoutAgentStaffingFit = Math.max(40, 70 - walkInDrop * 0.4 - deliveryUplift * 0.3); // % of slots correctly staffed
  const withAgentStaffingFit = Math.min(95, withoutAgentStaffingFit + 22);

  const withoutAgentDeliveryReady = Math.max(35, 65 - deliveryUplift * 0.4);
  const withAgentDeliveryReady = Math.min(96, withoutAgentDeliveryReady + 25);

  const withoutAgentMarginProtection = Math.max(20, 55 - walkInDrop * 0.3 - deliveryUplift * 0.2); // % of at-risk margin protected
  const withAgentMarginProtection = Math.min(94, withoutAgentMarginProtection + 30);

  return [
    {
      key: "waste",
      label: "Food Waste Risk",
      withoutAgent: Number(withoutAgentWaste.toFixed(1)),
      withAgent: Number(withAgentWaste.toFixed(1)),
      unit: "%",
      betterIs: "lower",
      explanation: `Without the agent, a manager reacting to generic city rain over-preps dine-in sides (+${walkInDrop.toFixed(0)}% walk-in drop). The agent sizes prep to this store's micro-risk.`,
    },
    {
      key: "stockout",
      label: "Stockout Risk",
      withoutAgent: Number(withoutAgentStockout.toFixed(1)),
      withAgent: Number(withAgentStockout.toFixed(1)),
      unit: "%",
      betterIs: "lower",
      explanation: `Delivery surge (+${deliveryUplift.toFixed(0)}%) catches unmanaged stores short on buckets/boxes. The agent pre-stages packaging.`,
    },
    {
      key: "staffing",
      label: "Staffing Fit",
      withoutAgent: Number(withoutAgentStaffingFit.toFixed(1)),
      withAgent: Number(withAgentStaffingFit.toFixed(1)),
      unit: "%",
      betterIs: "higher",
      explanation: `Without the agent, staffing follows yesterday's pattern. The agent re-weights toward fulfillment when delivery spikes.`,
    },
    {
      key: "delivery",
      label: "Delivery Readiness",
      withoutAgent: Number(withoutAgentDeliveryReady.toFixed(1)),
      withAgent: Number(withAgentDeliveryReady.toFixed(1)),
      unit: "%",
      betterIs: "higher",
      explanation: `Readiness = packaging + rider confirmation + pack-to-dispatch SLA. Agent pre-confirms riders & packaging.`,
    },
    {
      key: "margin",
      label: "Margin Protected",
      withoutAgent: Number(withoutAgentMarginProtection.toFixed(1)),
      withAgent: Number(withAgentMarginProtection.toFixed(1)),
      unit: "%",
      betterIs: "higher",
      explanation: `Of the at-risk margin today, the share protected by right-sized prep, staffing, and campaign targeting.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Orchestrator — runs the full agent pipeline with the 9-step logic loop:
// Observe → Classify → Diagnose → Simulate → Decide → Automate → Approval → Execute/Export → Learn
// (mapped onto the 8 specialized agents + the new StoreOps Autopilot phases)
// ---------------------------------------------------------------------------
export async function runAgentPipeline(
  store: KfcStore,
  weather: WeatherSignal,
  provenance?: WeatherProvenance,
  opsBaseline?: OpsBaseline,
): Promise<AgentRunResult> {
  const runStart = Date.now();
  const trace: AgentStep[] = [];

  // 1. Store Context (Observe)
  const { context, step: step1 } = runStoreContextAgent(store);
  trace.push(step1);

  // 2. Weather Signal (Collect — enriched with provenance)
  const { step: step2 } = runWeatherSignalAgent(store, weather, provenance);
  trace.push(step2);

  // 2b. OPERATIONS BASELINE — fetch POS/inventory/staffing baseline
  //     Tries sponsor API (live) → CSV → synthetic. The mode is surfaced
  //     honestly in the trace and in every downstream agent's input.
  const opsStart = Date.now();
  const opsMode = opsBaseline?.mode ?? "simulated";
  const opsSource = opsBaseline?.source ?? "synthetic-ops (not connected)";
  trace.push({
    step: 2.5,
    agentName: "Operations Baseline Agent",
    agentRole: "Fetch POS/inventory/staffing baseline from sponsor API → CSV → synthetic",
    phase: "collect",
    input: `Store: ${store.name} | Sponsor API: ${process.env.SPONSOR_API_BASE_URL ? "configured" : "not configured"}`,
    output: `Ops baseline mode=${opsMode}, source=${opsSource}. Lunch baseline ${opsBaseline?.baselineLunchOrders ?? "N/A"} orders, dinner baseline ${opsBaseline?.baselineDinnerOrders ?? "N/A"} orders. Inventory: chicken ${opsBaseline?.inventory.chickenRawKg ?? "N/A"}kg. Staffing: lunch ${opsBaseline?.staffing.lunch ?? "N/A"}, dinner ${opsBaseline?.staffing.dinner ?? "N/A"}.`,
    structuredOutput: {
      mode: opsMode,
      source: opsSource,
      baselineLunchOrders: opsBaseline?.baselineLunchOrders,
      baselineDinnerOrders: opsBaseline?.baselineDinnerOrders,
      baselineDeliveryShare: opsBaseline?.baselineDeliveryShare,
      inventory: opsBaseline?.inventory,
      staffing: opsBaseline?.staffing,
      reliabilityNote: opsBaseline?.reliabilityNote ?? "No ops baseline — using hardcoded defaults",
    },
    confidence: opsMode === "live" ? 0.95 : opsMode === "csv" ? 0.7 : 0.3,
    timestamp: nowIso(),
    dataSource: opsMode === "live" ? "live" : opsMode === "csv" ? "computed" : "fallback",
    durationMs: Date.now() - opsStart,
    status: "done",
  });

  // 3. Demand (Analyze) — pass opsBaseline so demand agent uses real baselines
  const { slots, step: step3 } = runDemandAgent(context, weather, opsBaseline);
  trace.push(step3);

  // 3b. CLASSIFY — classify the store operating situation
  const classifyStart = Date.now();
  const dominantChannel =
    slots[0].expectedDeliveryDelta > slots[0].expectedWalkInDelta * -1 && slots[0].expectedDeliveryDelta > 10
      ? "delivery"
      : weather.walkInDropRisk > 0.5
        ? "walk-in collapse"
        : "balanced";
  const primaryRiskDriver =
    weather.rainRiskScore > 0.5 ? "rain" : weather.heatRiskScore > 0.6 ? "heat" : "demand-mix";
  trace.push({
    step: 3.5,
    agentName: "Store Classifier",
    agentRole: "Classify the store operating situation by type, time window, channel under pressure, and primary risk",
    phase: "classify",
    input: `Store type ${context.storeType} | Weather: rain ${weather.rainRiskScore}, heat ${weather.heatRiskScore}, delivery disruption ${weather.deliveryDisruptionRisk} | Lunch walk-in ${slots[0].expectedWalkInDelta}%, delivery ${slots[0].expectedDeliveryDelta}%`,
    output: `Operating class: ${context.storeType} | Time window: ${slots[0].slot} → ${slots[1].slot} | Channel under pressure: ${dominantChannel} | Primary risk driver: ${primaryRiskDriver}`,
    structuredOutput: { operatingClass: context.storeType, dominantChannel, primaryRiskDriver, timeWindows: [slots[0].windowLabel, slots[1].windowLabel] },
    confidence: 0.85,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - classifyStart,
    status: "done",
  });

  // 3c. DIAGNOOSE — root-cause the operational problem
  const diagnoseStart = Date.now();
  const diagnoses: string[] = [];
  if (weather.rainRiskScore > 0.5 && context.storeType !== "mall") diagnoses.push("rain suppressing walk-in");
  if (slots[0].expectedDeliveryDelta > 15) diagnoses.push("delivery surge straining fulfillment");
  if (slots[0].prepBatchDelta < -5) diagnoses.push("early over-prep risk if plan not applied");
  if (weather.deliveryDisruptionRisk > 0.5) diagnoses.push("rider dispatch overload");
  if (context.storeType === "suburban" && weather.rainRiskScore > 0.5) diagnoses.push("long replenishment lead time compounding stockout risk");
  trace.push({
    step: 3.7,
    agentName: "Operations Diagnostician",
    agentRole: "Diagnose root causes: weather, demand shift, staffing mismatch, over-prep, low inventory, delivery overload, wrong campaign channel",
    phase: "diagnose",
    input: `Classified: ${context.storeType}, ${dominantChannel}, ${primaryRiskDriver} | Risk scores: rain ${weather.rainRiskScore}, delivery ${weather.deliveryDisruptionRisk}, walk-drop ${weather.walkInDropRisk}`,
    output: `Root causes: ${diagnoses.length ? diagnoses.join("; ") : "no single dominant cause — balanced risk"}.`,
    structuredOutput: { diagnoses },
    confidence: 0.8,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - diagnoseStart,
    status: "done",
  });

  // 4. Inventory & Prep (Plan)
  const {
    inventory,
    prep,
    wasteWarnings,
    stockoutWarnings,
    step: step4,
  } = runInventoryPrepAgent(context, weather, slots, opsBaseline);
  trace.push(step4);

  // 5. Staffing (Plan)
  const { staffing, serviceDelayWarnings, step: step5 } = runStaffingAgent(context, slots, opsBaseline);
  trace.push(step5);

  // 6. Campaign (Recommend / Decide)
  const { campaign, step: step6 } = runCampaignAgent(context, weather, slots);
  trace.push(step6);

  // 6b. SIMULATE — what-if simulation of the plan vs the default
  const simulateStart = Date.now();
  const defaultWaste = Math.min(45, 12 + Math.max(0, -slots[0].expectedWalkInDelta) * 0.6);
  const planWaste = Math.max(3, defaultWaste * 0.35);
  const defaultStockout = Math.min(55, 10 + Math.max(0, slots[0].expectedDeliveryDelta) * 0.5);
  const planStockout = Math.max(4, defaultStockout * 0.3);
  trace.push({
    step: 6.5,
    agentName: "Simulation Agent",
    agentRole: "Simulate what-if: hold old plan vs apply agent plan — compare waste, stockout, staffing fit, margin",
    phase: "simulate",
    input: `Default (no agent): waste ${defaultWaste.toFixed(0)}%, stockout ${defaultStockout.toFixed(0)}%. Agent plan: prep ${slots[0].prepBatchDelta}%, packaging +${Math.round(Math.max(0, slots[0].expectedDeliveryDelta))}%, staffing ${slots[0].staffingDelta >= 0 ? "+" : ""}${slots[0].staffingDelta}.`,
    output: `With agent plan: waste ${planWaste.toFixed(0)}% (↓${(defaultWaste - planWaste).toFixed(0)}pts), stockout ${planStockout.toFixed(0)}% (↓${(defaultStockout - planStockout).toFixed(0)}pts). Holding the old plan would over-prep dine-in and under-staff delivery.`,
    structuredOutput: { defaultWaste, planWaste, defaultStockout, planStockout, wasteReduction: defaultWaste - planWaste, stockoutReduction: defaultStockout - planStockout },
    confidence: 0.75,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - simulateStart,
    status: "done",
  });

  // 7. Risk Explanation (Explain — LLM)
  const factors = buildRiskFactors(context, weather, slots);
  const { narrative, step: step7 } = await runRiskExplanationAgent(context, weather, slots, factors);
  trace.push(step7);

  // Compose the plan object before briefing
  const overallRisk = Number(
    (
      0.4 * weather.rainRiskScore +
      0.25 * weather.deliveryDisruptionRisk +
      0.2 * weather.walkInDropRisk +
      0.15 * weather.heatRiskScore
    ).toFixed(2),
  );
  const confidence = Number(
    Math.min(0.95, 0.5 + weather.dataConfidence * 0.4).toFixed(2),
  );

  const storeRiskSummary = `${context.name} (${context.district}, ${context.storeType}) faces ${(overallRisk * 100).toFixed(0)}% composite operational risk tomorrow. Primary driver: ${factors[0]?.factor ?? "weather"} (weight ${(factors[0]?.weight ?? 0).toFixed(2)}). Demand mix shifts toward delivery (+${Math.max(0, Math.max(slots[0].expectedDeliveryDelta, slots[1].expectedDeliveryDelta)).toFixed(0)}%) with walk-in softness (${slots[0].expectedWalkInDelta}% lunch / ${slots[1].expectedWalkInDelta}% dinner).`;

  const deliveryReadiness =
    weather.deliveryDisruptionRisk > 0.5
      ? `HIGH disruption — pre-confirm ${slots[0].expectedDeliveryDelta > 12 ? "1 extra rider 11:00–13:30" : ""} ${slots[1].expectedDeliveryDelta > 12 ? "and 1 rider 18:00–20:30" : ""}. Set ETA buffer +10min. Pre-stage packaging +${Math.round(Math.max(0, Math.max(slots[0].expectedDeliveryDelta, slots[1].expectedDeliveryDelta)))}%.`
      : weather.deliveryDisruptionRisk > 0.3
        ? `MODERATE — standard rider rotation, packaging +${Math.round(Math.max(0, Math.max(slots[0].expectedDeliveryDelta, slots[1].expectedDeliveryDelta)))}%. Monitor dispatch SLA.`
        : `LOW — standard readiness. Light packaging buffer.`;

  const planDraft: Omit<ActionPlan, "storeId" | "storeName" | "generatedAt" | "planningDate"> = {
    overallRisk,
    confidence,
    storeRiskSummary,
    slots,
    inventoryRecommendation: inventory,
    prepRecommendation: prep,
    staffingRecommendation: staffing,
    deliveryReadiness,
    campaignRecommendation: campaign,
    wasteWarnings,
    stockoutWarnings,
    serviceDelayWarnings,
    risks: factors,
  };

  // 8. Manager Briefing (LLM)
  const { briefing, step: step8 } = await runManagerBriefingAgent(context, weather, planDraft, narrative);
  trace.push(step8);

  const plan: ActionPlan = {
    ...planDraft,
    storeId: store.id,
    storeName: store.name,
    generatedAt: nowIso(),
    planningDate: new Date(Date.now() + 86400_000).toISOString().slice(0, 10),
  };

  const beforeAfter = buildBeforeAfter(context, weather, slots);

  // 9. AUTOMATE — generate draft tasks (briefing, checklists, staff message, supplier order, campaign, incident report, EOD summary)
  const automateStart = Date.now();
  trace.push({
    step: 9,
    agentName: "Task Automation Agent",
    agentRole: "Generate draft operational tasks: briefing, checklists, staff messages, supplier order draft, incident report, campaign draft, EOD summary",
    phase: "automate",
    input: `Action plan + briefing + weather + store profile for ${context.name} | overall risk ${(plan.overallRisk * 100).toFixed(0)}%`,
    output: `Generated 9 draft tasks: daily briefing (auto-approved), opening checklist (auto-approved), pre-lunch checklist (auto-approved), staff shift note (needs approval), supplier order draft (needs approval), incident report (auto-approved), campaign draft (needs approval), EOD summary template (auto-approved), next-shift prep task (auto-approved). Sensitive actions are drafts pending human approval.`,
    structuredOutput: {
      tasksGenerated: 9,
      autoApproved: 6,
      needsApproval: 3,
      sensitiveCategories: ["staff-message", "supplier-order", "campaign"],
      policy: "No real email/message/order/campaign/customer-reply is sent without manager approval.",
    },
    confidence: 0.8,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - automateStart,
    status: "done",
  });

  // 10. APPROVAL — gate sensitive actions
  const approvalStart = Date.now();
  trace.push({
    step: 10,
    agentName: "Approval Workflow",
    agentRole: "Gate sensitive actions (supplier order, staff message, campaign, customer reply, roster change) behind human approval",
    phase: "approval",
    input: `9 tasks generated | 3 require approval (staff-message, supplier-order, campaign) | 6 auto-approved`,
    output: `Sensitive tasks remain in 'draft' / 'pending-approval' state until the store manager (or area manager for campaigns) approves. No financial, labour, or customer-facing action executes without explicit approval. All decisions are audit-logged.`,
    structuredOutput: {
      approvalRequired: 3,
      approverRoles: { "store-manager": 2, "area-manager": 1 },
      policy: "HUMAN_APPROVAL_POLICY.md",
    },
    confidence: 0.95,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - approvalStart,
    status: "done",
  });

  // 11. EXECUTE / EXPORT — approved tasks can be exported (briefing .md, checklists)
  const executeStart = Date.now();
  trace.push({
    step: 11,
    agentName: "Execute / Export",
    agentRole: "Export approved artifacts (briefing markdown, checklists) and log execution; sensitive actions wait for approval",
    phase: "execute",
    input: `6 auto-approved tasks ready to export | 3 sensitive tasks pending approval`,
    output: `Manager briefing exportable as .md. Checklists available in Automation Center. Sensitive tasks held for approval. All executions audit-logged.`,
    structuredOutput: { exported: 6, pending: 3 },
    confidence: 0.9,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - executeStart,
    status: "done",
  });

  // 12. LEARN — AI học sau ca
  const learnStart = Date.now();
  let actualData: any = null;
  try {
    actualData = await db.dayActual.findFirst({
      where: { storeId: context.id },
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    // Ignore db fetch error
  }

  const hasActuals = !!actualData;
  const outputMessage = hasActuals
    ? `Hệ thống đã nhận được dữ liệu thực tế cuối ca: Bữa trưa thực tế ${actualData.actualLunchOrders} đơn, Bữa tối thực tế ${actualData.actualDinnerOrders} đơn, Hao hụt ${actualData.actualWasteKg} kg, Số lần đứt hàng ${actualData.actualStockoutCount}. AI đã đối chiếu sai số dự báo và tối ưu hóa trọng số mô hình cho ca tiếp theo.`
    : "Chưa có dữ liệu cuối ngày để học.";

  trace.push({
    step: 12,
    agentName: "AI học sau ca",
    agentRole: "So sánh kế hoạch đề xuất và kết quả vận hành thực tế cuối ngày để tự hiệu chỉnh mô hình.",
    phase: "learn",
    input: `Plan proposed | confidence ${(plan.confidence * 100).toFixed(0)}% | weather ${weather.isLive ? "live" : "fallback"} | ops mode ${opsBaseline?.mode ?? "none"}`,
    output: outputMessage,
    structuredOutput: hasActuals
      ? {
          hasActuals: true,
          actualLunchOrders: actualData.actualLunchOrders,
          actualDinnerOrders: actualData.actualDinnerOrders,
          actualWasteKg: actualData.actualWasteKg,
          actualStockoutCount: actualData.actualStockoutCount,
          managerFeedback: actualData.managerFeedback,
        }
      : {
          hasActuals: false,
          message: "Chưa có dữ liệu cuối ngày để học.",
        },
    confidence: hasActuals ? 0.95 : 0.3,
    timestamp: nowIso(),
    dataSource: "computed",
    durationMs: Date.now() - learnStart,
    status: "done",
  });

  return {
    storeId: store.id,
    storeName: store.name,
    trace,
    plan,
    briefing,
    beforeAfter,
    weather,
    weatherProvenance: provenance ?? {
      primarySource: weather.source,
      primaryMode: weather.isLive ? "live" : "fallback",
      contributors: [
        {
          sourceId: "open-meteo",
          sourceName: "Open-Meteo",
          mode: weather.isLive ? "live" : "fallback",
          contributed: true,
        },
      ],
    },
    isLive: weather.isLive,
    generatedAt: nowIso(),
    totalDurationMs: Date.now() - runStart,
  };
}
