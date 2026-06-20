// LLM helper — wraps CaMate LLM client for backend use only.
// Provides a typed, resilient chat completion with timeout + fallback.
// MUST never be imported from client-side code.

import { callRouterChatCompletion } from "./llm/routerChatClient";
import type { ProviderAdapter } from "./llm/providerRegistry";

export interface LlmResult {
  content: string;
  ok: boolean;
  error?: string;
  durationMs: number;
}

/**
 * Run a single chat completion. Returns a structured result so callers can
 * degrade gracefully when the LLM is unavailable.
 */
export async function llmComplete(
  systemPrompt: string,
  userMessage: string,
  opts: { timeoutMs?: number; thinking?: boolean } = {},
): Promise<LlmResult> {
  const start = Date.now();
  const provider = process.env.LLM_PROVIDER || "openai-compatible";
  const apiKey = process.env.LLM_API_KEY || "";
  const baseURL = process.env.LLM_API_BASE_URL || "";
  const model = process.env.LLM_MODEL || "";
  const providerId = process.env.LLM_PROVIDER_ID || "custom-openai-compatible";
  const isGemini = provider === "gemini" || providerId === "gemini";
  const effectiveBaseURL = baseURL || (isGemini ? "https://generativelanguage.googleapis.com" : "");

  // If provider is explicitly disabled or basic config is missing, return fallback error
  if (provider === "none" || !apiKey || !effectiveBaseURL || !model) {
    const missing: string[] = [];
    if (!apiKey) missing.push("LLM_API_KEY");
    if (!effectiveBaseURL) missing.push("LLM_API_BASE_URL");
    if (!model) missing.push("LLM_MODEL");

    return {
      content: "",
      ok: false,
      error: `LLM Provider is not fully configured (missing: ${missing.join(", ")}). Using local fallback.`,
      durationMs: Date.now() - start,
    };
  }

  try {
    const response = await callRouterChatCompletion({
      providerId,
      adapter: provider as ProviderAdapter,
      baseUrl: effectiveBaseURL,
      apiKey,
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    if (!response.ok) {
      return {
        content: "",
        ok: false,
        error: response.message || response.error || "LLM completion failed",
        durationMs: Date.now() - start,
      };
    }

    return {
      content: response.content || "",
      ok: true,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      content: "",
      ok: false,
      error: e instanceof Error ? e.message : "unknown llm error",
      durationMs: Date.now() - start,
    };
  }
}

/** Best-effort JSON extraction from an LLM response that may contain prose + fences. */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  // Try fenced block first.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  // Find the first balanced JSON object/array.
  const start = candidate.search(/[{[]/);
  if (start === -1) return null;
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === open) depth++;
    else if (candidate[i] === close) {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        try {
          return JSON.parse(slice) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

