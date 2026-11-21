import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type UiLang = 'hi' | 'en';

interface LangCtx {
  lang: UiLang;
  setLang: (l: UiLang) => void;
  /** Inline bilingual string: tx('नमस्ते', 'Hello') */
  tx: (hi: string, en: string) => string;
  /** Picks obj.fieldHi / obj.fieldEn from bilingual API data */
  pick: <T extends object>(obj: T | null | undefined, field: string) => string;
  /** Picks { hi, en } */
  bi: (v: { hi?: string; en?: string } | null | undefined) => string;
  formatNumber: (n: number) => string;
  formatDate: (d: string | Date, opts?: Intl.DateTimeFormatOptions) => string;
}

const Ctx = createContext<LangCtx | null>(null);
const KEY = 'gk_lang';

function initialLang(): UiLang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'hi' || saved === 'en') return saved;
  } catch {
    /* storage blocked */
  }
  return 'hi'; // Hindi-first product
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>(initialLang);

  const setLang = useCallback((l: UiLang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LangCtx>(() => {
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
    return {
      lang,
      setLang,
      tx: (hi, en) => (lang === 'hi' ? hi : en),
      pick: (obj, field) => {
        if (!obj) return '';
        const o = obj as Record<string, unknown>;
        const v = o[`${field}${lang === 'hi' ? 'Hi' : 'En'}`] ?? o[`${field}${lang === 'hi' ? 'En' : 'Hi'}`];
        return typeof v === 'string' ? v : '';
      },
      bi: (v) => (v ? (lang === 'hi' ? v.hi ?? v.en : v.en ?? v.hi) ?? '' : ''),
      // Latin digits are used in both languages, matching Indian school textbooks
      formatNumber: (n) => new Intl.NumberFormat('en-IN').format(n),
      formatDate: (d, opts) => new Intl.DateTimeFormat(locale, opts ?? { day: 'numeric', month: 'short' }).format(new Date(d)),
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}
