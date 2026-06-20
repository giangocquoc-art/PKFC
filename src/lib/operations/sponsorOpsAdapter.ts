// Sponsor Ops Adapter — connects to the hackathon organizer / KFC API.
// =========================================================================
// Implements the OperationsDataAdapter interface. When SPONSOR_API_BASE_URL
// and SPONSOR_API_KEY are set, fetches real operations data. When not set,
// throws so the pipeline falls back to CSV → synthetic.
//
// CRITICAL: This adapter NEVER fabricates data. If the API call fails, it
// throws and the caller (getOpsBaseline) handles the fallback chain.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { OpsBaseline, OperationsDataAdapter } from "@/lib/operations/operationsDataAdapter";

const TIMEOUT_MS = Number(process.env.SPONSOR_API_TIMEOUT_MS ?? "6000");

export class SponsorOpsAdapter implements OperationsDataAdapter {
  readonly id = "sponsor-ops";
  readonly name = "Organizer / KFC API";
  readonly mode = "live" as const;

  async fetch(store: KfcStore): Promise<OpsBaseline> {
    const baseUrl = process.env.SPONSOR_API_BASE_URL;
    const apiKey = process.env.SPONSOR_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error("SPONSOR_API_BASE_URL or SPONSOR_API_KEY not configured");
    }

    const url = `${baseUrl}/stores/${encodeURIComponent(store.id)}/baseline`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Sponsor API HTTP ${res.status}`);
      }

      const data = await res.json();

      // Map the sponsor API response to OpsBaseline.
      // The expected response shape:
      // {
      //   storeId, baselineLunchOrders, baselineDinnerOrders,
      //   baselineDeliveryShare,
      //   inventory: { chickenRawKg, buckets, cups, bags },
      //   staffing: { lunch, dinner }
      // }
      const baseline: OpsBaseline = {
        storeId: store.id,
        mode: "live",
        source: `sponsor-api (${baseUrl})`,
        fetchedAt: new Date().toISOString(),
        baselineLunchOrders: Number(data.baselineLunchOrders ?? data.baseline_lunch_orders ?? 0),
        baselineDinnerOrders: Number(data.baselineDinnerOrders ?? data.baseline_dinner_orders ?? 0),
        baselineDeliveryShare: Number(data.baselineDeliveryShare ?? data.baseline_delivery_share ?? store.deliveryShare),
        inventory: {
          chickenRawKg: Number(data.inventory?.chickenRawKg ?? data.inventory?.chicken_raw_kg ?? 0),
          buckets: Number(data.inventory?.buckets ?? 0),
          cups: Number(data.inventory?.cups ?? 0),
          bags: Number(data.inventory?.bags ?? 0),
        },
        staffing: {
          lunch: Number(data.staffing?.lunch ?? data.staffing?.staffing_lunch ?? 0),
          dinner: Number(data.staffing?.dinner ?? data.staffing?.staffing_dinner ?? 0),
        },
        reliabilityNote: `Live data from organizer API. Fetched at ${new Date().toISOString()}.`,
      };

      return baseline;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const sponsorOpsAdapter = new SponsorOpsAdapter();
