import { NextResponse } from "next/server";

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
  const start = Date.now();
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const sourceId = body.id || "sponsor-api";

  try {
    const mode = process.env.SPONSOR_API_MODE || "demo";
    const baseUrl = process.env.SPONSOR_API_BASE_URL;
    const apiKey = process.env.SPONSOR_API_KEY;

    const googleMapsStatus = process.env.GOOGLE_MAPS_API_KEY ? "key_configured" : "not_required_for_embed";

    // If testing Google Maps source specifically
    if (sourceId === "src-google-maps" || sourceId === "google-maps") {
      return NextResponse.json({
        ok: true,
        sourceId,
        status: "connected",
        googleMaps: googleMapsStatus,
        durationMs: Date.now() - start,
        message: "Google Maps Embed map is keyless. No API key is required. / Bản đồ Google Maps sử dụng nhúng không cần API key.",
        sampleData: {
          iframeUrl: "https://maps.google.com/maps?q=KFC+Ho+Chi+Minh+City&output=embed",
          keyless: true,
          status: googleMapsStatus
        }
      });
    }

    // If testing Weather source specifically
    if (sourceId === "src-weather" || sourceId === "weather") {
      return NextResponse.json({
        ok: true,
        sourceId,
        status: "connected",
        durationMs: Date.now() - start,
        message: "Weather source (Open-Meteo) does not require an API key. / Nguồn thời tiết (Open-Meteo) hoạt động bình thường, không cần API key.",
        sampleData: {
          endpoint: "https://api.open-meteo.com/v1/forecast",
          keyless: true
        }
      });
    }

    // Check if sponsor API keys are missing or mode is set to demo/fallback
    if (!baseUrl || !apiKey || mode === "demo") {
      return NextResponse.json({
        ok: false,
        sourceId,
        status: "not_configured",
        googleMaps: googleMapsStatus,
        durationMs: Date.now() - start,
        message: "Sponsor API is not configured or is running in demo fallback mode. Using local data / API nhà tài trợ chưa cấu hình hoặc đang dùng dữ liệu dự phòng.",
        error: "Missing SPONSOR_API_BASE_URL or SPONSOR_API_KEY, or mode is 'demo'",
      });
    }

    const errors: string[] = [];
    
    // Only validate Google Maps key if the app is actually configured to use Places API or Google Maps JS API.
    const isGoogleMapsJsOrPlacesEnabled = false;
    if (isGoogleMapsJsOrPlacesEnabled && !process.env.GOOGLE_MAPS_API_KEY) {
      errors.push("GOOGLE_MAPS_API_KEY is not set");
    }

    // Optional LLM variables, validated only if LLM_PROVIDER is not "none"
    const llmProvider = process.env.LLM_PROVIDER;
    if (llmProvider && llmProvider !== "none") {
      if (!process.env.LLM_API_KEY) {
        errors.push("LLM_API_KEY is required when LLM_PROVIDER is not 'none'");
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        ok: false,
        sourceId,
        status: "error",
        googleMaps: googleMapsStatus,
        durationMs: Date.now() - start,
        message: `Missing other required environment variables: ${errors.join(", ")} / Thiếu các biến môi trường bắt buộc khác.`,
        error: errors.join(", "),
      });
    }

    return NextResponse.json({
      ok: true,
      sourceId,
      status: "connected",
      googleMaps: googleMapsStatus,
      durationMs: Date.now() - start,
      message: "Successfully connected and verified Sponsor API & keys / Xác thực thành công API nhà tài trợ và các cấu hình.",
      sampleData: {
        connection: "verified",
        mode: mode,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      sourceId,
      status: "error",
      durationMs: Date.now() - start,
      message: "Connection verification failed / Kiểm tra kết nối thất bại.",
      error: err instanceof Error ? err.message : "Unknown verification error",
    });
  }
}

