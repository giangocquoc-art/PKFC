import { NextResponse } from "next/server";
import { getProviderById, type ProviderAdapter } from "@/lib/llm/providerRegistry";
import { callRouterChatCompletion } from "@/lib/llm/routerChatClient";

export const dynamic = "force-dynamic";

function isProviderModelMatch(providerId: string, model: string): boolean {
  const pId = providerId.toLowerCase();
  const m = model.toLowerCase();
  
  if (pId === "openai" && !m.includes("gpt") && !m.includes("o1") && !m.includes("o3") && !m.includes("text-embedding")) {
    return false;
  }
  if (pId === "gemini" && !m.includes("gemini")) {
    return false;
  }
  if (pId === "anthropic" && !m.includes("claude")) {
    return false;
  }
  if (pId === "deepseek" && !m.includes("deepseek")) {
    return false;
  }
  if (pId === "groq" && !m.includes("llama") && !m.includes("mixtral") && !m.includes("gemma")) {
    return false;
  }
  if (pId === "xai" && !m.includes("grok")) {
    return false;
  }
  return true;
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
  const start = Date.now();
  try {
    const body = await req.json() as {
      providerId?: string;
      adapter?: ProviderAdapter;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      customChatPath?: string;
      extraHeaders?: Record<string, string>;
    };
    const { providerId, baseUrl, apiKey, model, extraHeaders } = body;

    // 1. Check provider-model mismatch first
    if (providerId && model) {
      if (!isProviderModelMatch(providerId, model)) {
        return NextResponse.json({
          ok: false,
          status: "failed",
          error: "provider_model_mismatch",
          message: "Model đã chọn không thuộc provider này."
        });
      }
    }

    // 2. Identify adapter
    let finalAdapter: ProviderAdapter = "openai-compatible";
    let requiresApiKey = true;
    if (providerId) {
      const providerInfo = getProviderById(providerId);
      if (providerInfo) {
        finalAdapter = providerInfo.adapter;
        requiresApiKey = providerInfo.requiresApiKey;
      }
    } else if (body.adapter) {
      finalAdapter = body.adapter;
    }

    // 3. Return if adapter is not implemented
    if (finalAdapter !== "openai-compatible" && finalAdapter !== "manual" && finalAdapter !== "gemini") {
      return NextResponse.json({
        ok: false,
        status: "failed",
        error: "adapter_not_implemented",
        message: "Provider này cần adapter riêng. Chưa thể xác thực trong bản demo này."
      });
    }

    // 4. Validate parameters
    if (finalAdapter !== "gemini" && !baseUrl) {
      return NextResponse.json({
        ok: false,
        status: "failed",
        error: "missing_parameters",
        message: "Base URL is required for connection test / Cần cung cấp Base URL."
      });
    }
    if (!model) {
      return NextResponse.json({
        ok: false,
        status: "failed",
        error: "missing_parameters",
        message: "Model is required for connection test / Cần cung cấp Model."
      });
    }

    // 5. Check API key if required
    const effectiveKey = apiKey || process.env.LLM_API_KEY || "";
    if (requiresApiKey && !effectiveKey) {
      return NextResponse.json({
        ok: false,
        status: "failed",
        error: "missing_api_key",
        message: "API key is required for this provider / API key là bắt buộc."
      });
    }

    // 6. Perform a real test completions request using routerChatClient
    const testResult = await callRouterChatCompletion({
      providerId,
      adapter: finalAdapter,
      baseUrl: baseUrl || "",
      apiKey: effectiveKey,
      model,
      messages: [
        { role: "system", content: "You are a connection test." },
        { role: "user", content: "Reply with OK." }
      ],
      temperature: 0,
      maxTokens: 16,
      extraHeaders,
    });

    if (!testResult.ok) {
      return NextResponse.json({
        ok: false,
        status: "failed",
        error: testResult.error || "unreachable",
        message: testResult.message || "Failed to complete connection test."
      });
    }

    return NextResponse.json({
      ok: true,
      status: "connected",
      durationMs: Date.now() - start,
      message: `Successfully verified connection and model '${model}' responds with: ${testResult.content}`
    });

  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      status: "failed",
      durationMs: Date.now() - start,
      error: "unreachable",
      message: `Endpoint unreachable / Lỗi kết nối: ${err.message || err}`
    });
  }
}


