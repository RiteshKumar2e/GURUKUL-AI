import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/services/api';
import type { CurriculumOverview } from '@/types/api';
import { EmptyState, MasteryBar, PageHeader, Segmented, SkeletonList } from '@/components/ui';
import { QueryError } from '@/components/common';

type Filter = 'all' | 'new' | 'started' | 'strong';

export default function Chapters() {
  const { tx, pick } = useLang();
  useDocumentTitle(tx('अध्याय', 'Chapters'));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const q = useQuery({ queryKey: ['curriculum'], queryFn: () => api<CurriculumOverview>('/curriculum') });

  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (q.data?.chapters ?? []).filter((c) => {
      if (term && !`${c.nameHi} ${c.nameEn} ${c.summaryHi} ${c.summaryEn} ${c.number}`.toLowerCase().includes(term)) return false;
      if (filter === 'new') return c.topicsStarted === 0;
      if (filter === 'started') return c.topicsStarted > 0 && c.mastery < 0.75;
      if (filter === 'strong') return c.mastery >= 0.75;
      return true;
    });
  }, [q.data, query, filter]);

  return (
    <>
      <PageHeader title={q.data?.selection ? tx(`कक्षा ${q.data.selection.classLevel} — सभी अध्याय`, `Class ${q.data.selection.classLevel} — all chapters`) : tx('सभी अध्याय', 'All chapters')} subtitle={tx('किसी अध्याय या विषय का नाम खोजें।', 'Search by chapter or topic name.')} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{tx('खोजें', 'Search')}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input className="field pl-9" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx('जैसे: बहुपद, त्रिभुज, circles', 'e.g. polynomials, त्रिभुज, circles')} />
        </label>
        <Segmented
          label={tx('छाँटें', 'Filter')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: tx('सभी', 'All') },
            { value: 'new', label: tx('नए', 'New') },
            { value: 'started', label: tx('चल रहे', 'Started') },
            { value: 'strong', label: tx('मज़बूत', 'Strong') },
          ]}
        />
      </div>

      {q.isLoading && <SkeletonList rows={6} />}
      {q.error && <QueryError error={q.error} onRetry={() => q.refetch()} />}
      {q.data && list.length === 0 && (
        <EmptyState title={tx('कोई अध्याय नहीं मिला', 'No chapters match')}>
          {tx('खोज या फ़िल्टर बदलकर देखें।', 'Try a different search or filter.')}
        </EmptyState>
      )}
      {list.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((c) => (
            <li key={c.slug}>
              <Link to={`/app/learn/chapters/${c.slug}`} className="panel flex h-full flex-col px-4 py-4 text-ink-900 no-underline hover:bg-saffron-50">
                <span className="text-xs font-semibold uppercase tracking-wide text-saffron-700">
                  {tx('अध्याय', 'Chapter')} {c.number}
                </span>
                <span className="mt-0.5 text-lg font-semibold">{pick(c, 'name')}</span>
                <span className="mt-1 flex-1 text-[0.95rem] text-ink-700">{pick(c, 'summary')}</span>
                <span className="mt-3 flex items-center justify-between gap-4 text-sm text-ink-600">
                  <span>
                    {tx(`${c.lessonsCompleted}/${c.topicCount} पाठ पढ़े`, `${c.lessonsCompleted}/${c.topicCount} lessons read`)}
                  </span>
                  <span className="w-28">
                    <MasteryBar value={c.mastery} label={tx('महारत', 'Mastery')} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
