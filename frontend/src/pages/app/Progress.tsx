import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/services/api';
import type { ProgressChapter, ProgressOverview, SessionRow } from '@/types/api';
import { Badge, EmptyState, MasteryBar, PageHeader, Section, SkeletonList, Stat } from '@/components/ui';
import { QueryError } from '@/components/common';
import { ActivityBars, WeakTopicList } from '@/features/learning/Widgets';

export function ChapterProgressList({ chapters, linkable = true }: { chapters: ProgressChapter[]; linkable?: boolean }) {
  const { tx, pick } = useLang();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="divide-y-2 divide-line overflow-hidden rounded-lg border-2 border-ink-950 bg-white">
      {chapters.map((c) => (
        <li key={c.slug}>
          <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50" onClick={() => setOpen(open === c.slug ? null : c.slug)} aria-expanded={open === c.slug}>
            <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-saffron-700">{c.number}</span>
            <span className="min-w-0 flex-1 font-semibold">{pick(c, 'name')}</span>
            <span className="w-28 shrink-0 sm:w-40">
              <MasteryBar value={c.mastery} label={tx('महारत', 'Mastery')} />
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open === c.slug ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {open === c.slug && (
            <ul className="border-t border-line bg-paper px-4 py-2">
              {c.topics.map((t) => (
                <li key={t.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="min-w-0 flex-1">
                    {linkable ? <Link to={`/app/learn/topics/${t.slug}`}>{pick(t, 'title')}</Link> : pick(t, 'title')}
                    <span className="ml-2 inline-flex gap-1">
                      {t.lessonCompleted && <Badge tone="good">{tx('पाठ पढ़ा', 'Read')}</Badge>}
                    </span>
                  </span>
                  <span className="text-sm text-ink-600">{t.attempts ? tx(`${t.correct}/${t.attempts} सही`, `${t.correct}/${t.attempts} correct`) : tx('शुरू नहीं', 'Not started')}</span>
                  <span className="w-28">
                    <MasteryBar value={t.mastery} label={tx('महारत', 'Mastery')} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const { tx, pick, formatDate } = useLang();
  const label: Record<SessionRow['type'], [string, string]> = {
    LESSON: ['पाठ', 'Lesson'],
    PRACTICE: ['अभ्यास', 'Practice'],
    QUIZ: ['क्विज़', 'Quiz'],
    TUTOR: ['ट्यूटर', 'Tutor'],
    VOICE: ['आवाज़', 'Voice'],
    PHOTO: ['फोटो', 'Photo'],
  };
  return (
    <ul className="divide-y-2 divide-line overflow-hidden rounded-lg border-2 border-ink-950 bg-white">
      {sessions.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
          <Badge>{tx(...label[s.type])}</Badge>
          <span className="min-w-0 flex-1">{s.assessment ? pick(s.assessment, 'title') : s.topic ? pick(s.topic, 'title') : s.chapter ? pick(s.chapter, 'name') : '—'}</span>
          {s.score !== null && s.total !== null && <span className="font-semibold tabular-nums">{s.score}/{s.total}</span>}
          <span className="text-sm text-ink-600">{formatDate(s.startedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Progress() {
  const { tx } = useLang();
  useDocumentTitle(tx('प्रगति', 'Progress'));
  const q = useQuery({ queryKey: ['progress'], queryFn: () => api<ProgressOverview>('/progress/me') });
  const activity = useQuery({ queryKey: ['activity'], queryFn: () => api<{ sessions: SessionRow[] }>('/progress/me/activity') });

  return (
    <>
      <PageHeader title={tx('आपकी प्रगति', 'Your progress')} subtitle={tx('महारत आपके हाल के उत्तरों से तय होती है — कठिन प्रश्न सही करने पर ज़्यादा बढ़ती है।', 'Mastery is based on your recent answers — it grows faster when you get harder questions right.')} />
      {q.isLoading && <SkeletonList rows={5} />}
      {q.error && <QueryError error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          {q.data.totals.answered === 0 && q.data.totals.lessonsCompleted === 0 ? (
            <EmptyState title={tx('अभी कोई प्रगति नहीं', 'No progress yet')} action={<Link to="/app/learn">{tx('पहला पाठ पढ़ें', 'Read your first lesson')}</Link>}>
              {tx('पाठ पढ़ने और प्रश्न हल करने पर आपकी प्रगति यहाँ दिखेगी।', 'Your progress appears here as you read lessons and answer questions.')}
            </EmptyState>
          ) : (
            <>
              <div className="panel mb-8 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
                <Stat label={tx('हल किए प्रश्न', 'Questions answered')} value={q.data.totals.answered} />
                <Stat label={tx('सटीकता', 'Accuracy')} value={q.data.totals.answered ? `${Math.round(q.data.totals.accuracy * 100)}%` : '—'} />
                <Stat label={tx('पाठ पढ़े', 'Lessons read')} value={`${q.data.totals.lessonsCompleted}/${q.data.totals.topicCount}`} />
                <Stat label={tx('लगातार दिन', 'Day streak')} value={q.data.totals.streakDays} />
              </div>
              <div className="grid gap-8 lg:grid-cols-2">
                <Section title={tx('पिछले 7 दिन', 'Last 7 days')}>
                  <div className="panel p-4">
                    <ActivityBars days={q.data.last7} />
                  </div>
                </Section>
                <Section title={tx('कमज़ोर विषय', 'Weak topics')}>
                  {q.data.weakTopics.length ? <WeakTopicList items={q.data.weakTopics} /> : <EmptyState title={tx('कोई कमज़ोर विषय नहीं', 'No weak topics')}>{tx('जिस विषय में कम से कम 2 प्रयास हों और आधे से कम सही हों, वह यहाँ दिखेगा।', 'A topic shows here once it has 2+ attempts and fewer than half correct.')}</EmptyState>}
                </Section>
              </div>
              <Section title={tx('अध्याय-वार महारत', 'Mastery by chapter')}>
                <ChapterProgressList chapters={q.data.chapters} />
              </Section>
              <Section title={tx('हाल की गतिविधि', 'Recent activity')}>
                {activity.data?.sessions.length ? <SessionList sessions={activity.data.sessions} /> : <p className="text-ink-600">{tx('कोई गतिविधि नहीं।', 'No activity yet.')}</p>}
              </Section>
            </>
          )}
        </>
      )}
    </>
  );
}
