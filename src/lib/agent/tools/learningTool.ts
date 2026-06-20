import type { ToolResult } from "./types";

export type LearningToolResult = ToolResult<{
  status: "no_data";
  message: string;
  nextStep: string;
}>;

export function learningTool(): LearningToolResult {
  const start = Date.now();

  return {
    ok: true,
    sourceMode: "missing",
    data: {
      status: "no_data",
      message: "Chưa có dữ liệu cuối ngày để AI học.",
      nextStep: "Nhập kết quả thực tế cuối ngày gồm số đơn, hao hụt, số lần đứt hàng và phản hồi quản lý để AI đối chiếu với dự báo.",
    },
    confidenceImpact: 0,
    durationMs: Date.now() - start,
  };
}
