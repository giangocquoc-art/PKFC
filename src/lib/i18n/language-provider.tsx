"use client";

import * as React from "react";
import { dictionaries, type Dictionary, type Lang } from "@/lib/i18n/dictionaries";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dictionary;
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "camate.lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(() => {
    if (typeof window === "undefined") return "vi";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (stored === "en" || stored === "vi") {
        return stored;
      }
      const nav = navigator.language.toLowerCase();
      if (nav.startsWith("vi")) return "vi";
    } catch {
      // ignore
    }
    return "vi";
  });


  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const value = React.useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t: dictionaries[lang] }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLang must be used within LanguageProvider");
  }
  return ctx;
}

/** Convenience hook returning just the dictionary. */
export function useT(): Dictionary {
  return useLang().t;
}
