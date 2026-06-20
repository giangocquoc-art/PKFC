import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { ProviderAdapter } from "@/lib/llm/providerRegistry";

export const dynamic = "force-dynamic";

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

export async function POST(req: Request) {
  if (!checkAdminToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json() as {
      providerId?: string;
      adapter?: ProviderAdapter;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      extraHeaders?: Record<string, string>;
    };
    const { providerId, adapter, baseUrl, apiKey, model, extraHeaders } = body;

    if (providerId) {
      updateEnvVar("LLM_PROVIDER_ID", providerId);
    }
    if (adapter) {
      updateEnvVar("LLM_PROVIDER", adapter);
    }
    if (baseUrl !== undefined) {
      updateEnvVar("LLM_API_BASE_URL", baseUrl);
    }
    if (model !== undefined) {
      updateEnvVar("LLM_MODEL", model);
    }
    if (apiKey !== undefined) {
      updateEnvVar("LLM_API_KEY", apiKey);
    }
    
    // Specific well-known extra headers
    if (extraHeaders?.["HTTP-Referer"]) {
      updateEnvVar("LLM_HTTP_REFERER", extraHeaders["HTTP-Referer"]);
    }
    if (extraHeaders?.["X-Title"]) {
      updateEnvVar("LLM_APP_TITLE", extraHeaders["X-Title"]);
    }

    return NextResponse.json({
      ok: true,
      status: "saved",
      message: "Model provider configuration saved for demo session.",
      config: {
        providerId: providerId || process.env.LLM_PROVIDER_ID || "custom-openai-compatible",
        adapter: adapter || process.env.LLM_PROVIDER || "openai-compatible",
        baseUrl: baseUrl !== undefined ? baseUrl : process.env.LLM_API_BASE_URL || "",
        model: model !== undefined ? model : process.env.LLM_MODEL || "",
        hasApiKey: !!(apiKey || process.env.LLM_API_KEY),
        extraHeaderNames: extraHeaders ? Object.keys(extraHeaders) : [],
        configScope: "ui-demo",
      }
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: "Failed to save configuration / Lưu cấu hình thất bại.",
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!checkAdminToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({
      ok: true,
      config: {
        providerId: process.env.LLM_PROVIDER_ID || "custom-openai-compatible",
        adapter: process.env.LLM_PROVIDER || "openai-compatible",
        baseUrl: process.env.LLM_API_BASE_URL || "",
        model: process.env.LLM_MODEL || "",
        hasApiKey: !!process.env.LLM_API_KEY,
        configScope: "server-env",
      }
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: "Failed to load configuration / Tải cấu hình thất bại.",
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}

