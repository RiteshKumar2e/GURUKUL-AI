import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircle, Volume2, Square } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { useSpeak } from '@/hooks/useSpeech';
import { api, ApiError } from '@/services/api';
import { syncManager } from '@/lib/sync';
import type { TopicDetail } from '@/types/api';
import { Badge, Button, ButtonLink, EmptyState, SkeletonList } from '@/components/ui';
import { QueryError } from '@/components/common';
import { LessonBlocks } from '@/features/learning/LessonBlocks';
import NotFound from '../NotFound';

export default function Topic() {
  const { slug = '' } = useParams();
  const { tx, pick, bi, lang } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { speak, stop, speaking, supported } = useSpeak();
  const q = useQuery({ queryKey: ['topic', slug], queryFn: () => api<TopicDetail>(`/topics/${slug}`) });
  useDocumentTitle(q.data ? pick(q.data, 'title') : tx('पाठ', 'Lesson'));

  const complete = useMutation({
    mutationFn: async () => {
      try {
        await api(`/topics/${slug}/complete`, { method: 'POST' });
        return 'online' as const;
      } catch (e) {
        if (e instanceof ApiError && e.isNetwork) {
          await syncManager.queueLessonComplete(slug);
          return 'queued' as const;
        }
        throw e;
      }
    },
    onSuccess: (mode) => {
      toast(mode === 'queued' ? tx('पाठ पूरा — इंटरनेट आने पर सहेजा जाएगा', 'Lesson done — will be saved when you are online') : tx('पाठ पूरा हुआ! अब अभ्यास करें।', 'Lesson complete! Now practise it.'));
      void qc.invalidateQueries({ queryKey: ['topic', slug] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['curriculum'] });
      if (q.data) void qc.invalidateQueries({ queryKey: ['chapter', q.data.chapter.slug] });
    },
    onError: () => toast(tx('सहेजा नहीं जा सका', 'Could not save'), 'error'),
  });

  if (q.error instanceof ApiError && q.error.status === 404) return <NotFound inApp />;

  const t = q.data;
  const lesson = t?.lesson;

  return (
    <>
      {t && (
        <nav className="mb-3 text-sm" aria-label={tx('ब्रेडक्रंब', 'Breadcrumb')}>
          <Link to="/app/learn/chapters">{tx('अध्याय', 'Chapters')}</Link>
          <span className="mx-1.5 text-ink-400">/</span>
          <Link to={`/app/learn/chapters/${t.chapter.slug}`}>{pick(t.chapter, 'name')}</Link>
        </nav>
      )}
      {q.isLoading && <SkeletonList rows={5} />}
      {q.error && !(q.error instanceof ApiError && q.error.status === 404) && <QueryError error={q.error} onRetry={() => q.refetch()} />}

      {t && (
        <article className="max-w-prose">
          <header className="mb-6">
            <p className="eyebrow">{tx('अध्याय', 'Chapter')} {t.chapter.number}</p>
            <h1 className="mt-1 text-[1.6rem] sm:text-[1.85rem]">{pick(t, 'title')}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-600">
              {lesson && (
                <span>
                  {lesson.estMinutes} {tx('मिनट का पाठ', 'min read')}
                </span>
              )}
              <Badge>{tx('मूल नमूना पाठ', 'Original sample lesson')}</Badge>
              {t.progress?.lessonCompleted && <Badge tone="good">{tx('पढ़ लिया', 'Read')}</Badge>}
              {supported && lesson && (
                <button
                  className="inline-flex items-center gap-1 font-semibold text-ink-800 hover:text-ink-900"
                  onClick={() => (speaking ? stop() : speak(lesson.content.map((b) => bi(b)).join('. '), lang))}
                >
                  {speaking ? <Square className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
                  {speaking ? tx('रोकें', 'Stop') : tx('पाठ सुनें', 'Listen')}
                </button>
              )}
            </div>
          </header>

          {lesson ? (
            <LessonBlocks blocks={lesson.content} />
          ) : (
            <EmptyState title={tx('इस विषय का पाठ अभी तैयार नहीं है', 'The lesson for this topic is not ready yet')}>
              {tx('तब तक आप इसके अभ्यास प्रश्न हल कर सकते हैं।', 'You can still try its practice questions.')}
            </EmptyState>
          )}

          <div className="mt-8 rounded border border-line bg-white p-4">
            <p className="font-semibold">{tx('समझ आया?', 'Got it?')}</p>
            <p className="text-sm text-ink-700">{tx(`${t.questionCount} प्रश्नों से जाँचिए। गलत होने पर समझाया जाएगा।`, `Check yourself with ${t.questionCount} questions. Mistakes are explained.`)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!t.progress?.lessonCompleted ? (
                <Button
                  loading={complete.isPending}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => complete.mutate(undefined, { onSuccess: () => navigate(`/app/practice?topic=${slug}`) })}
                >
                  {tx('पाठ पूरा, अभ्यास करें', 'Done — start practice')}
                </Button>
              ) : (
                <ButtonLink to={`/app/practice?topic=${slug}`}>{tx('अभ्यास करें', 'Practise')}</ButtonLink>
              )}
              <ButtonLink to={`/app/tutor?topic=${slug}`} variant="secondary">
                <MessageCircle className="h-4 w-4" aria-hidden />
                {tx('ट्यूटर से पूछें', 'Ask the tutor')}
              </ButtonLink>
            </div>
          </div>

          <nav className="mt-8 flex justify-between gap-3 border-t border-line pt-4 text-[0.95rem]" aria-label={tx('पाठ नेविगेशन', 'Lesson navigation')}>
            {t.previous ? (
              <Link to={`/app/learn/topics/${t.previous.slug}`} className="flex items-center gap-1.5">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {pick(t.previous, 'title')}
              </Link>
            ) : (
              <span />
            )}
            {t.next ? (
              <Link to={`/app/learn/topics/${t.next.slug}`} className="flex items-center gap-1.5 text-right">
                {pick(t.next, 'title')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <Link to={`/app/learn/chapters/${t.chapter.slug}`}>{tx('अध्याय पर लौटें', 'Back to chapter')}</Link>
            )}
          </nav>
        </article>
      )}
    </>
  );
}
