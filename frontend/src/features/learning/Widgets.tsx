import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Target, TrendingUp } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import type { DayActivity, Recommendation, WeakTopic } from '@/types/api';
import { MasteryBar } from '@/components/ui';

/** Seven-day answered/correct bars. Plain CSS so it costs nothing on low-end phones. */
export function ActivityBars({ days }: { days: DayActivity[] }) {
  const { tx, formatDate } = useLang();
  const max = Math.max(4, ...days.map((d) => d.answered));
  const total = days.reduce((n, d) => n + d.answered, 0);
  return (
    <figure>
      <div className="flex h-28 items-end gap-2" aria-hidden>
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col justify-end">
            <div className="relative w-full rounded-t-sm bg-ink-100" style={{ height: `${(d.answered / max) * 100}%`, minHeight: d.answered ? 4 : 2 }}>
              <div className="absolute inset-x-0 bottom-0 rounded-t-sm bg-ink-800" style={{ height: d.answered ? `${(d.correct / d.answered) * 100}%` : 0 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 text-center text-[0.7rem] text-ink-600" aria-hidden>
        {days.map((d) => (
          <span key={d.date} className="flex-1">
            {formatDate(d.date, { weekday: 'narrow' })}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ink-800" /> {tx('सही', 'Correct')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ink-100" /> {tx('कुल हल किए', 'Attempted')}
        </span>
        <span className="sr-only">
          {days.map((d) => `${d.date}: ${d.correct}/${d.answered}`).join(', ')}
        </span>
        <span>{tx(`पिछले 7 दिन: ${total} प्रश्न`, `Last 7 days: ${total} questions`)}</span>
      </figcaption>
    </figure>
  );
}

const KIND = {
  REVIEW_LESSON: { icon: BookOpen, hi: 'पाठ दोहराएँ', en: 'Review lesson' },
  PRACTICE: { icon: Target, hi: 'अभ्यास करें', en: 'Practise' },
  ADVANCE: { icon: TrendingUp, hi: 'आगे बढ़ें', en: 'Move ahead' },
};

export function RecommendationList({ items }: { items: Recommendation[] }) {
  const { tx, pick } = useLang();
  return (
    <ul className="divide-y-2 divide-line overflow-hidden rounded-lg border-2 border-ink-950 bg-white">
      {items.map((r) => {
        const k = KIND[r.kind];
        const to = r.kind === 'PRACTICE' ? `/app/practice?topic=${r.topic.slug}` : `/app/learn/topics/${r.topic.slug}`;
        return (
          <li key={r.id}>
            <Link to={to} className="flex items-start gap-3 px-4 py-3 text-ink-900 no-underline hover:bg-ink-50">
              <k.icon className="mt-1 h-5 w-5 shrink-0 text-saffron-600" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-ink-600">
                  {tx(k.hi, k.en)} · {tx('अध्याय', 'Ch.')} {r.topic.chapter.number}
                </span>
                <span className="block font-semibold">{pick(r.topic, 'title')}</span>
                <span className="block text-sm text-ink-700">{pick(r, 'reason')}</span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-400" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function WeakTopicList({ items, linkable = true }: { items: WeakTopic[]; linkable?: boolean }) {
  const { tx, pick } = useLang();
  return (
    <ul className="divide-y-2 divide-line overflow-hidden rounded-lg border-2 border-ink-950 bg-white">
      {items.map((w) => {
        const body = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{pick(w.topic, 'title')}</span>
              <span className="block text-sm text-ink-600">
                {tx('अध्याय', 'Chapter')} {w.topic.chapter.number} · {tx(`${w.attempts} प्रयास, ${Math.round(w.accuracy * 100)}% सही`, `${w.attempts} attempts, ${Math.round(w.accuracy * 100)}% correct`)}
              </span>
            </span>
            <span className="w-28 shrink-0">
              <MasteryBar value={w.mastery} label={tx('महारत', 'Mastery')} />
            </span>
          </>
        );
        return (
          <li key={w.topic.slug}>
            {linkable ? (
              <Link to={`/app/practice?topic=${w.topic.slug}`} className="flex items-center gap-3 px-4 py-3 text-ink-900 no-underline hover:bg-ink-50">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
