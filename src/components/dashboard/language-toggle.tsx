"use client";

import * as React from "react";
import { Languages, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLang } from "@/lib/i18n/language-provider";
import { LANGS, type Lang } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
          <Languages className="h-3.5 w-3.5" />
          <span className="font-semibold">{lang.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t.language}
        </div>
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code as Lang)}
            className="cursor-pointer justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">{l.short}</span>
              {l.label}
            </span>
            {lang === l.code && <Check className="h-3.5 w-3.5 text-[var(--brand)]" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Inline pill-style toggle for compact spaces. */
export function LanguageTogglePill({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border bg-card p-0.5 text-[10px] font-bold",
        className,
      )}
      role="group"
      aria-label="Language toggle"
    >
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code as Lang)}
          className={cn(
            "rounded-full px-2 py-0.5 transition-colors",
            lang === l.code
              ? "brand-gradient text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
