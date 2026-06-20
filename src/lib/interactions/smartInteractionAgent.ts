// Smart Interaction Agent
// =======================
// Answers questions from managers, staff, and (in draft mode) customers, using
// the Store Operating Profile, weather signal, action plan, risk intelligence,
// and knowledge base as context. Sensitive customer replies are returned as
// drafts requiring approval — never sent automatically.
//
// The agent uses the LLM (camate-llm-sdk) with a tightly-scoped system
// prompt and the structured context as grounding. It falls back to a
// deterministic retrieval-style answer if the LLM is unavailable.

import type { KfcStore } from "@/lib/stores/seed-stores";
import type { StoreOperatingProfile } from "@/lib/storeProfile/storeOperatingProfile";
import type { ActionPlan, WeatherSignal, ManagerBriefing } from "@/lib/types";
import type { RiskIntelligenceResult } from "@/lib/operations/riskIntelligenceAgent";
import type { KnowledgeSnippet } from "@/lib/knowledge/documentIntelligenceAgent";
import { llmComplete } from "@/lib/llm";

export type InteractionRole = "manager" | "staff" | "customer";

export interface SmartInteractionAnswer {
  role: InteractionRole;
  question: string;
  answer: string;
  sources: { label: string; value: string }[];
  confidence: number;
  needsApproval: boolean;
  draftReply?: string; // for customer role — a draft reply requiring approval
  escalateToHuman: boolean;
  mode: "live" | "fallback";
  timestamp: string;
}

function buildContext(args: {
  store: KfcStore;
  profile: StoreOperatingProfile;
  weather: WeatherSignal;
  plan: ActionPlan;
  briefing: ManagerBriefing;
  risk: RiskIntelligenceResult;
}): string {
  const { store, profile, weather, plan, briefing, risk } = args;
  const lunch = plan.slots[0];
  const dinner = plan.slots[1];
  return [
    `STORE: ${store.name} (${profile.operatingType}, ${store.district})`,
    `WEATHER: ${weather.isLive ? "LIVE" : "FALLBACK"} — ${weather.temperatureC}°C, rain risk ${(weather.rainRiskScore * 100).toFixed(0)}%, delivery disruption ${(weather.deliveryDisruptionRisk * 100).toFixed(0)}%, walk-in drop ${(weather.walkInDropRisk * 100).toFixed(0)}%.`,
    `PLAN: overall risk ${(plan.overallRisk * 100).toFixed(0)}%, confidence ${(plan.confidence * 100).toFixed(0)}%.`,
    `LUNCH ${lunch.windowLabel}: walk-in ${lunch.expectedWalkInDelta}%, delivery ${lunch.expectedDeliveryDelta}%, prep ${lunch.prepBatchDelta}%, staffing ${lunch.staffingDelta >= 0 ? "+" : ""}${lunch.staffingDelta}.`,
    `DINNER ${dinner.windowLabel}: walk-in ${dinner.expectedWalkInDelta}%, delivery ${dinner.expectedDeliveryDelta}%, prep ${dinner.prepBatchDelta}%, staffing ${dinner.staffingDelta >= 0 ? "+" : ""}${dinner.staffingDelta}.`,
    `PREP: ${plan.prepRecommendation}`,
    `STAFFING: ${plan.staffingRecommendation}`,
    `DELIVERY READINESS: ${plan.deliveryReadiness}`,
    `CAMPAIGN: ${plan.campaignRecommendation}`,
    `REAL-TIME: walk-in trend ${risk.metrics.walkInTrend}%, delivery surge ${risk.metrics.deliverySurge}%, stockout prob ${(risk.metrics.stockoutProbability * 100).toFixed(0)}%, staffing fit ${(risk.metrics.staffingFit * 100).toFixed(0)}%, waste trend ${risk.metrics.wasteTrend}%.`,
    `ALERTS: ${risk.alerts.length ? risk.alerts.map((a) => `${a.title} (${a.severity})`).join("; ") : "none"}`,
    `STORE RULES: ${profile.operatingRules.join(" | ")}`,
    `PREP PHILOSOPHY: ${profile.prepPhilosophy}`,
    `CAMPAIGN BIAS: ${profile.campaignBias}`,
    `BRIEFING HEADLINE: ${briefing.headline}`,
  ].join("\n");
}

function systemPromptFor(role: InteractionRole): string {
  const base = `Bạn là Agent CaMate - Trợ lý AI đồng quản lý ca cho các cửa hàng KFC tại Thành phố Hồ Chí Minh.
Bạn sẽ trả lời các câu hỏi dựa trên bối cảnh vận hành (CONTEXT) được cung cấp (thời tiết, kế hoạch ca trực, chỉ số thực tế, cơ cấu cửa hàng). Tuyệt đối không tự bịa đặt thông tin.
Nếu dữ liệu trong bối cảnh không đủ hoặc không liên quan đến ca trực hiện tại để trả lời, bạn PHẢI trả lời chính xác: "Tôi chưa có đủ dữ liệu để kết luận."

Định dạng câu trả lời BẮT BUỘC theo cấu trúc sau:
- **Kết luận nhanh**: [Tóm tắt ngắn gọn câu trả lời]
- **Bằng chứng**: [Nêu rõ số liệu, thời tiết, hoặc thông tin cụ thể từ CONTEXT làm căn cứ]
- **Khuyến nghị hành động**: [Các bước hành động cụ thể cho ca trực]
- **Mức độ tin cậy**: [Cao / Trung bình / Thấp kèm lý do ngắn gọn]

Không sử dụng emoji, không viết lan man, tập trung hoàn toàn vào bối cảnh F&B thực tế.`;
  switch (role) {
    case "manager":
      return `${base}
Bạn đang trả lời QUẢN LÝ CỬA HÀNG. Trả lời trực diện, trích dẫn dữ liệu thực tế và đưa ra khuyến nghị rõ ràng. Khi giải thích lý do, hãy đi theo chuỗi logic (thời tiết → rủi ro → quyết định ca trực).`;
    case "staff":
      return `${base}
Bạn đang trả lời NHÂN VIÊN CA TRỰC. Trả lời cực kỳ ngắn gọn, sử dụng các gạch đầu dòng rõ ràng, tập trung vào hành động thực tế cần làm ngay lập tức.`;
    case "customer":
      return `${base}
Bạn đang soạn bản nháp phản hồi KHÁCH HÀNG. Hãy lịch sự, đồng cảm và ngắn gọn. Bạn KHÔNG được tự ý hứa hẹn hoàn tiền, tặng món hay phá vỡ quy định — nếu khách yêu cầu, hãy soạn nháp ghi nhận ý kiến và thông báo quản lý sẽ liên hệ lại, đồng thời đặt cờ needsApproval=true. Không xác nhận trạng thái đơn hàng khi không có dữ liệu.`;
  }
}

function fallbackAnswer(args: {
  role: InteractionRole;
  question: string;
  store: KfcStore;
  profile: StoreOperatingProfile;
  weather: WeatherSignal;
  plan: ActionPlan;
  briefing: ManagerBriefing;
  risk: RiskIntelligenceAgent_fallback_ctx;
}): SmartInteractionAnswer {
  const { role, question, store, profile, weather, plan, briefing, risk } = args;
  const lunch = plan.slots[0];
  const q = question.toLowerCase();
  let answer = "";
  const sources: { label: string; value: string }[] = [
    { label: "Tín hiệu thời tiết", value: weather.isLive ? "thực tế" : "dự phòng" },
    { label: "Kế hoạch hành động", value: `rủi ro ${(plan.overallRisk * 100).toFixed(0)}%` },
  ];

  // Check if we don't have enough data to answer
  const isOutOfContext = 
    q.includes("doanh thu tháng sau") || 
    q.includes("ngày mai") || 
    q.includes("tuần sau") || 
    q.includes("lương") || 
    q.includes("tuyển dụng") || 
    q.includes("khách hàng giận");

  if (isOutOfContext) {
    answer = "Tôi chưa có đủ dữ liệu để kết luận.";
  } else if (role === "manager") {
    if (q.includes("prep") || q.includes("batch") || q.includes("chiên") || q.includes("bếp") || q.includes("chuẩn bị")) {
      answer = `- **Kết luận nhanh**: Điều chỉnh lượng chế biến ca trưa lệch ${lunch.prepBatchDelta}% so với mức chuẩn tại ${store.name}.
- **Bằng chứng**: Hiệu suất sử dụng bếp thực tế đạt ${(risk.metrics.prepUtilization * 100).toFixed(0)}%, rủi ro giảm khách sảnh là ${(weather.walkInDropRisk * 100).toFixed(0)}%.
- **Khuyến nghị hành động**: ${lunch.prepBatchDelta < 0 ? "Chủ động cắt giảm kích thước mẻ sớm để tránh tồn dư hao hụt gà chiên." : "Duy trì tần suất mẻ chiên tiêu chuẩn theo KDS."}
- **Mức độ tin cậy**: Cao (Dữ liệu đồng bộ trực tiếp từ phân tích ca trực).`;
      sources.push({ label: "Khuyến nghị bếp", value: plan.prepRecommendation.slice(0, 80) });
    } else if (q.includes("why") || q.includes("tại sao") || q.includes("lý do") || q.includes("do đâu")) {
      answer = `- **Kết luận nhanh**: Quyết định điều phối được đưa ra do rủi ro gián đoạn từ thời tiết ẩm ướt.
- **Bằng chứng**: Rủi ro mưa ${(weather.rainRiskScore * 100).toFixed(0)}%, rủi ro giao hàng gián đoạn ${(weather.deliveryDisruptionRisk * 100).toFixed(0)}%, rủi ro khách sảnh giảm ${(weather.walkInDropRisk * 100).toFixed(0)}%.
- **Khuyến nghị hành động**: Giảm lượng chế biến sảnh và tăng chuẩn bị bao bì, liên hệ tài xế dự phòng cho đơn giao hàng.
- **Mức độ tin cậy**: Cao (Phân tích bối cảnh cửa hàng ${profile.operatingType}).`;
      sources.push({ label: "Yếu tố rủi ro", value: plan.risks.slice(0, 3).map((r) => r.factor).join(", ") });
    } else if (q.includes("staff") || q.includes("nhân sự") || q.includes("ca") || q.includes("người") || q.includes("điều phối")) {
      answer = `- **Kết luận nhanh**: Ca trưa lệch ${lunch.staffingDelta >= 0 ? "+" : ""}${lunch.staffingDelta} người, ca tối lệch ${plan.slots[1].staffingDelta >= 0 ? "+" : ""}${plan.slots[1].staffingDelta} người.
- **Bằng chứng**: Mức độ phù hợp nhân sự thực tế đạt ${(risk.metrics.staffingFit * 100).toFixed(0)}%.
- **Khuyến nghị hành động**: ${risk.metrics.staffingFit < 0.6 ? "Phát hiện lệch nhân sự lớn - điều chuyển nhân viên quầy sang hỗ trợ đóng gói giao hàng." : "Duy trì bố trí nhân sự hiện tại."}
- **Mức độ tin cậy**: Trung bình (Đánh giá theo thời gian thực).`;
      sources.push({ label: "Khuyến nghị nhân sự", value: plan.staffingRecommendation.slice(0, 80) });
    } else if (q.includes("waste") || q.includes("dư") || q.includes("hao hụt") || q.includes("hủy")) {
      answer = `- **Kết luận nhanh**: Rủi ro hao hụt hiện tại ở mức ${risk.metrics.wasteTrend > 15 ? "Cao" : "Kiểm soát tốt"}.
- **Bằng chứng**: Xu hướng hao hụt thực tế đạt ${risk.metrics.wasteTrend}%.
- **Khuyến nghị hành động**: ${risk.metrics.wasteTrend > 15 ? "Cắt giảm 15% lượng mẻ tiếp theo để tránh tồn dư." : "Tiếp tục theo dõi sát lượng khách vào sảnh."}
- **Mức độ tin cậy**: Cao (Dữ liệu bếp thời gian thực).`;
      sources.push({ label: "Xu hướng hao hụt", value: `${risk.metrics.wasteTrend}%` });
    } else if (q.includes("delivery") || q.includes("giao hàng") || q.includes("ship")) {
      answer = `- **Kết luận nhanh**: Đơn giao hàng tăng ${risk.metrics.deliverySurge}%, rủi ro gián đoạn giao hàng ở mức ${(weather.deliveryDisruptionRisk * 100).toFixed(0)}%.
- **Bằng chứng**: Thời tiết mưa gió lớn cản trở tài xế di chuyển, đẩy nhu cầu đặt online tăng cao.
- **Khuyến nghị hành động**: ${weather.deliveryDisruptionRisk > 0.5 ? "Liên hệ thêm tài xế dự phòng và tăng thời gian giao hàng dự kiến thêm 10 phút." : "Điều phối tài xế bình thường."}
- **Mức độ tin cậy**: Cao (Tích hợp Open-Meteo và dữ liệu sảnh).`;
      sources.push({ label: "Độ sẵn sàng giao hàng", value: plan.deliveryReadiness.slice(0, 80) });
    } else if (q.includes("which store") || q.includes("cửa hàng nào") || q.includes("so sánh")) {
      answer = `- **Kết luận nhanh**: Đối với ${store.name}, rủi ro tổng thể đạt ${(plan.overallRisk * 100).toFixed(0)}%.
- **Bằng chứng**: Điểm số rủi ro tính toán dựa trên loại hình cửa hàng ${profile.operatingType}.
- **Khuyến nghị hành động**: Chạy tính năng so sánh cửa hàng trên bảng so sánh để thấy sự khác biệt hành động cụ thể.
- **Mức độ tin cậy**: Cao.`;
    } else {
      answer = `- **Kết luận nhanh**: Báo cáo vận hành ca trực cho ${store.name}: ${briefing.headline}.
- **Bằng chứng**: Phân tích rủi ro tổng thể ${(plan.overallRisk * 100).toFixed(0)}%.
- **Khuyến nghị hành động**: Thực hiện các hành động ưu tiên: ${briefing.topActions.slice(0, 2).join(" | ")}.
- **Mức độ tin cậy**: Cao.`;
    }
  } else if (role === "staff") {
    if (q.includes("bao bì") || q.includes("hộp") || q.includes("túi") || q.includes("packaging")) {
      answer = `- **Kết luận nhanh**: Chuẩn bị thêm bao bì đóng gói giao hàng.
- **Bằng chứng**: Biến động đóng gói dự kiến ca trưa đạt ${lunch.expectedDeliveryDelta}%.
- **Khuyến nghị hành động**: Chuẩn bị thêm +${Math.round(Math.max(0, Math.max(lunch.expectedDeliveryDelta, plan.slots[1].expectedDeliveryDelta)))}% bao bì giao hàng và xếp sẵn tại trạm đóng gói.
- **Mức độ tin cậy**: Cao.`;
    } else if (q.includes("batch") || q.includes("chiên") || q.includes("mẻ")) {
      answer = `- **Kết luận nhanh**: Điều chỉnh mẻ chiên phù hợp với khách sảnh.
- **Bằng chứng**: Biến động mẻ chiên ca trưa dự kiến là ${lunch.prepBatchDelta}%.
- **Khuyến nghị hành động**: ${lunch.prepBatchDelta < 0 ? `Chiên các mẻ nhỏ hơn (−${Math.abs(lunch.prepBatchDelta)}%). Không chiên mẻ lớn trước 10:45.` : "Duy trì mẻ chiên tiêu chuẩn."}
- **Mức độ tin cậy**: Cao.`;
    } else if (q.includes("ưu tiên") || q.includes("priority")) {
      answer = `- **Kết luận nhanh**: Ưu tiên hỗ trợ đóng gói và bàn giao đơn hàng.
- **Bằng chứng**: Đơn giao hàng dự báo tăng ${lunch.expectedDeliveryDelta}%.
- **Khuyến nghị hành động**: Ưu tiên: ${lunch.expectedDeliveryDelta > 12 ? "đóng gói đơn online" : "quầy phục vụ + bếp"}. Chạy chương trình: ${plan.campaignRecommendation.split(".")[0]}.
- **Mức độ tin cậy**: Cao.`;
    } else {
      answer = `- **Kết luận nhanh**: Hướng dẫn vận hành ca trưa cho nhân viên.
- **Bằng chứng**: Khách sảnh ${lunch.expectedWalkInDelta}%, giao hàng ${lunch.expectedDeliveryDelta}%.
- **Khuyến nghị hành động**: ${lunch.expectedDeliveryDelta > 12 ? "Bố trí thêm 1 người chuyên đóng gói." : "Đóng gói chung."} Không chiên quá nhiều sớm.
- **Mức độ tin cậy**: Cao.`;
    }
  } else {
    // customer
    answer = `- **Kết luận nhanh**: Soạn phản hồi nháp hỗ trợ khách hàng và chuyển quản lý duyệt.
- **Bằng chứng**: Phản hồi liên quan đến sự cố dịch vụ hoặc chậm trễ.
- **Khuyến nghị hành động**: Ghi nhận ý kiến và thông báo quản lý sẽ liên hệ lại ngay. ${risk.metrics.serviceDelayRisk > 0.5 ? "Chúng tôi đang gặp phải lượng đơn hàng cao hơn bình thường do thời tiết — rất mong bạn thông cảm." : ""}
- **Mức độ tin cậy**: Cao.`;
    return {
      role,
      question,
      answer: answer,
      sources,
      confidence: 0.6,
      needsApproval: true,
      draftReply: answer,
      escalateToHuman: true,
      mode: "fallback",
      timestamp: new Date().toISOString(),
    };
  }

  return {
    role,
    question,
    answer,
    sources,
    confidence: 0.72,
    needsApproval: false,
    escalateToHuman: false,
    mode: "fallback",
    timestamp: new Date().toISOString(),
  };
}

// alias to avoid circular type
type RiskIntelligenceAgent_fallback_ctx = RiskIntelligenceResult;

/** Answer a question from a manager, staff member, or customer. */
export async function answerQuestion(args: {
  role: InteractionRole;
  question: string;
  store: KfcStore;
  profile: StoreOperatingProfile;
  weather: WeatherSignal;
  plan: ActionPlan;
  briefing: ManagerBriefing;
  risk: RiskIntelligenceResult;
  knowledge?: KnowledgeSnippet[];
}): Promise<SmartInteractionAnswer> {
  const { role, question, store, profile, weather, plan, briefing, risk, knowledge } = args;
  const context = buildContext({ store, profile, weather, plan, briefing, risk });
  const knowledgeBlock = knowledge && knowledge.length
    ? `\n\nRELEVANT KNOWLEDGE BASE SNIPPETS:\n${knowledge.map((k, i) => `${i + 1}. [${k.source}] ${k.text}`).join("\n")}`
    : "";
  const systemPrompt = systemPromptFor(role) + knowledgeBlock;
  const userMessage = `CONTEXT:\n${context}\n\nQUESTION (${role}): ${question}\n\nAnswer grounded in the context above. If the answer is not in the context or if data is insufficient, say "Tôi chưa có đủ dữ liệu để kết luận." and set escalateToHuman=true.`;

  // Check if we don't have enough data to answer
  const q = question.toLowerCase();
  const isOutOfContext = 
    q.includes("doanh thu tháng sau") || 
    q.includes("ngày mai") || 
    q.includes("tuần sau") || 
    q.includes("lương") || 
    q.includes("tuyển dụng") || 
    q.includes("khách hàng giận");

  if (isOutOfContext) {
    return {
      role,
      question,
      answer: "Tôi chưa có đủ dữ liệu để kết luận.",
      sources: [
        { label: "Tín hiệu thời tiết", value: weather.isLive ? "thực tế" : "dự phòng" },
        { label: "Kế hoạch hành động", value: `rủi ro ${(plan.overallRisk * 100).toFixed(0)}%` },
      ],
      confidence: 0.9,
      needsApproval: false,
      escalateToHuman: true,
      mode: "fallback",
      timestamp: new Date().toISOString(),
    };
  }

  const llm = await llmComplete(systemPrompt, userMessage, { timeoutMs: 12000 });

  if (llm.ok && llm.content) {
    const answer = llm.content.trim().slice(0, 600);
    const escalate = answer.includes("Tôi chưa có đủ dữ liệu để kết luận") || /escalate|don't have|not in (the )?context|no data/i.test(answer);
    const sources: { label: string; value: string }[] = [
      { label: "Tín hiệu thời tiết", value: weather.isLive ? "thực tế" : "dự phòng" },
      { label: "Kế hoạch hành động", value: `rủi ro ${(plan.overallRisk * 100).toFixed(0)}%` },
      { label: "Số liệu thực tế", value: `${risk.events.length} sự kiện` },
    ];
    if (knowledge && knowledge.length) {
      sources.push({ label: "Tài liệu SOP", value: `${knowledge.length} trích dẫn` });
    }
    return {
      role,
      question,
      answer,
      sources,
      confidence: 0.82,
      needsApproval: role === "customer",
      draftReply: role === "customer" ? answer : undefined,
      escalateToHuman: escalate,
      mode: "live",
      timestamp: new Date().toISOString(),
    };
  }

  // Fallback to deterministic retrieval-style answer.
  return fallbackAnswer({ role, question, store, profile, weather, plan, briefing, risk });
}
