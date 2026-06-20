// GET  /api/admin/sources — list all data source configs (non-secret)
// POST /api/admin/sources — upsert a data source config (non-secret fields only)
//
// CRITICAL: API keys are NEVER stored in the database. They live in server-side
// env vars (SPONSOR_API_KEY, GOOGLE_MAPS_API_KEY, etc.). The DB only stores
// non-secret config: name, type, apiUrl, headers, fieldMapping, status.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DEFAULT_SOURCES = [
  { id: "src-weather", name: "Weather (Open-Meteo)", type: "weather" },
  { id: "src-google-maps", name: "Google Maps Embed / Store Map", type: "google-maps" },
  { id: "src-pos", name: "POS / Orders (Sponsor API)", type: "pos" },
  { id: "src-inventory", name: "Inventory", type: "inventory" },
  { id: "src-staffing", name: "Staffing", type: "staffing" },
  { id: "src-complaint", name: "Customer Complaints", type: "complaint" },
  { id: "src-ai-model", name: "Router API / AI Model Provider", type: "ai-model" },
  { id: "src-csv-upload", name: "CSV Upload", type: "csv-upload" },
];

function updateEnvVar(key: string, value: string) {
  process.env[key] = value;

  if (process.env.NODE_ENV === "production") {
    return;
  }

  try {
    const envPath = path.join(process.cwd(), ".env");
    let content = "";
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, "utf8");
    }
    const lines = content.split(/\r?\n/);
    let found = false;
    const newLines = lines.map((line) => {
      if (line.trim().startsWith(`${key}=`)) {
        found = true;
        return `${key}="${value}"`;
      }
      return line;
    });
    if (!found) {
      newLines.push(`${key}="${value}"`);
    }
    fs.writeFileSync(envPath, newLines.join("\n"), "utf8");
  } catch (e) {
    console.error("Failed to write to .env", e);
  }
}

function checkAdminToken(req: Request) {
  const configuredToken = process.env.ADMIN_TOKEN;

  if (!configuredToken) {
    return process.env.NODE_ENV !== "production";
  }

  const token = req.headers.get("x-admin-token");
  return token === configuredToken;
}

export async function GET(req: Request) {
  if (!checkAdminToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    let configs = await db.dataSourceConfig.findMany();
    // Ensure all default source types exist in the DB and are up to date
    for (const def of DEFAULT_SOURCES) {
      const existing = configs.find((c) => c.id === def.id);
      if (!existing) {
        await db.dataSourceConfig.create({
          data: { id: def.id, name: def.name, type: def.type, status: "not-configured" },
        });
      } else if (existing.name !== def.name) {
        await db.dataSourceConfig.update({
          where: { id: def.id },
          data: { name: def.name },
        });
      }
    }
    configs = await db.dataSourceConfig.findMany();

    // Add env-var-based status for sponsor API
    const sponsorConfigured = !!(process.env.SPONSOR_API_BASE_URL && process.env.SPONSOR_API_KEY);
    const sponsorMode = process.env.SPONSOR_API_MODE ?? "demo";

    return NextResponse.json({
      sources: configs.map((c) => {
        let hasKey = false;
        let apiKeyMasked: string | undefined = undefined;

        if (c.type === "google-maps") {
          hasKey = !!process.env.GOOGLE_MAPS_API_KEY;
          apiKeyMasked = process.env.GOOGLE_MAPS_API_KEY ? "AIzaSy..." : undefined;
        } else if (c.type === "pos" || c.type === "inventory" || c.type === "staffing" || c.type === "complaint") {
          hasKey = !!process.env.SPONSOR_API_KEY;
          apiKeyMasked = process.env.SPONSOR_API_KEY ? "SponsorKey..." : undefined;
        } else if (c.type === "ai-model") {
          hasKey = !!process.env.LLM_API_KEY;
          apiKeyMasked = process.env.LLM_API_KEY ? "LLMKey..." : undefined;
        }

        return {
          ...c,
          hasKey,
          apiKeyMasked,
          fieldMapping: c.fieldMapping ? JSON.parse(c.fieldMapping) : undefined,
          headers: c.headers ?? undefined,
          // For POS/inventory/staffing, show env-var status
          hasEnvKey:
            (c.type === "pos" || c.type === "inventory" || c.type === "staffing") && sponsorConfigured,
          envMode: (c.type === "pos" || c.type === "inventory" || c.type === "staffing") ? sponsorMode : undefined,
        };
      }),
      envStatus: {
        SPONSOR_API_BASE_URL: process.env.SPONSOR_API_BASE_URL ? "[set]" : "[not set]",
        SPONSOR_API_KEY: process.env.SPONSOR_API_KEY ? "[set]" : "[not set]",
        SPONSOR_API_MODE: sponsorMode,
        SPONSOR_API_TIMEOUT_MS: process.env.SPONSOR_API_TIMEOUT_MS ?? "6000",
        GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ? "[set]" : "[not set]",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch data sources", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!checkAdminToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    id?: string;
    name?: string;
    type?: string;
    apiUrl?: string;
    headers?: string;
    fieldMapping?: Record<string, string>;
    apiKey?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const existing = await db.dataSourceConfig.findUnique({ where: { id: body.id } });
    
    // Save apiKeys to .env if provided
    if (body.apiKey) {
      if (body.type === "google-maps") {
        updateEnvVar("GOOGLE_MAPS_API_KEY", body.apiKey);
      } else if (body.type === "pos" || body.type === "inventory" || body.type === "staffing" || body.type === "complaint") {
        updateEnvVar("SPONSOR_API_KEY", body.apiKey);
      } else if (body.type === "ai-model") {
        updateEnvVar("LLM_API_KEY", body.apiKey);
      }
    }

    if (body.id === "src-ai-model") {
      if (body.apiUrl) {
        updateEnvVar("LLM_API_BASE_URL", body.apiUrl);
        updateEnvVar("LLM_PROVIDER", "openai-compatible");
      }
      if (body.headers) {
        try {
          const parsed = JSON.parse(body.headers);
          if (parsed.selectedModel) {
            updateEnvVar("LLM_MODEL", parsed.selectedModel);
          }
        } catch {
          // ignore
        }
      }
    }

    const data = {
      name: body.name ?? existing?.name ?? body.id,
      type: body.type ?? existing?.type ?? "csv-upload",
      apiUrl: body.apiUrl ?? null,
      headers: body.headers ?? null,
      fieldMapping: body.fieldMapping ? JSON.stringify(body.fieldMapping) : null,
      status: "untested",
    };

    const config = existing
      ? await db.dataSourceConfig.update({ where: { id: body.id }, data })
      : await db.dataSourceConfig.create({ data: { id: body.id, ...data } });

    return NextResponse.json({
      ...config,
      fieldMapping: config.fieldMapping ? JSON.parse(config.fieldMapping) : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save data source", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

