"use client";

/**
 * OnboardingTour — first-visit welcome + step-by-step feature tour.
 *
 * - Auto-shows a welcome dialog on first visit (localStorage flag:
 *   `camate-onboarding-completed`).
 * - 5-step tour spotlights key dashboard features with a glass tooltip card
 *   and an SVG-mask spotlight cutout over the target element.
 * - Listens for `camate:restart-tour` CustomEvents so any "Restart Tour"
 *   button (e.g. in the footer) can re-trigger the flow.
 * - Dispatches `camate:navigate` CustomEvents so the page can switch to the
 *   view a tour step lives in (e.g. Automation Center).
 *
 * Targets are located via `[data-tour-target="<id>"]` attributes placed on the
 * relevant DOM nodes. If a target is missing the card falls back to a centered
 * position with a directional hint.
 */

import * as React from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Store,
  Bot,
  LayoutGrid,
  FileText,
  HelpCircle,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "camate-onboarding-completed";
const RESTART_EVENT = "camate:restart-tour";
const NAVIGATE_EVENT = "camate:navigate";

type Stage = "idle" | "welcome" | "tour";
type ViewKey = "dashboard" | "area" | "autopilot" | "live" | "chat" | "knowledge" | "simulator";

interface TourStepDef {
  /** `data-tour-target` value to locate the highlighted element. */
  target: string;
  /** View the target lives in — the page will switch to it. */
  view: ViewKey;
  icon: React.ElementType;
  title: string;
  description: string;
  /** Short positional hint shown when the spotlight can't be drawn. */
  hint: string;
}

const TOUR_STEPS: TourStepDef[] = [
  {
    target: "store-selector",
    view: "dashboard",
    icon: Store,
    title: "Pick any of 20 KFC stores",
    description:
      "Select from 20 KFC stores across TP.HCM districts. Each store has unique characteristics — urban, mall, residential, suburban, or office area — that shape the agent's recommendations.",
    hint: "Top-left card, under the page header",
  },
  {
    target: "agent-pipeline",
    view: "dashboard",
    icon: Bot,
    title: "Watch the 8-agent pipeline",
    description:
      "The pipeline collects weather signals, analyzes risk, simulates impact, and produces a concrete action plan — all in under 5 seconds. Open the “Agent Trace” tab to inspect every step.",
    hint: "Right column, the “Agent Trace” tab",
  },
  {
    target: "view-tabs",
    view: "dashboard",
    icon: LayoutGrid,
    title: "Switch between 7 focused views",
    description:
      "Jump between Operations, Area Overview, Simulator, Automation Center, Live Monitor, Smart Interaction, and Knowledge Base — each a focused workspace for a different ops question.",
    hint: "Horizontal tab strip below the store map",
  },
  {
    target: "manager-briefing",
    view: "dashboard",
    icon: FileText,
    title: "Export a ready-to-use briefing",
    description:
      "Generate a shift-ready manager briefing — concise, structured, and tailored to the current weather risk. One click to export and share with your team.",
    hint: "Right column, top card",
  },
  {
    target: "automation-center",
    view: "autopilot",
    icon: CheckCircle2,
    title: "Approve with human-in-the-loop control",
    description:
      "The Automation Center turns the agent's plan into actionable tasks. Approve, reject, or defer each one — every decision is auditable and you stay in control.",
    hint: "Switch to the “Automation Center” tab",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

export function OnboardingTour() {
  const [stage, setStage] = React.useState<Stage>("idle");
  const [step, setStep] = React.useState(0);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // First-visit check.
  React.useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
    });
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (done !== "true") {
        const t = window.setTimeout(() => setStage("welcome"), 900);
        return () => window.clearTimeout(t);
      }
    } catch {
      // localStorage unavailable (private mode / SSR) — ignore.
    }
  }, []);

  // Restart hook — any button can dispatch `camate:restart-tour`.
  React.useEffect(() => {
    const handler = () => {
      setStep(0);
      setStage("welcome");
    };
    window.addEventListener(RESTART_EVENT, handler);
    return () => window.removeEventListener(RESTART_EVENT, handler);
  }, []);

  // Navigate the page to the view the current step lives in.
  React.useEffect(() => {
    if (stage !== "tour") return;
    const def = TOUR_STEPS[step];
    if (!def) return;
    window.dispatchEvent(
      new CustomEvent(NAVIGATE_EVENT, { detail: def.view }),
    );
  }, [stage, step]);

  const complete = React.useCallback(
    (opts?: { skipped?: boolean; silent?: boolean }) => {
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // ignore
      }
      setStage("idle");
      setStep(0);
      if (opts?.silent) return;
      if (opts?.skipped) {
        toast("Tour skipped", {
          description: "Restart it anytime from the footer.",
          icon: <HelpCircle className="h-4 w-4" />,
        });
      } else {
        toast.success("You're all set!", {
          description:
            "Agent CaMate is ready — explore the dashboard anytime.",
          icon: <CheckCircle2 className="h-4 w-4" />,
        });
      }
    },
    [],
  );

  const startTour = React.useCallback(() => {
    setStep(0);
    setStage("tour");
  }, []);

  const next = React.useCallback(() => {
    setStep((s) => {
      if (s >= TOUR_STEPS.length - 1) {
        complete();
        return s;
      }
      return s + 1;
    });
  }, [complete]);

  const back = React.useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const skip = React.useCallback(() => {
    complete({ skipped: true });
  }, [complete]);

  const maybeLater = React.useCallback(() => {
    if (dontShowAgain) {
      // Persist dismissal so it never shows again.
      complete({ silent: true });
    } else {
      // Just close — will re-show on next visit.
      setStage("idle");
    }
  }, [dontShowAgain, complete]);

  if (!mounted) return null;

  return (
    <>
      {stage === "welcome" && (
        <WelcomeDialog
          onStart={startTour}
          onSkip={maybeLater}
          dontShowAgain={dontShowAgain}
          onDontShowChange={setDontShowAgain}
        />
      )}
      {stage === "tour" && (
        <TourOverlay step={step} onNext={next} onBack={back} onSkip={skip} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Welcome dialog
// ─────────────────────────────────────────────────────────────────────────────

function WelcomeDialog({
  onStart,
  onSkip,
  dontShowAgain,
  onDontShowChange,
}: {
  onStart: () => void;
  onSkip: () => void;
  dontShowAgain: boolean;
  onDontShowChange: (v: boolean) => void;
}) {
  const features = [
    {
      icon: Store,
      title: "20 stores monitored",
      desc: "Urban, mall, residential & suburban profiles across TP.HCM",
    },
    {
      icon: Bot,
      title: "8-agent pipeline",
      desc: "From weather signal → action plan, in under 5 seconds",
    },
    {
      icon: LayoutGrid,
      title: "7 focused workspaces",
      desc: "Operations, Simulator, Automation Center & more",
    },
  ];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onSkip(); }}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        {/* Brand gradient header */}
        <div className="brand-gradient-animated relative px-6 pb-7 pt-6 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
                Agent CaMate
              </div>
              <DialogTitle className="text-xl font-bold leading-tight text-white">
                Welcome to your StoreOps Copilot
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="relative mt-3 text-sm leading-relaxed text-white/85">
            Hyperlocal weather-risk intelligence for 20 KFC stores across
            TP.HCM — convert rain risk into action plans in under 5 seconds.
          </DialogDescription>
        </div>

        {/* Feature bullets */}
        <div className="space-y-3 bg-card px-6 py-5">
          {features.map((f, i) => (
            <div
              key={i}
              className="flex items-start gap-3 animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/10 text-[var(--brand)]">
                <f.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight">
                  {f.title}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="space-y-3 border-t bg-card px-6 pb-6 pt-4">
          <div className="flex gap-2">
            <Button
              onClick={onStart}
              className="brand-gradient flex-1 gap-1.5 text-white shadow-md transition-opacity hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              Start Tour
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button onClick={onSkip} variant="ghost" className="gap-1">
              Maybe later
            </Button>
          </div>
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={dontShowAgain}
              onCheckedChange={(v) => onDontShowChange(v === true)}
            />
            Don&apos;t show this again
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tour overlay (spotlight + tooltip card)
// ─────────────────────────────────────────────────────────────────────────────

function TourOverlay({
  step,
  onNext,
  onBack,
  onSkip,
}: {
  step: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const def = TOUR_STEPS[step];
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [arrow, setArrow] = React.useState<"up" | "down" | "left" | "right" | null>(null);

  // Locate target + compute card position. Re-runs on step change, scroll,
  // and resize. A short delay lets the page switch views first.
  React.useEffect(() => {
    let raf = 0;
    let attempts = 0;
    const CARD_W = 360;
    const CARD_H_EST = 300;
    const GAP = 16;
    const PAD = 12;

    const compute = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-tour-target="${def.target}"]`,
      );
      if (!el) {
        setRect(null);
        setCardPos(null);
        setArrow(null);
        return;
      }
      // Ensure the element is in view before measuring.
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      const measure = () => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        setRect(r);

        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Prefer below the target.
        let top = r.bottom + GAP;
        let left = r.left + r.width / 2 - CARD_W / 2;
        let dir: "up" | "down" | "left" | "right" = "up"; // arrow points up toward target (card is below)

        // Horizontal clamp.
        left = Math.max(16, Math.min(vw - CARD_W - 16, left));

        // If no room below, place above.
        if (top + CARD_H_EST > vh - 16) {
          top = r.top - CARD_H_EST - GAP;
          dir = "down"; // arrow points down toward target (card is above)
          if (top < 16) {
            // No vertical room — try right side.
            top = Math.max(16, Math.min(vh - CARD_H_EST - 16, r.top));
            left = r.right + GAP;
            dir = "left";
            if (left + CARD_W > vw - 16) {
              left = r.left - CARD_W - GAP;
              dir = "right";
            }
            if (left < 16 || left + CARD_W > vw - 16) {
              // Give up — center on screen.
              top = vh / 2 - CARD_H_EST / 2;
              left = vw / 2 - CARD_W / 2;
              dir = "up";
            }
          }
        }
        setCardPos({ top, left });
        setArrow(dir);
      };
      // Allow scrollIntoView to settle before measuring.
      raf = window.requestAnimationFrame(measure);
    };

    // Retry briefly — the target may mount a tick after the view switches.
    const tryCompute = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-tour-target="${def.target}"]`,
      );
      if (el) {
        compute();
      } else if (attempts < 8) {
        attempts += 1;
        window.setTimeout(tryCompute, 80);
      } else {
        setRect(null);
        setCardPos(null);
        setArrow(null);
      }
    };
    tryCompute();

    const onResize = () => compute();
    const onScroll = () => compute();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [def.target, step]);

  // Keyboard navigation.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (step > 0) onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip, onNext, onBack, step]);

  const isLast = step === TOUR_STEPS.length - 1;
  const Icon = def.icon;

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label={`Tour step ${step + 1} of ${TOUR_STEPS.length}: ${def.title}`}
    >
      <SpotlightBackdrop rect={rect} />

      {/* Tooltip card */}
      <div
        key={step}
        className={cn(
          "glass-heavy fixed z-[102] w-[340px] max-w-[calc(100vw-2rem)] rounded-xl shadow-2xl animate-fade-in-up",
          !cardPos && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        )}
        style={
          cardPos
            ? { top: `${cardPos.top}px`, left: `${cardPos.left}px` }
            : undefined
        }
      >
        {/* Arrow pointing toward the spotlighted element */}
        {cardPos && arrow && <TourArrow dir={arrow} />}

        {/* Header */}
        <div className="flex items-start justify-between gap-2 p-4 pb-2">
          <Badge className="brand-gradient gap-1 border-0 text-white">
            <Icon className="h-3 w-3" />
            Step {step + 1} of {TOUR_STEPS.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onSkip}
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="space-y-2 px-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/10 text-[var(--brand)]">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold leading-tight">
              {def.title}
            </h3>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {def.description}
          </p>
          <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-muted-foreground/80">
            <MapPin className="h-3 w-3 shrink-0 text-[var(--brand)]" />
            <span>
              <span className="font-medium text-foreground/70">Look:</span>{" "}
              {def.hint}
            </span>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 px-4 pb-3">
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step
                  ? "brand-gradient w-6"
                  : i < step
                    ? "w-1.5 bg-[var(--brand)]/50"
                    : "w-1.5 bg-muted-foreground/30",
              )}
              aria-label={i === step ? `Step ${i + 1} (current)` : `Step ${i + 1}`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 rounded-b-xl border-t bg-card/60 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="h-8 text-xs"
          >
            Skip tour
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              disabled={step === 0}
              className="h-8 gap-1 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={onNext}
              className="brand-gradient h-8 gap-1 text-xs text-white"
            >
              {isLast ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spotlight backdrop — SVG mask cutout for the highlighted element
// ─────────────────────────────────────────────────────────────────────────────

function SpotlightBackdrop({ rect }: { rect: DOMRect | null }) {
  const [size, setSize] = React.useState({
    vw: typeof window !== "undefined" ? window.innerWidth : 1280,
    vh: typeof window !== "undefined" ? window.innerHeight : 720,
  });

  React.useEffect(() => {
    const onResize = () =>
      setSize({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!rect) {
    return (
      <div
        className="animate-fade-in fixed inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden
      />
    );
  }

  const PAD = 12;
  const top = Math.max(0, rect.top - PAD);
  const left = Math.max(0, rect.left - PAD);
  const w = rect.width + PAD * 2;
  const h = rect.height + PAD * 2;
  const { vw, vh } = size;
  const maskId = "tour-spotlight-mask";

  return (
    <>
      {/* Dim layer with a mask cutout around the target */}
      <svg
        className="animate-fade-in fixed inset-0 h-full w-full"
        style={{ pointerEvents: "all" }}
        aria-hidden
      >
        <defs>
          <mask id={maskId}>
            <rect width={vw} height={vh} fill="white" />
            <rect
              x={left}
              y={top}
              width={w}
              height={h}
              rx="14"
              ry="14"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width={vw}
          height={vh}
          fill="rgba(0, 0, 0, 0.62)"
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* Glowing border ring around the spotlight hole */}
      <div
        className="pointer-events-none fixed rounded-[14px]"
        style={{
          top: `${top}px`,
          left: `${left}px`,
          width: `${w}px`,
          height: `${h}px`,
          boxShadow:
            "0 0 0 2px var(--brand), 0 0 0 6px rgba(220, 38, 38, 0.15), 0 0 28px 4px rgba(220, 38, 38, 0.35)",
          animation: "pulse-glow 2.4s ease-in-out infinite",
        }}
        aria-hidden
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tour arrow — small triangle connecting the tooltip card to the spotlight
// ─────────────────────────────────────────────────────────────────────────────

function TourArrow({ dir }: { dir: "up" | "down" | "left" | "right" }) {
  const base =
    "absolute h-3 w-3 rotate-45 bg-[var(--glass-bg)] border-[var(--glass-border)]";
  // Position the arrow on the edge of the card that faces the target.
  const pos = {
    up: "left-1/2 -top-1.5 -translate-x-1/2 border-l border-t",
    down: "left-1/2 -bottom-1.5 -translate-x-1/2 border-b border-r",
    left: "top-1/2 -left-1.5 -translate-y-1/2 border-l border-b",
    right: "top-1/2 -right-1.5 -translate-y-1/2 border-r border-t",
  }[dir];
  return <span className={cn(base, pos)} aria-hidden />;
}
