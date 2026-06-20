import type { ProviderAdapter } from "./providerRegistry";

interface RouterChatCompletionArgs {
  providerId?: string;
  adapter: ProviderAdapter;
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  customChatPath?: string;
  extraHeaders?: Record<string, string>;
}

interface RouterChatCompletionResult {
  ok: boolean;
  content?: string;
  model?: string;
  error?: string;
  message?: string;
  raw?: unknown;
  providerId?: string;
  adapter?: ProviderAdapter;
  httpStatus?: number;
}

/**
 * Helper function to perform fetch with 20 seconds timeout and retry once for network timeouts only.
 * Normalizes HTTP error status codes to OpenAI-compatible status reasons. Never logs API keys.
 */
async function fetchWithRetryAndTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 20000
): Promise<{ ok: boolean; status: number; text: string; json?: any; errorReason?: string; errorMessage?: string }> {
  let attempt = 1;
  const maxAttempts = 2; // 1 original + 1 retry

  while (attempt <= maxAttempts) {
    const controller = new AbortController();
    const signal = controller.signal;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const status = res.status;
        let errorReason = "invalid_response";
        if (status === 401 || status === 403) {
          errorReason = "invalid_api_key";
        } else if (status === 404) {
          errorReason = "model_not_found";
        }

        return {
          ok: false,
          status,
          text,
          errorReason,
          errorMessage: `API returned status ${status}: ${text || res.statusText}`,
        };
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        return { ok: true, status: res.status, text: "", json };
      } else {
        const text = await res.text();
        return { ok: true, status: res.status, text };
      }

    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === "TimeoutError" || err.message?.includes("timeout") || err.name === "AbortError";

      if (isTimeout) {
        if (attempt < maxAttempts) {
          attempt++;
          continue;
        }
        return {
          ok: false,
          status: 0,
          text: "",
          errorReason: "provider_timeout",
          errorMessage: `Request timed out after ${timeoutMs}ms.`,
        };
      }

      return {
        ok: false,
        status: 0,
        text: "",
        errorReason: "provider_unreachable",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    ok: false,
    status: 0,
    text: "",
    errorReason: "provider_unreachable",
    errorMessage: "Unknown error occurred.",
  };
}

/**
 * Calls AI model endpoints based on the provider adapter.
 * Supports native Google Gemini generateContent API and standard OpenAI-compatible completions.
 */
export async function callRouterChatCompletion({
  providerId,
  adapter,
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 0.2,
  maxTokens = 1024,
  customChatPath,
  extraHeaders,
}: RouterChatCompletionArgs): Promise<RouterChatCompletionResult> {
  const isGeminiNative = providerId === "gemini" || adapter === "gemini-native" || adapter === "gemini";

  if (isGeminiNative) {
    if (!apiKey || !model) {
      return {
        ok: false,
        error: "missing_env",
        message: "API key or Model is missing for Google Gemini native adapter.",
      };
    }

    const modelName = model;
    const host = (baseUrl || "https://generativelanguage.googleapis.com").trim().replace(/\/+$/, "");
    const completionsUrl = `${host}/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const systemMsg = messages.find((m) => m.role === "system")?.content || "";
    const userMsg = messages.find((m) => m.role === "user")?.content || "";
    const promptText = systemMsg ? `${systemMsg}\n\n${userMsg}` : userMsg;

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: maxTokens,
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
      ...extraHeaders,
    };

    const res = await fetchWithRetryAndTimeout(completionsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: res.errorReason || "invalid_response",
        message: res.errorMessage || "Google Gemini native API generateContent failed.",
        providerId: "gemini",
        adapter: "gemini-native",
        httpStatus: res.status,
      };
    }

    const json = res.json;
    const candidates = json?.candidates;
    const parts = candidates?.[0]?.content?.parts;
    const content = parts?.[0]?.text || "";

    if (!content) {
      return {
        ok: false,
        error: "empty_response",
        message: "Google Gemini native API returned empty candidates content parts text.",
        providerId: "gemini",
        adapter: "gemini-native",
      };
    }

    return {
      ok: true,
      content,
      model: modelName,
      providerId: "gemini",
      adapter: "gemini-native",
      httpStatus: res.status,
    };
  }

  // Fallback / OpenAI-compatible provider flow
  if (adapter === "manual") {
    adapter = "openai-compatible";
  }

  if (adapter !== "openai-compatible") {
    return {
      ok: false,
      error: "adapter_not_implemented",
      message: `Adapter type ${adapter} not supported or implemented in this pilot.`,
    };
  }

  if (!apiKey || !model || !baseUrl) {
    return {
      ok: false,
      error: "missing_env",
      message: "Missing LLM_API_KEY, LLM_MODEL, or LLM_API_BASE_URL environment config on server.",
    };
  }

  const trimmedUrl = baseUrl.trim();
  const normalizedUrl = trimmedUrl.replace(/\/+$/, "");
  let completionsUrl = "";

  if (customChatPath) {
    completionsUrl = `${normalizedUrl}${customChatPath.startsWith("/") ? "" : "/"}${customChatPath}`;
  } else if (normalizedUrl.endsWith("/v1")) {
    completionsUrl = `${normalizedUrl}/chat/completions`;
  } else {
    completionsUrl = `${normalizedUrl}/v1/chat/completions`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  headers["Authorization"] = `Bearer ${apiKey}`;

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const res = await fetchWithRetryAndTimeout(completionsUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return {
      ok: false,
      error: res.errorReason || "invalid_response",
      message: res.errorMessage || "OpenAI-compatible chat completions failed.",
      httpStatus: res.status,
    };
  }

  const json = res.json;
  const content = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.text || "";

  if (!content) {
    return {
      ok: false,
      error: "empty_response",
      message: "API did not return a valid chat completion text choices.",
    };
  }

  return {
    ok: true,
    content,
    model: json.model || model,
    httpStatus: res.status,
  };
}
