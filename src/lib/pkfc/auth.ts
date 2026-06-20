import { NextResponse } from "next/server";

export function getPkfcApiKeyFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1];
    }
  }
  const apiKeyHeader = req.headers.get("x-p-kfc-api-key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }
  return null;
}

export interface AuthResult {
  ok: boolean;
  authMode: "api-key" | "local-demo";
  errorResponse?: NextResponse;
}

export function requirePkfcApiKey(req: Request): AuthResult {
  const configuredKey = process.env.P_KFC_API_KEY;
  const requestKey = getPkfcApiKeyFromRequest(req);

  // If key is configured in env, we must strictly check it.
  if (configuredKey) {
    if (requestKey === configuredKey) {
      return { ok: true, authMode: "api-key" };
    }
    return {
      ok: false,
      authMode: "api-key",
      errorResponse: NextResponse.json({
        ok: false,
        error: "unauthorized",
        message: "Missing or invalid P-KFC API key."
      }, { status: 401 })
    };
  }

  // If P_KFC_API_KEY is not configured in env:
  // In production, we reject immediately.
  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      authMode: "api-key",
      errorResponse: NextResponse.json({
        ok: false,
        error: "unauthorized",
        message: "Missing or invalid P-KFC API key. (Production requires P_KFC_API_KEY env variable)"
      }, { status: 401 })
    };
  }

  // Outside production, if P_KFC_API_KEY is not configured, we allow local demo
  // if no key is provided, or if any key is provided (for easy testing).
  return { ok: true, authMode: "local-demo" };
}
