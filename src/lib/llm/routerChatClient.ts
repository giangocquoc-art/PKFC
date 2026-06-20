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
}

/**
 * Calls AI model endpoints based on the provider adapter.
 * Never logs API keys and normalizes results and errors.
 */
export async function callRouterChatCompletion({
  providerId,
  adapter,
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 0.3,
  maxTokens = 800,
  customChatPath,
  extraHeaders,
}: RouterChatCompletionArgs): Promise<RouterChatCompletionResult> {
  if (adapter === "manual") {
    adapter = "openai-compatible"; // Fallback for manual user entry assuming standard format
  }

  if (adapter === "gemini") {
    if (!apiKey) {
      return { ok: false, error: "missing_apiKey", message: "API key is required for Gemini." };
    }
    const modelName = model || "gemini-1.5-flash";
    const host = (baseUrl || "https://generativelanguage.googleapis.com").trim().replace(/\/+$/, "");
    const completionsUrl = `${host}/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    try {
      let systemInstructionText = "";
      const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

      for (const msg of messages) {
        if (msg.role === "system") {
          systemInstructionText += (systemInstructionText ? "\n" : "") + msg.content;
        } else {
          contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          });
        }
      }

      const body: any = {
        contents,
      };

      if (systemInstructionText) {
        body.systemInstruction = {
          parts: [{ text: systemInstructionText }],
        };
      }

      body.generationConfig = {
        temperature: temperature,
        maxOutputTokens: maxTokens,
      };

      const res = await fetch(completionsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...extraHeaders,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000), // 15-second timeout
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          error: `http_${res.status}`,
          message: `Gemini API returned status ${res.status}: ${text || res.statusText}`,
        };
      }

      const json = await res.json() as any;
      const parts = json?.candidates?.[0]?.content?.parts;
      if (!parts || !Array.isArray(parts)) {
        return {
          ok: false,
          error: "invalid_response_format",
          message: "Gemini API did not return a valid candidate parts array.",
          raw: json,
        };
      }
      const content = parts.map((p: any) => p.text || "").join("");

      return {
        ok: true,
        content,
        model: modelName,
        raw: json,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: "completion_request_failed",
        message: `Failed to complete chat with Gemini: ${errorMessage}`,
      };
    }
  }

  if (adapter !== "openai-compatible") {
    return {
      ok: false,
      error: "adapter_not_implemented",
      message: "This provider requires a native adapter that is not implemented yet. / Provider này cần adapter riêng chưa được hỗ trợ.",
    };
  }

  if (!baseUrl) {
    return { ok: false, error: "missing_baseUrl", message: "Base URL is required." };
  }
  if (!model) {
    return { ok: false, error: "missing_model", message: "Model is required." };
  }

  // Normalize baseUrl
  const trimmedUrl = baseUrl.trim();
  let normalizedUrl = trimmedUrl.replace(/\/+$/, "");
  let completionsUrl = "";

  if (customChatPath) {
    completionsUrl = `${normalizedUrl}${customChatPath.startsWith("/") ? "" : "/"}${customChatPath}`;
  } else if (normalizedUrl.endsWith("/v1")) {
    completionsUrl = `${normalizedUrl}/chat/completions`;
  } else {
    // If it's a known URL format or just raw base, try to guess
    completionsUrl = `${normalizedUrl}/v1/chat/completions`;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const body = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    const res = await fetch(completionsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000), // 15-second timeout
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `http_${res.status}`,
        message: `API returned status ${res.status}: ${text || res.statusText}`,
      };
    }

    const json = await res.json() as any;

    let content = "";
    if (json?.choices?.[0]?.message?.content != null) {
      content = json.choices[0].message.content;
    } else if (json?.choices?.[0]?.text != null) {
      content = json.choices[0].text;
    } else if (json?.choices?.[0]?.delta?.content != null) {
      content = json.choices[0].delta.content;
    } else {
      return {
        ok: false,
        error: "invalid_response_format",
        message: "API did not return a valid chat completion text choice.",
        raw: json,
      };
    }

    return {
      ok: true,
      content,
      model: json.model || model,
      raw: json,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: "completion_request_failed",
      message: `Failed to complete chat: ${errorMessage}`,
    };
  }
}
