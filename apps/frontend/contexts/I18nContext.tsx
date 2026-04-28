"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

type Locale = "en" | "vi";
type Messages = typeof en;

const MESSAGES: Record<Locale, Messages> = { en, vi };
const STORAGE_KEY = "aichat.locale";

function getNestedValue(obj: unknown, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, defaultValue?: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (_key, defaultValue = "") => defaultValue,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === "en" || saved === "vi") {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  const t = useCallback(
    (key: string, defaultValue = ""): string => {
      return getNestedValue(MESSAGES[locale], key) ?? defaultValue;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
