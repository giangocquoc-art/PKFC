import { NextResponse } from "next/server";
import { discoverModels } from "@/lib/llm/modelDiscovery";
import { getProviderById } from "@/lib/llm/providerRegistry";
import type { ProviderAdapter, ModelDiscoveryMode } from "@/lib/llm/providerRegistry";

export const dynamic = "force-dynamic";

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
      customModelsPath?: string;
      extraHeaders?: Record<string, string>;
    };
    
    const { providerId, baseUrl, apiKey, customModelsPath, extraHeaders } = body;

    if (!baseUrl && (!providerId || getProviderById(providerId)?.modelDiscoveryMode !== "manual")) {
      return NextResponse.json({
        ok: false,
        models: [],
        message: "Base URL is required. / Cần có Base URL.",
        error: "Base URL is required.",
      });
    }

    let modelDiscoveryMode: ModelDiscoveryMode = "none";
    if (providerId) {
      const providerInfo = getProviderById(providerId);
      if (providerInfo) {
        modelDiscoveryMode = providerInfo.modelDiscoveryMode;
      }
    } else {
      // Fallback
      modelDiscoveryMode = "openai-models";
    }

    if (modelDiscoveryMode === "none") {
       return NextResponse.json({
         ok: false,
         models: [],
         message: "This provider does not support model discovery. / Provider này không hỗ trợ tự tải model.",
         error: "Unsupported discovery mode.",
       });
    }

    const result = await discoverModels({
      baseUrl: baseUrl || "",
      apiKey: apiKey || process.env.LLM_API_KEY || undefined,
      providerId,
      modelDiscoveryMode,
      customModelsPath,
      extraHeaders,
    });

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        models: [],
        message: result.error || "Failed to load models.",
        error: result.error,
      });
    }

    return NextResponse.json({
      ok: true,
      providerId,
      models: result.models,
      message: `Successfully loaded ${result.models.length} model(s) / Tải thành công ${result.models.length} model.`,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      models: [],
      message: "Internal server error / Lỗi máy chủ nội bộ.",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

