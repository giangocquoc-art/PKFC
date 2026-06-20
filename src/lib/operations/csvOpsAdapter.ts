// CSV Operations Adapter
// ======================
// Reads operations baseline (POS/inventory/staffing) from a CSV file following
// the sample schema in public/sample-operations-data.csv. This is the seam for
// plugging in real KFC data exports: drop a CSV in the same shape and the
// adapter picks it up with no code changes.
//
// CSV schema (columns):
//   storeId,baselineLunchOrders,baselineDinnerOrders,baselineDeliveryShare,
//   chickenRawKg,buckets,cups,bags,staffingLunch,staffingDinner
//
// All numeric. One row per store. Header row required.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { OperationsDataAdapter, OpsBaseline } from "@/lib/operations/operationsDataAdapter";

export interface OpsCsvRow {
  storeId: string;
  baselineLunchOrders: number;
  baselineDinnerOrders: number;
  baselineDeliveryShare: number;
  chickenRawKg: number;
  buckets: number;
  cups: number;
  bags: number;
  staffingLunch: number;
  staffingDinner: number;
}

/** Parse a CSV string into OpsCsvRow[]. Tolerant of quoted fields and BOM. */
export function parseOpsCsv(csv: string): OpsCsvRow[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: OpsCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const get = (name: string) => {
      const idx = header.indexOf(name);
      return idx >= 0 ? cols[idx] : "";
    };
    const num = (v: string, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    rows.push({
      storeId: get("storeid"),
      baselineLunchOrders: num(get("baselinelunchorders")),
      baselineDinnerOrders: num(get("baselinedinnerorders")),
      baselineDeliveryShare: num(get("baselinedeliveryshare")),
      chickenRawKg: num(get("chickenrawkg")),
      buckets: num(get("buckets")),
      cups: num(get("cups")),
      bags: num(get("bags")),
      staffingLunch: num(get("staffinglunch"), 6),
      staffingDinner: num(get("staffingdinner"), 6),
    });
  }
  return rows;
}

export class CsvOpsAdapter implements OperationsDataAdapter {
  readonly id = "csv-ops";
  readonly name = "CSV Operations Data";
  readonly mode = "csv" as const;

  private rows: Map<string, OpsCsvRow> = new Map();
  private loaded = false;
  private loadError: string | null = null;

  constructor(private readonly csvPath: string = "public/sample-operations-data.csv") {}

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const fullPath = path.join(process.cwd(), this.csvPath);
      const text = await fs.readFile(fullPath, "utf-8");
      const parsed = parseOpsCsv(text);
      for (const r of parsed) this.rows.set(r.storeId, r);
      this.loaded = true;
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : "Failed to read CSV file";
      this.loaded = true; // Don't retry — file doesn't exist or can't be read
    }
  }

  async fetch(store: KfcStore): Promise<OpsBaseline> {
    await this.load();
    const row = this.rows.get(store.id);
    if (!row) {
      // No CSV row for this store — throw so getOpsBaseline falls back to synthetic.
      // Do NOT silently return profile-derived data labeled as "csv".
      throw new Error(
        this.loadError
          ? `CSV file not readable: ${this.loadError}`
          : `No CSV row for store ${store.id}. Add a row to public/sample-operations-data.csv to supply real data.`
      );
    }
    return {
      storeId: store.id,
      mode: "csv",
      source: "csv-ops",
      fetchedAt: new Date().toISOString(),
      baselineLunchOrders: row.baselineLunchOrders,
      baselineDinnerOrders: row.baselineDinnerOrders,
      baselineDeliveryShare: row.baselineDeliveryShare,
      inventory: {
        chickenRawKg: row.chickenRawKg,
        buckets: row.buckets,
        cups: row.cups,
        bags: row.bags,
      },
      staffing: { lunch: row.staffingLunch, dinner: row.staffingDinner },
      reliabilityNote:
        "Operations baseline loaded from CSV (public/sample-operations-data.csv). Replace this file with a real KFC export of the same shape to go live.",
    };
  }
}
