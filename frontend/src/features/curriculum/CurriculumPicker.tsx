import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLang } from '@/context/LanguageContext';
import { api } from '@/services/api';
import type { CatalogOptions, CatalogSubject, Lang, SchoolStage, Stream, StudentCurriculum, Verification } from '@/types/api';
import { Alert, Badge, Select, Skeleton } from '@/components/ui';

export interface CurriculumValue {
  board: string;
  session: string;
  classLevel: number | null;
  medium: Lang;
  stream: Stream | null;
  subjects: string[];
}

export const emptyCurriculum = (medium: Lang): CurriculumValue => ({ board: 'JAC', session: '', classLevel: null, medium, stream: null, subjects: [] });

export function fromStudent(c: StudentCurriculum): CurriculumValue {
  return { board: c.board.code, session: c.session.code, classLevel: c.classLevel, medium: c.medium, stream: c.stream, subjects: c.subjects.map((s) => s.slug) };
}

export const isComplete = (v: CurriculumValue) => !!(v.board && v.session && v.classLevel && v.subjects.length);

const STAGES: Array<{ stage: SchoolStage; hi: string; en: string }> = [
  { stage: 'PRIMARY', hi: 'प्राथमिक (1–5)', en: 'Primary (1–5)' },
  { stage: 'MIDDLE', hi: 'उच्च प्राथमिक (6–8)', en: 'Middle (6–8)' },
  { stage: 'SECONDARY', hi: 'माध्यमिक (9–10)', en: 'Secondary (9–10)' },
  { stage: 'SENIOR_SECONDARY', hi: 'उच्च माध्यमिक (11–12)', en: 'Senior secondary (11–12)' },
];

const STREAMS: Array<{ v: Stream; hi: string; en: string }> = [
  { v: 'SCIENCE', hi: 'विज्ञान', en: 'Science' },
  { v: 'COMMERCE', hi: 'वाणिज्य', en: 'Commerce' },
  { v: 'HUMANITIES', hi: 'मानविकी (कला)', en: 'Humanities' },
];

export function VerificationBadge({ status }: { status: Verification | null }) {
  const { tx } = useLang();
  if (status === 'VERIFIED') return <Badge tone="good">{tx('आधिकारिक रूप से जाँचा', 'Officially verified')}</Badge>;
  if (status === 'PARTIAL') return <Badge tone="saffron">{tx('आंशिक रूप से जाँचा', 'Partly verified')}</Badge>;
  if (status === 'NOT_AVAILABLE') return <Badge tone="bad">{tx('उपलब्ध नहीं', 'Not available')}</Badge>;
  return <Badge>{tx('बोर्ड से जाँचा नहीं गया', 'Not checked for this board')}</Badge>;
}

/** What a subject offers today: full lessons, an official chapter list, or book details only. */
export function ContentLevel({ s }: { s: Pick<CatalogSubject, 'hasLessons' | 'chaptersListed' | 'chapterCount'> }) {
  const { tx } = useLang();
  if (s.hasLessons) return <span className="text-xs font-semibold text-good-700">{tx('पाठ और अभ्यास उपलब्ध', 'Lessons and practice')}</span>;
  if (s.chaptersListed) return <span className="text-xs text-ink-600">{tx(`${s.chaptersListed} अध्यायों की आधिकारिक सूची`, `Official list of ${s.chaptersListed} chapters`)}</span>;
  return <span className="text-xs text-ink-600">{s.chapterCount ? tx(`पुस्तक: ${s.chapterCount} अध्याय`, `Book: ${s.chapterCount} chapters`) : tx('पुस्तक की जानकारी', 'Book details')}</span>;
}

const card = (on: boolean, disabled = false) =>
  `min-h-[44px] rounded-md border-2 px-3 py-2 text-left ${disabled ? 'cursor-not-allowed border-ink-300 bg-ink-50 text-ink-500' : on ? 'border-ink-950 bg-saffron-100 shadow-brut-sm' : 'border-ink-950 bg-white hover:bg-saffron-50'}`;

/**
 * Class, board, session, medium, stream (11-12) and subjects. Subjects come from the server's
 * catalogue for the chosen board, session and class, so only subjects of that class can be picked.
 */
export function CurriculumPicker({ value, onChange }: { value: CurriculumValue; onChange: (v: CurriculumValue) => void }) {
  const { tx, pick } = useLang();
  const options = useQuery({ queryKey: ['catalog'], queryFn: () => api<CatalogOptions>('/catalog'), staleTime: 60 * 60_000 });
  const set = (patch: Partial<CurriculumValue>) => onChange({ ...value, ...patch });

  // Default to the current session once the options are loaded
  useEffect(() => {
    if (!value.session && options.data) set({ session: options.data.sessions.find((s) => s.isCurrent)?.code ?? options.data.sessions[0]?.code ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.data]);

  const subjects = useQuery({
    queryKey: ['catalog-subjects', value.board, value.session, value.classLevel],
    queryFn: () => api<{ available: boolean; subjects: CatalogSubject[] }>('/catalog/subjects', { query: { board: value.board, session: value.session, class: String(value.classLevel) } }),
    enabled: !!(value.board && value.session && value.classLevel),
  });
  const board = options.data?.boards.find((b) => b.code === value.board);
  const list = useMemo(() => subjects.data?.subjects ?? [], [subjects.data]);

  // Drop chosen subjects that are not in the newly selected class
  useEffect(() => {
    if (!subjects.data) return;
    const valid = value.subjects.filter((s) => list.some((x) => x.slug === s));
    if (valid.length !== value.subjects.length) set({ subjects: valid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects.data]);

  if (options.isLoading) return <Skeleton className="h-64" />;
  if (!options.data) return <Alert tone="error">{tx('विकल्प लोड नहीं हो सके। इंटरनेट जाँचें।', 'Could not load the options. Check your internet.')}</Alert>;

  const toggle = (slug: string) => set({ subjects: value.subjects.includes(slug) ? value.subjects.filter((s) => s !== slug) : [...value.subjects, slug] });
  const chooseStream = (st: Stream) => {
    const keys = options.data!.streams[st] ?? [];
    set({ stream: st, subjects: list.filter((s) => s.subjectKey && keys.includes(s.subjectKey)).map((s) => s.slug) });
  };

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="label">{tx('आपकी कक्षा', 'Your class')}</legend>
        <div className="space-y-3">
          {STAGES.map((st) => (
            <div key={st.stage}>
              <p className="mb-1 text-xs font-semibold text-ink-600">{tx(st.hi, st.en)}</p>
              <div className="flex flex-wrap gap-2">
                {options.data!.classes
                  .filter((c) => c.stage === st.stage)
                  .map((c) => (
                    <button key={c.level} type="button" aria-pressed={value.classLevel === c.level} onClick={() => set({ classLevel: c.level, stream: c.level >= 11 ? value.stream : null })} className={`${card(value.classLevel === c.level)} w-14 text-center font-display text-lg font-bold`} aria-label={pick(c, 'name')}>
                      {c.level}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">{tx('बोर्ड', 'Board')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {options.data.boards.map((b) => (
            <button key={b.code} type="button" disabled={!b.available} aria-pressed={value.board === b.code} onClick={() => set({ board: b.code, subjects: [] })} className={card(value.board === b.code, !b.available)}>
              <span className="block font-semibold">{b.code}</span>
              <span className="block text-xs">{pick(b, 'name')}</span>
              {!b.available && <span className="mt-1 block text-xs">{tx('अभी उपलब्ध नहीं', 'Not available yet')}</span>}
            </button>
          ))}
        </div>
        {board && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-700">
            <VerificationBadge status={board.status} />
            <span>{pick(board, 'note')}</span>
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select id="session" label={tx('शैक्षणिक सत्र', 'Academic session')} value={value.session} onChange={(e) => set({ session: e.target.value, subjects: [] })} hint={pick(options.data.sessions.find((s) => s.code === value.session) ?? {}, 'note') || undefined}>
          {options.data.sessions.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code}
              {s.isCurrent ? tx(' (चालू)', ' (current)') : ''}
            </option>
          ))}
        </Select>
        <div>
          <p className="label">{tx('पढ़ाई का माध्यम', 'Medium')}</p>
          <div className="grid grid-cols-2 gap-2">
            {(['HI', 'EN'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={value.medium === m} onClick={() => set({ medium: m })} className={card(value.medium === m)}>
                {m === 'HI' ? 'हिंदी' : 'English'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {value.classLevel && value.classLevel >= 11 && (
        <fieldset>
          <legend className="label">{tx('संकाय (सुझाव)', 'Stream (suggestion)')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {STREAMS.map((s) => (
              <button key={s.v} type="button" aria-pressed={value.stream === s.v} onClick={() => chooseStream(s.v)} className={card(value.stream === s.v)}>
                {tx(s.hi, s.en)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-600">{tx('संकाय चुनने से सामान्य विषय अपने-आप चुन जाते हैं। अपने स्कूल के अनुसार बदल लें।', 'Picking a stream pre-selects common subjects. Adjust them to match your school.')}</p>
        </fieldset>
      )}

      {value.classLevel && (
        <fieldset>
          <legend className="label">{tx('आपके विषय', 'Your subjects')}</legend>
          {subjects.isLoading ? (
            <Skeleton className="h-40" />
          ) : !subjects.data?.available ? (
            <Alert tone="info">{tx('इस बोर्ड का पाठ्यक्रम अभी उपलब्ध नहीं है।', 'This board’s curriculum is not available yet.')}</Alert>
          ) : list.length === 0 ? (
            <Alert tone="info">
              {tx(
                `इस सत्र में कक्षा ${value.classLevel} के लिए अभी कोई विषय नहीं है। कोई दूसरा सत्र चुनें।`,
                `No subjects are listed for Class ${value.classLevel} in this session yet. Try another session.`,
              )}
            </Alert>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((s) => {
                const on = value.subjects.includes(s.slug);
                return (
                  <li key={s.slug}>
                    <label className={`${card(on)} flex cursor-pointer items-start gap-3`}>
                      <input type="checkbox" className="mt-1 h-5 w-5 accent-ink-950" checked={on} onChange={() => toggle(s.slug)} />
                      <span className="min-w-0">
                        <span className="block font-semibold">{pick(s, 'name')}</span>
                        <ContentLevel s={s} />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-600">
            {tx('विषय और पुस्तकें NCERT की आधिकारिक पुस्तक सूची से हैं।', 'Subjects and books come from NCERT’s official textbook list.')}
          </p>
        </fieldset>
      )}
    </div>
  );
}
