import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Camera, ClipboardCheck, MessageCircle, Mic } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/services/api';
import type { Dashboard as DashboardData } from '@/types/api';
import { ButtonLink, EmptyState, Section, Skeleton, Stat } from '@/components/ui';
import { QueryError } from '@/components/common';
import { ActivityBars, RecommendationList, WeakTopicList } from '@/features/learning/Widgets';

function greeting(tx: (h: string, e: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return tx('सुप्रभात', 'Good morning');
  if (h < 17) return tx('नमस्ते', 'Good afternoon');
  return tx('शुभ संध्या', 'Good evening');
}

export default function Dashboard() {
  const { tx, pick } = useLang();
  const { user } = useAuth();
  useDocumentTitle(tx('होम', 'Home'));
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api<DashboardData>('/students/me/dashboard') });

  const quick = [
    { to: '/app/tutor', icon: MessageCircle, hi: 'लिखकर पूछें', en: 'Type a doubt' },
    { to: '/app/voice', icon: Mic, hi: 'बोलकर पूछें', en: 'Ask by voice' },
    { to: '/app/photo', icon: Camera, hi: 'फोटो से पूछें', en: 'Ask by photo' },
    { to: '/app/quiz', icon: ClipboardCheck, hi: 'अध्याय क्विज़', en: 'Chapter quiz' },
  ];

  return (
    <>
      <header className="mb-6">
        <p className="text-ink-600">{greeting(tx)},</p>
        <h1 className="text-[1.9rem] sm:text-[2.4rem]"><span className="mark">{user?.displayName}</span></h1>
      </header>

      {q.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      )}
      {q.error && <QueryError error={q.error} onRetry={() => q.refetch()} />}

      {q.data && (
        <>
          {q.data.continueTopic ? (
            <Link to={`/app/learn/topics/${q.data.continueTopic.slug}`} className="mb-8 flex items-center gap-4 rounded-lg border-2 border-ink-950 bg-ink-900 px-5 py-5 text-white no-underline shadow-brut-saffron hover:bg-ink-800">
              <BookOpen className="h-6 w-6 shrink-0 text-saffron-400" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink-200">{tx('जहाँ छोड़ा था', 'Continue where you left off')}</span>
                <span className="block truncate font-display text-xl font-bold">{pick(q.data.continueTopic, 'title')}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
            </Link>
          ) : (
            <div className="mb-8 border-2 border-ink-950 bg-white px-5 py-4">
              <p className="font-semibold">{tx('पहला पाठ आपका इंतज़ार कर रहा है', 'Your first lesson is waiting')}</p>
              <p className="text-sm text-ink-700">{tx('अध्याय 1 से शुरू करें या अपनी पसंद का अध्याय चुनें।', 'Start with Chapter 1 or pick any chapter.')}</p>
              <ButtonLink to="/app/learn" className="mt-3" size="sm">
                {tx('अध्याय देखें', 'Browse chapters')}
              </ButtonLink>
            </div>
          )}

          <nav className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={tx('जल्दी पहुँच', 'Quick actions')}>
            {quick.map((a) => (
              <Link key={a.to} to={a.to} className="flex min-h-[52px] items-center gap-2.5 rounded-md border-2 border-ink-950 bg-white px-3 py-3 font-bold text-ink-950 no-underline shadow-brut-sm hover:bg-saffron-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                <a.icon className="h-5 w-5 shrink-0 text-ink-950" aria-hidden />
                <span className="text-[0.95rem]">{tx(a.hi, a.en)}</span>
              </Link>
            ))}
          </nav>

          <Section title={tx('आपके लिए अगला कदम', 'Your next steps')}>
            {q.data.recommendations.length ? (
              <RecommendationList items={q.data.recommendations} />
            ) : (
              <EmptyState title={tx('अभी कोई सुझाव नहीं', 'No suggestions yet')} action={<ButtonLink to="/app/practice" size="sm">{tx('अभ्यास शुरू करें', 'Start practising')}</ButtonLink>}>
                {tx('कुछ प्रश्न हल करने के बाद हम बताएँगे कि किस विषय पर ध्यान देना है।', 'After a few questions we will suggest what to focus on.')}
              </EmptyState>
            )}
          </Section>

          <div className="grid gap-8 lg:grid-cols-2">
            <Section title={tx('इस हफ़्ते', 'This week')}>
              <div className="panel p-4">
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <Stat label={tx('लगातार दिन', 'Day streak')} value={q.data.totals.streakDays} />
                  <Stat label={tx('सटीकता', 'Accuracy')} value={q.data.totals.answered ? `${Math.round(q.data.totals.accuracy * 100)}%` : '—'} />
                  <Stat label={tx('पाठ पूरे', 'Lessons done')} value={`${q.data.totals.lessonsCompleted}/${q.data.totals.topicCount}`} />
                </div>
                <ActivityBars days={q.data.last7} />
              </div>
            </Section>
            <Section title={tx('ध्यान देने वाले विषय', 'Topics that need work')} action={<Link to="/app/progress" className="text-sm font-semibold">{tx('पूरी प्रगति', 'Full progress')}</Link>}>
              {q.data.weakTopics.length ? (
                <WeakTopicList items={q.data.weakTopics} />
              ) : (
                <EmptyState title={tx('कोई कमज़ोर विषय नहीं मिला', 'No weak topics found')}>
                  {q.data.totals.answered < 3 ? tx('कम से कम कुछ प्रश्न हल करें, फिर यहाँ दिखेगा।', 'Answer a few questions first and they will show up here.') : tx('बढ़िया! ऐसे ही अभ्यास जारी रखें।', 'Great work — keep practising.')}
                </EmptyState>
              )}
            </Section>
          </div>
        </>
      )}
    </>
  );
}
