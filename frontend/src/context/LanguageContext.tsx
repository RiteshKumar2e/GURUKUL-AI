import { toHinglish } from '@/lib/hinglish';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** hi = Hindi (Devanagari), en = English, hg = Hinglish (Hindi in Roman letters) */
export type UiLang = 'hi' | 'en' | 'hg';

/** Language code the tutor API expects for a UI language. */
export const tutorLanguageFor = (l: UiLang) => ({ hi: 'HI', en: 'EN', hg: 'HG' } as const)[l];
/** Language stored on the user profile (Hinglish readers get Hindi content). */
export const profileLanguageFor = (l: UiLang) => (l === 'en' ? 'EN' : 'HI');

interface LangCtx {
  lang: UiLang;
  setLang: (l: UiLang | ((current: UiLang) => UiLang)) => void;
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
    if (saved === 'hi' || saved === 'en' || saved === 'hg') return saved;
  } catch {
    /* storage blocked */
  }
  return 'hi'; // Hindi-first product
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>(initialLang);

  const setLang = useCallback((l: UiLang | ((current: UiLang) => UiLang)) => setLangState(l), []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang === 'hg' ? 'hi-Latn' : lang;
  }, [lang]);

  const value = useMemo<LangCtx>(() => {
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
    // Bilingual API data has Hindi and English only; Hinglish readers get the Roman-script (English) text
    const dataHi = lang === 'hi';
    return {
      lang,
      setLang,
      tx: (hi, en) => (lang === 'hi' ? hi : lang === 'hg' ? toHinglish(en) ?? en : en),
      pick: (obj, field) => {
        if (!obj) return '';
        const o = obj as Record<string, unknown>;
        const v = o[`${field}${dataHi ? 'Hi' : 'En'}`] ?? o[`${field}${dataHi ? 'En' : 'Hi'}`];
        return typeof v === 'string' ? v : '';
      },
      bi: (v) => (v ? (dataHi ? v.hi ?? v.en : v.en ?? v.hi) ?? '' : ''),
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
