import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Info } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/services/api';
import type { CurriculumOverview } from '@/types/api';
import { ButtonLink, MasteryBar, PageHeader, Section, SkeletonList, Stat } from '@/components/ui';
import { QueryError } from '@/components/common';

export default function Learn() {
  const { tx, pick } = useLang();
  useDocumentTitle(tx('पढ़ाई', 'Learn'));
  const q = useQuery({ queryKey: ['curriculum'], queryFn: () => api<CurriculumOverview>('/curriculum') });

  const chapters = q.data?.chapters ?? [];
  const inProgress = chapters.filter((c) => c.topicsStarted > 0 && c.mastery < 0.75);
  const lessonsDone = chapters.reduce((n, c) => n + c.lessonsCompleted, 0);
  const topicTotal = chapters.reduce((n, c) => n + c.topicCount, 0);
  const subject = q.data?.subjects[0];

  return (
    <>
      <PageHeader
        eyebrow={subject ? `${subject.board} · ${tx('कक्षा', 'Class')} ${subject.classLevel}` : undefined}
        title={subject ? pick(subject, 'name') : tx('गणित', 'Mathematics')}
        subtitle={tx('अध्याय चुनिए, पाठ पढ़िए, फिर अभ्यास से पक्का कीजिए।', 'Pick a chapter, read the lesson, then lock it in with practice.')}
        actions={<ButtonLink to="/app/learn/chapters" variant="secondary">{tx('सभी अध्याय', 'All chapters')}</ButtonLink>}
      />
      {q.isLoading && <SkeletonList rows={5} />}
      {q.error && <QueryError error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <div className="panel mb-8 grid grid-cols-3 gap-3 p-4">
            <Stat label={tx('पाठ पूरे', 'Lessons read')} value={`${lessonsDone}/${topicTotal}`} />
            <Stat label={tx('शुरू किए अध्याय', 'Chapters started')} value={`${chapters.filter((c) => c.topicsStarted > 0).length}/${chapters.length}`} />
            <Stat label={tx('अभ्यास प्रश्न', 'Practice questions')} value={chapters.reduce((n, c) => n + c.questionCount, 0)} />
          </div>

          {inProgress.length > 0 && (
            <Section title={tx('चल रहे अध्याय', 'In progress')}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {inProgress.slice(0, 4).map((c) => (
                  <li key={c.slug}>
                    <Link to={`/app/learn/chapters/${c.slug}`} className="panel block px-4 py-3 text-ink-900 no-underline hover:border-ink-400">
                      <span className="text-xs font-semibold text-saffron-700">
                        {tx('अध्याय', 'Chapter')} {c.number}
                      </span>
                      <span className="block font-semibold">{pick(c, 'name')}</span>
                      <span className="mt-2 block">
                        <MasteryBar value={c.mastery} label={tx('महारत', 'Mastery')} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={tx('सभी अध्याय', 'All chapters')}>
            <ol className="divide-y divide-line rounded border border-line bg-white">
              {chapters.map((c) => (
                <li key={c.slug}>
                  <Link to={`/app/learn/chapters/${c.slug}`} className="flex items-center gap-4 px-4 py-3 text-ink-900 no-underline hover:bg-ink-50">
                    <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-saffron-700">{c.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{pick(c, 'name')}</span>
                      <span className="block text-sm text-ink-600">
                        {tx(`${c.topicCount} विषय · ${c.questionCount} प्रश्न`, `${c.topicCount} topics · ${c.questionCount} questions`)}
                      </span>
                    </span>
                    <span className="hidden w-32 sm:block">
                      <MasteryBar value={c.mastery} label={tx('महारत', 'Mastery')} />
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
          </Section>

          <p className="flex gap-2 text-sm text-ink-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {tx('सभी पाठ मूल नमूना सामग्री हैं, JAC/NCERT द्वारा स्वीकृत नहीं।', 'All lessons are original sample content, not approved by JAC/NCERT.')} <Link to="/about">{tx('अधिक जानें', 'Learn more')}</Link>
            </span>
          </p>
        </>
      )}
    </>
  );
}
