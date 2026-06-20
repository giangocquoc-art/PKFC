import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let providerId = process.env.LLM_PROVIDER_ID || "gemini";
  let adapter = process.env.LLM_PROVIDER || "gemini-native";
  let baseUrl = process.env.LLM_API_BASE_URL || "";
  let apiKey = process.env.LLM_API_KEY || "";
  let model = process.env.LLM_MODEL || "";

  // Fallback to database config if env is not completely configured
  if (!baseUrl || !model || !apiKey) {
    try {
      const dbConfig = await db.dataSourceConfig.findUnique({ where: { id: "src-ai-model" } });
      if (dbConfig) {
        if (dbConfig.apiUrl && !baseUrl) baseUrl = dbConfig.apiUrl;
        if (dbConfig.headers) {
          const parsed = JSON.parse(dbConfig.headers);
          if (parsed.selectedModel && !model) model = parsed.selectedModel;
          if (parsed.providerId && !providerId) providerId = parsed.providerId;
          if (parsed.adapter && !adapter) adapter = parsed.adapter;
        }
      }
    } catch {
      // ignore
    }
  }

  const isGemini = providerId === "gemini" || adapter === "gemini-native" || adapter === "gemini";
  if (isGemini && !baseUrl) {
    baseUrl = "https://generativelanguage.googleapis.com";
  }

  const configured = !!apiKey && !!model && (isGemini || !!baseUrl);

  return NextResponse.json({
    ok: true,
    configured,
    providerId,
    model: model || "none",
    baseUrl: baseUrl || "none",
  });
}
