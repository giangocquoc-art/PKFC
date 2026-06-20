"use client";

import * as React from "react";
import {
  BookOpen,
  Send,
  Loader2,
  FileText,
  Upload,
  Search,
  ShieldCheck,
  CornerDownRight,
  Sparkles,
  BookMarked,
  ExternalLink,
  Lightbulb,
  HelpCircle,
  CloudRain,
  ClipboardList,
  UserCog,
  Megaphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useT } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client/fetchJson";

interface KbDocument {
  id: string;
  title: string;
  source: string;
  category: string;
  uploadedAt: string;
  chunks: { id: string; text: string }[];
}

interface KbAnswer {
  answer: string;
  sources: { source: string; category: string; snippet: string; score: number }[];
  confidence: number;
  question: string;
  documents: KbDocument[];
}

const CATEGORY_COLORS: Record<string, string> = {
  sop: "bg-sky-500/15 text-sky-700 border-sky-500/40",
  "food-safety": "bg-rose-500/15 text-rose-700 border-rose-500/40",
  delivery: "bg-teal-500/15 text-teal-700 border-teal-500/40",
  refund: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  campaign: "bg-violet-500/15 text-violet-700 border-violet-500/40",
  "staff-checklist": "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  "manager-sop": "bg-indigo-500/15 text-indigo-700 border-indigo-500/40",
  faq: "bg-slate-500/15 text-slate-700 border-slate-500/40",
};

const CATEGORY_BORDER_COLORS: Record<string, string> = {
  sop: "border-l-sky-500",
  "food-safety": "border-l-rose-500",
  delivery: "border-l-teal-500",
  refund: "border-l-amber-500",
  campaign: "border-l-violet-500",
  "staff-checklist": "border-l-emerald-500",
  "manager-sop": "border-l-indigo-500",
  faq: "border-l-slate-500",
};

const CATEGORY_SOURCE_ICONS: Record<string, React.ElementType> = {
  sop: FileText,
  "food-safety": ShieldCheck,
  delivery: Send,
  refund: HelpCircle,
  campaign: Megaphone,
  "staff-checklist": ClipboardList,
  "manager-sop": UserCog,
  faq: HelpCircle,
};

const SUGGESTION_CONFIG = [
  { text: "Nhiệt độ bảo quản an toàn thực phẩm là bao nhiêu?", icon: ShieldCheck },
  { text: "Nhân viên có được phép hoàn tiền cho khách không?", icon: HelpCircle },
  { text: "Nên chạy chương trình khuyến mãi nào khi trời mưa?", icon: CloudRain },
  { text: "SOP hàng ngày của quản lý ca là gì?", icon: ClipboardList },
];

export function KnowledgeBasePanel({ className }: { className?: string }) {
  const t = useT();
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<KbAnswer | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [documents, setDocuments] = React.useState<KbDocument[]>([]);
  const [uploadText, setUploadText] = React.useState("");
  const [uploadTitle, setUploadTitle] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

  // Load document list on mount.
  React.useEffect(() => {
    fetchJson<{ documents: KbDocument[] }>("/api/knowledge/ask")
      .then((data) => setDocuments(data.documents ?? []))
      .catch(() => {});
  }, []);

  const ask = React.useCallback(async (q: string) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setQuestion(q);
    try {
      const data = await fetchJson<KbAnswer>("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      setAnswer(data);
      setDocuments(data.documents);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Knowledge base query failed");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const handleUpload = React.useCallback(async () => {
    if (!uploadText.trim() || !uploadTitle.trim()) {
      toast.error("Title and text are required");
      return;
    }
    setUploading(true);
    try {
      // Client-side: the document is added to the in-memory KB via the API.
      // We send the text and let the server add it.
      await fetchJson("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: `__upload__:${uploadTitle}:${uploadText}` }),
      });
      // The server treats __upload__ as a special prefix to add a document.
      // (For the pilot demo, documents persist in-memory per server process.)
      toast.success(`Uploaded: ${uploadTitle}`);
      setUploadText("");
      setUploadTitle("");
      // Refresh document list.
      const data = await fetchJson<{ documents: KbDocument[] }>("/api/knowledge/ask");
      setDocuments(data.documents ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [uploadText, uploadTitle]);

  return (
    <Card className={cn("card-interactive overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-[var(--brand)]" />
              Kho kiến thức & Tài liệu thông minh
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Tra cứu RAG trên SOPs, an toàn thực phẩm, giao hàng, chính sách hoàn tiền, quy tắc chiến dịch, checklist nhân viên, SOP quản lý & FAQ
            </p>
          </div>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <FileText className="h-2.5 w-2.5" />
            {documents.length} tài liệu
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ask */}
        <div>
          <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Hỏi kho kiến thức…"
                className="pl-9"
                disabled={loading}
              />
            </div>
            <Button type="submit" size="icon" disabled={loading || !question.trim()} className="shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTION_CONFIG.map((s) => {
              const SuggIcon = s.icon;
              return (
                <button
                  key={s.text}
                  onClick={() => ask(s.text)}
                  className="group flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground transition-all hover:border-[var(--brand)]/30 hover:bg-accent hover:text-foreground hover:shadow-sm"
                >
                  <SuggIcon className="h-3 w-3 transition-colors group-hover:text-[var(--brand)]" />
                  {s.text}
                </button>
              );
            })}
          </div>
        </div>

        {/* Answer */}
        {answer && (
          <div className="animate-fade-in-up-smooth overflow-hidden rounded-lg border bg-muted/30">
            <div className="flex items-center gap-1.5 border-b bg-muted/50 px-3 py-2">
              <Sparkles className="h-3 w-3 text-[var(--brand)]" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Câu trả lời</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className={cn(
                "text-[10px] font-bold tabular-nums",
                answer.confidence >= 0.75 ? "text-emerald-600" : answer.confidence >= 0.5 ? "text-amber-600" : "text-red-600",
              )}>
                Độ tin cậy {(answer.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="px-3 py-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{answer.answer}</p>
            </div>
            {answer.sources.length > 0 && (
              <div className="border-t bg-muted/20 px-3 py-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <BookMarked className="h-3 w-3" />
                  Nguồn trích dẫn
                </div>
                <div className="space-y-1.5">
                  {answer.sources.map((s, i) => {
                    const SourceIcon = CATEGORY_SOURCE_ICONS[s.category] ?? FileText;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "animate-fade-in-up rounded-md border-l-3 bg-card p-2 shadow-sm",
                          CATEGORY_BORDER_COLORS[s.category] ?? "border-l-muted",
                        )}
                        style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <SourceIcon className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] font-semibold">{s.source}</span>
                          </div>
                          <Badge variant="outline" className={cn("text-[9px]", CATEGORY_COLORS[s.category])}>{s.category}</Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{s.snippet}…</p>
                        <span className="text-[9px] text-muted-foreground">độ phù hợp: {s.score.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Upload */}
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <Upload className="h-3 w-3" />
            Tải lên SOP / Chính sách / Tài liệu
          </div>
          <div className="flex flex-col gap-2">
            <Input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Tiêu đề tài liệu (ví dụ: 'Chính sách hoàn tiền Q3')"
              disabled={uploading}
            />
            <textarea
              value={uploadText}
              onChange={(e) => setUploadText(e.target.value)}
              placeholder="Dán nội dung tài liệu vào đây…"
              disabled={uploading}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button onClick={handleUpload} disabled={uploading || !uploadText.trim() || !uploadTitle.trim()} size="sm" className="gap-1.5 self-start">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Thêm vào kho kiến thức
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Tài liệu được phân mảnh và lập chỉ mục để truy vấn từ khóa. Trong thực tế, hệ thống sẽ sử dụng LlamaIndex + Cơ sở dữ liệu Vector.
            </p>
          </div>
        </div>

        <Separator />

        {/* Document list */}
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Tài liệu trong kho kiến thức ({documents.length})
          </div>
          <ScrollArea className="h-[160px] pr-3">
            {documents.length > 0 ? (
              <div className="space-y-1">
                {documents.map((d) => (
                  <div
                    key={d.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border border-l-3 bg-card p-2 text-xs transition-colors hover:bg-accent/50",
                      CATEGORY_BORDER_COLORS[d.category] ?? "border-l-muted",
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{d.title}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant="outline" className={cn("text-[9px]", CATEGORY_COLORS[d.category])}>{d.category}</Badge>
                      <Badge variant="secondary" className="text-[9px]">{d.chunks.length} phân mảnh</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="animate-fade-in-up flex flex-col items-center justify-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <BookMarked className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tải lên tài liệu đầu tiên của bạn</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    Thêm SOP, chính sách, hoặc hướng dẫn để bắt đầu truy vấn kho kiến thức của bạn.
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
          <span>
            Câu trả lời từ kho kiến thức được đối chiếu với các đoạn trích dẫn nguồn cụ thể.
            Các phản hồi gửi cho khách hàng luôn là bản nháp — không bao giờ được gửi đi nếu không có sự phê duyệt của quản lý.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
