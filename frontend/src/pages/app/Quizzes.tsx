import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/services/api';
import type { QuizSummary, SessionRow } from '@/types/api';
import { EmptyState, PageHeader, SkeletonList } from '@/components/ui';
import { QueryError } from '@/components/common';

export default function Quizzes() {
  const { tx, pick, formatDate } = useLang();
  useDocumentTitle(tx('क्विज़', 'Quizzes'));
  const list = useQuery({ queryKey: ['quizzes'], queryFn: () => api<QuizSummary[]>('/assessments') });
  const activity = useQuery({ queryKey: ['activity'], queryFn: () => api<{ sessions: SessionRow[] }>('/progress/me/activity') });

  const best = new Map<string, SessionRow>();
  activity.data?.sessions
    .filter((s) => s.type === 'QUIZ' && s.endedAt && s.assessment)
    .forEach((s) => {
      const prev = best.get(s.assessment!.slug);
      if (!prev || (s.score ?? 0) > (prev.score ?? 0)) best.set(s.assessment!.slug, s);
    });

  return (
    <>
      <PageHeader title={tx('अध्याय क्विज़', 'Chapter quizzes')} subtitle={tx('हर क्विज़ में पूरे अध्याय के प्रश्न हैं, बिना संकेत के। जमा करने के बाद हर उत्तर समझाया जाता है।', 'Each quiz covers the whole chapter, with no hints. Every answer is explained after you submit.')} />
      {list.isLoading && <SkeletonList rows={6} />}
      {list.error && <QueryError error={list.error} onRetry={() => list.refetch()} />}
      {list.data && list.data.length === 0 && <EmptyState title={tx('अभी कोई क्विज़ नहीं', 'No quizzes yet')} />}
      {list.data && list.data.length > 0 && (
        <ul className="divide-y divide-line rounded border border-line bg-white">
          {list.data.map((qz) => {
            const b = best.get(qz.slug);
            return (
              <li key={qz.slug}>
                <Link to={`/app/quiz/${qz.slug}`} className="flex items-center gap-4 px-4 py-3 text-ink-900 no-underline hover:bg-ink-50">
                  <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-saffron-700">{qz.chapter.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{pick(qz.chapter, 'name')}</span>
                    <span className="block text-sm text-ink-600">
                      {tx(`${qz.questionCount} प्रश्न · ${qz.durationMinutes} मिनट`, `${qz.questionCount} questions · ${qz.durationMinutes} min`)}
                      {b && ` · ${tx('सबसे अच्छा', 'Best')}: ${b.score}/${b.total} (${formatDate(b.startedAt)})`}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
