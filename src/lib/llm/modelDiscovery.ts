import type { ModelDiscoveryMode } from "./providerRegistry";

interface DiscoverModelsArgs {
  baseUrl: string;
  apiKey?: string;
  providerId?: string;
  modelDiscoveryMode: ModelDiscoveryMode;
  customModelsPath?: string;
  extraHeaders?: Record<string, string>;
}

export interface NormalizedModel {
  id: string;
  label: string;
  ownedBy?: string;
  providerId?: string;
  raw?: unknown;
}

/**
 * Normalizes baseUrl and queries model endpoints.
 * Supports openai-compatible endpoints and ollama endpoints.
 */
export async function discoverModels({
  baseUrl,
  apiKey,
  providerId,
  modelDiscoveryMode,
  customModelsPath,
  extraHeaders,
}: DiscoverModelsArgs): Promise<{ ok: boolean; models: NormalizedModel[]; error?: string }> {
  if (modelDiscoveryMode === "none" || modelDiscoveryMode === "manual") {
    return { ok: true, models: [] };
  }

  if (!baseUrl) {
    return { ok: false, models: [], error: "Base URL is required." };
  }

  // Normalize baseUrl: strip trailing slashes
  const trimmedUrl = baseUrl.trim();
  let normalizedUrl = trimmedUrl.replace(/\/+$/, "");

  let endpointsToTry: string[] = [];

  if (modelDiscoveryMode === "openai-models") {
    if (customModelsPath) {
      endpointsToTry.push(`${normalizedUrl}${customModelsPath.startsWith("/") ? "" : "/"}${customModelsPath}`);
    } else if (normalizedUrl.endsWith("/v1")) {
      endpointsToTry.push(`${normalizedUrl}/models`);
    } else {
      endpointsToTry.push(`${normalizedUrl}/v1/models`);
      endpointsToTry.push(`${normalizedUrl}/models`);
    }
  } else if (modelDiscoveryMode === "ollama-tags") {
    endpointsToTry.push(`${normalizedUrl}/api/tags`);
  } else {
    // If we have an unsupported mode (e.g. anthropic-models) that we haven't implemented yet
    return { ok: true, models: [] };
  }

  let lastError = "Could not fetch models from endpoint.";

  for (const url of endpointsToTry) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...extraHeaders,
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(8000), // 8-second timeout
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        lastError = `Endpoint returned status ${res.status}: ${text || res.statusText}`;
        continue;
      }

      const json = await res.json() as any;

      if (modelDiscoveryMode === "openai-models" && json && Array.isArray(json.data)) {
        const models: NormalizedModel[] = json.data.map((m: any) => ({
          id: m.id,
          label: m.id,
          ownedBy: m.owned_by,
          providerId,
          raw: m,
        }));
        return { ok: true, models };
      } else if (modelDiscoveryMode === "ollama-tags" && json && Array.isArray(json.models)) {
        const models: NormalizedModel[] = json.models.map((m: any) => ({
          id: m.name,
          label: m.name,
          providerId,
          raw: m,
        }));
        return { ok: true, models };
      } else {
        lastError = "Response format invalid. Expected { data: [{ id }] } or { models: [{ name }] } depending on provider type.";
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    ok: false,
    models: [],
    error: `Model discovery failed / Không thể tải danh sách model. Error details: ${lastError}`,
  };
}
