"use client";

import * as React from "react";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Send,
  FileText,
  ClipboardList,
  Mail,
  PackagePlus,
  Megaphone,
  AlertTriangle,
  Users,
  ClipboardCheck,
  Clock,
  ShieldCheck,
  Loader2,
  Inbox,
  CircleDot,
  CheckCheck,
  ListFilter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AutomationTask, TaskCategory, TaskStatus } from "@/lib/automation/approvalWorkflow";
import { submitForApproval } from "@/lib/automation/approvalWorkflow";
import { useT } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client/fetchJson";

const CATEGORY_ICONS: Record<TaskCategory, React.ElementType> = {
  briefing: FileText,
  checklist: ClipboardList,
  "staff-message": Users,
  "manager-email": Mail,
  "supplier-order": PackagePlus,
  "incident-report": AlertTriangle,
  campaign: Megaphone,
  "customer-reply": Send,
  "staff-roster-change": Users,
  "end-of-day-summary": ClipboardCheck,
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  "pending-approval": "risk-bg-medium risk-border-medium risk-text-medium",
  approved: "risk-bg-low risk-border-low risk-text-low",
  rejected: "risk-bg-high risk-border-high risk-text-high",
  executed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  expired: "bg-slate-500/15 text-slate-500 border-slate-500/40",
};

const RISK_BORDER_COLORS: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-emerald-500",
};

const RISK_GRADIENT_LEFT: Record<string, string> = {
  high: "from-red-500/10 via-transparent to-transparent",
  medium: "from-amber-500/8 via-transparent to-transparent",
  low: "from-emerald-500/6 via-transparent to-transparent",
};

function TaskCard({
  task,
  onApprove,
  onReject,
  onExecute,
  index,
}: {
  task: AutomationTask;
  onApprove: (t: AutomationTask) => void;
  onReject: (t: AutomationTask) => void;
  onExecute: (t: AutomationTask) => void;
  index: number;
}) {
  const Icon = CATEGORY_ICONS[task.category] ?? Bot;
  const [open, setOpen] = React.useState(false);
  const riskLevelKey = task.approval.riskLevel;
  return (
    <div
      className={cn(
        "animate-fade-in-up rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:translate-y-[-1px]",
        "border-l-4",
        RISK_BORDER_COLORS[riskLevelKey] ?? "border-l-muted",
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-muted to-muted/50">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold">{task.title}</span>
            <Badge variant="outline" className={cn("shrink-0 text-[10px] font-semibold uppercase", STATUS_STYLES[task.status])}>
              {task.status}
            </Badge>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{task.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {new Date(task.generatedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="flex items-center gap-0.5">
              <ShieldCheck className={cn("h-2.5 w-2.5", task.approval.riskLevel === "high" ? "risk-text-high" : task.approval.riskLevel === "medium" ? "risk-text-medium" : "risk-text-low")} />
              {task.approval.riskLevel} risk
            </span>
            <span className="tabular-nums">{(task.confidence * 100).toFixed(0)}% conf</span>
          </div>
        </div>
      </div>

      {task.approval.requiresApproval && task.status === "draft" && (
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" variant="outline" className="h-6 gap-1 text-[11px]" onClick={() => onApprove(submitForApproval(task))}>
            <Send className="h-3 w-3" /> Submit for approval
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 text-[11px]">View draft</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" /> {task.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-md bg-muted/50 p-2 text-xs">
                  <span className="font-semibold">Reason: </span>{task.reason}
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-xs">
                  <span className="font-semibold">Data used: </span>{task.dataUsed.join(", ")}
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-xs">
                  <span className="font-semibold">Risk note: </span>{task.riskNote}
                </div>
                <Separator />
                <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-md border bg-card p-3 text-xs scrollbar-thin">{task.content}</pre>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {task.status === "pending-approval" && (
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" variant="default" className="h-6 gap-1 bg-emerald-600 hover:bg-emerald-700 text-[11px]" onClick={() => onApprove(task)}>
            <CheckCircle2 className="h-3 w-3" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="h-6 gap-1 text-[11px]" onClick={() => onReject(task)}>
            <XCircle className="h-3 w-3" /> Reject
          </Button>
        </div>
      )}

      {task.status === "approved" && (
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" variant="default" className="h-6 gap-1 text-[11px]" onClick={() => onExecute(task)}>
            <Send className="h-3 w-3" /> Execute / Export
          </Button>
        </div>
      )}

      {task.status === "executed" && task.executedAt && (
        <div className="mt-1.5 text-[10px] text-emerald-600">
          ✓ Executed {new Date(task.executedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}

export interface AutomationCenterProps {
  storeId: string | null;
  className?: string;
}

const FILTER_CONFIG = [
  { key: "all" as const, label: "All", icon: ListFilter },
  { key: "needs-approval" as const, label: "Needs Approval", icon: CircleDot },
  { key: "approved" as const, label: "Approved", icon: CheckCircle2 },
  { key: "history" as const, label: "History", icon: CheckCheck },
];

export function AutomationCenter({ storeId, className }: AutomationCenterProps) {
  const t = useT();
  const [tasks, setTasks] = React.useState<AutomationTask[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "needs-approval" | "approved" | "history">("all");

  // Fetch tasks when storeId changes.
  React.useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    queueMicrotask(() => {
      setLoading(true);
    });
    fetchJson<{ tasks: AutomationTask[] }>("/api/automation/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId }),
    })
      .then((data) => {
        if (cancelled) return;
        // Auto-submit non-sensitive tasks (they become approved); sensitive stay as draft.
        const submitted = data.tasks.map((task) => submitForApproval(task));
        setTasks(submitted);
      })
      .catch(() => toast.error("Failed to load automation tasks"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const handleApprove = React.useCallback(async (task: AutomationTask) => {
    try {
      const data = await fetchJson<{ task: AutomationTask }>("/api/automation/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, action: "approve", by: "store-manager" }),
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
      toast.success(`Task approved: ${task.title}`);
    } catch {
      toast.error("Approval failed");
    }
  }, []);

  const handleReject = React.useCallback(async (task: AutomationTask) => {
    try {
      const data = await fetchJson<{ task: AutomationTask }>("/api/automation/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, action: "reject", by: "store-manager", note: "Rejected by manager" }),
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
      toast.info(`Task rejected: ${task.title}`);
    } catch {
      toast.error("Reject failed");
    }
  }, []);

  const handleExecute = React.useCallback(async (task: AutomationTask) => {
    try {
      const data = await fetchJson<{ task: AutomationTask }>("/api/automation/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, action: "execute", by: "store-manager" }),
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
      toast.success(`Task executed/exported: ${task.title}`);
    } catch {
      toast.error("Execute failed");
    }
  }, []);

  const filtered = React.useMemo(() => {
    if (filter === "needs-approval") return tasks.filter((t) => t.status === "pending-approval");
    if (filter === "approved") return tasks.filter((t) => t.status === "approved");
    if (filter === "history") return tasks.filter((t) => t.status === "executed" || t.status === "rejected");
    return tasks;
  }, [tasks, filter]);

  const counts = React.useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending-approval").length,
    approved: tasks.filter((t) => t.status === "approved").length,
    executed: tasks.filter((t) => t.status === "executed").length,
  }), [tasks]);

  return (
    <Card className={cn("card-interactive overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-[var(--brand)]" />
              Automation Center
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Generated operational tasks · drafts + human approval for sensitive actions
            </p>
          </div>
        </div>

        {/* Summary row with colored indicators */}
        <div className="mt-2 grid grid-cols-4 gap-2">
          <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
              <ListFilter className="h-2.5 w-2.5 text-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">Total</div>
              <div className="text-sm font-bold tabular-nums leading-none">{counts.total}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full risk-bg-medium">
              <CircleDot className="h-2.5 w-2.5 risk-text-medium" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">Pending</div>
              <div className="text-sm font-bold tabular-nums leading-none risk-text-medium">{counts.pending}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full risk-bg-low">
              <CheckCircle2 className="h-2.5 w-2.5 risk-text-low" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">Approved</div>
              <div className="text-sm font-bold tabular-nums leading-none risk-text-low">{counts.approved}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCheck className="h-2.5 w-2.5 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">Executed</div>
              <div className="text-sm font-bold tabular-nums leading-none text-emerald-700">{counts.executed}</div>
            </div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="mt-2 flex flex-wrap gap-1">
          {FILTER_CONFIG.map((f) => {
            const FilterIcon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-all",
                  filter === f.key
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm shadow-[var(--brand)]/20"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground hover:border-accent-foreground/20",
                )}
              >
                <FilterIcon className="h-3 w-3" />
                {f.label}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[520px] pr-3">
            <div className="flex flex-col gap-2">
              {filtered.map((task, i) => (
                <TaskCard key={task.id} task={task} index={i} onApprove={handleApprove} onReject={handleReject} onExecute={handleExecute} />
              ))}
              {filtered.length === 0 && (
                <div className="animate-fade-in-up flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Inbox className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">No tasks in this view</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {filter === "needs-approval"
                        ? "All tasks have been reviewed. New tasks will appear here when generated."
                        : filter === "approved"
                          ? "No approved tasks yet. Approve pending tasks to see them here."
                          : filter === "history"
                            ? "No completed or rejected tasks yet. They will appear here after processing."
                            : "Run the agent to generate automation tasks for this store."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
        {/* Approval warning box */}
        <div className="relative mt-3 overflow-hidden rounded-lg border risk-border-medium">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/8 via-transparent to-transparent" />
          <div className="relative flex items-start gap-2.5 p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
              <ShieldCheck className="h-3.5 w-3.5 risk-text-medium" />
            </div>
            <span className="text-[11px] text-muted-foreground leading-relaxed">
              <strong className="risk-text-medium">Human approval required</strong> for: supplier orders, staff messages, campaigns, customer replies, roster changes.
              No real email / message / order / campaign is sent without manager approval. All decisions are audit-logged.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
