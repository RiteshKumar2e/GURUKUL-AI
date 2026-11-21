import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Download, Trash2 } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { api, ApiError } from '@/services/api';
import { offlineDb } from '@/lib/offlineDb';
import type { ChapterDetail as Detail, OfflinePack } from '@/types/api';
import { Badge, Button, ButtonLink, EmptyState, MasteryBar, PageHeader, SkeletonList } from '@/components/ui';
import { QueryError } from '@/components/common';
import NotFound from '../NotFound';

export function useOfflinePack(slug: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { tx } = useLang();
  const saved = useQuery({ queryKey: ['offline-pack', slug], queryFn: async () => (await offlineDb.getPack(slug)) ?? null, staleTime: Infinity });
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const pack = await api<OfflinePack>(`/chapters/${slug}/offline-pack`);
      await offlineDb.savePack(pack);
      await qc.invalidateQueries({ queryKey: ['offline-pack', slug] });
      await qc.invalidateQueries({ queryKey: ['offline-packs'] });
      toast(tx('अध्याय ऑफ़लाइन के लिए सहेज लिया गया', 'Chapter saved for offline use'));
    } catch (e) {
      toast(e instanceof ApiError && e.isNetwork ? tx('डाउनलोड के लिए इंटरनेट चाहिए', 'You need internet to download') : tx('डाउनलोड नहीं हो सका', 'Download failed'), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    await offlineDb.deletePack(slug);
    await qc.invalidateQueries({ queryKey: ['offline-pack', slug] });
    await qc.invalidateQueries({ queryKey: ['offline-packs'] });
    toast(tx('ऑफ़लाइन प्रति हटा दी गई', 'Offline copy removed'), 'info');
  };
  return { saved: saved.data, busy, download, remove };
}

export default function ChapterDetail() {
  const { slug = '' } = useParams();
  const { tx, pick } = useLang();
  const q = useQuery({ queryKey: ['chapter', slug], queryFn: () => api<Detail>(`/chapters/${slug}`) });
  const offline = useOfflinePack(slug);
  useDocumentTitle(q.data ? pick(q.data, 'name') : tx('अध्याय', 'Chapter'));

  if (q.error instanceof ApiError && q.error.status === 404) return <NotFound inApp />;

  return (
    <>
      <nav className="mb-3 text-sm" aria-label={tx('ब्रेडक्रंब', 'Breadcrumb')}>
        <Link to="/app/learn/chapters">{tx('अध्याय', 'Chapters')}</Link>
        <span className="mx-1.5 text-ink-400">/</span>
        <span className="text-ink-600">{q.data ? `${tx('अध्याय', 'Chapter')} ${q.data.number}` : '…'}</span>
      </nav>
      {q.isLoading && <SkeletonList rows={4} />}
      {q.error && !(q.error instanceof ApiError && q.error.status === 404) && <QueryError error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <PageHeader
            eyebrow={`${tx('अध्याय', 'Chapter')} ${q.data.number}`}
            title={pick(q.data, 'name')}
            subtitle={pick(q.data, 'summary')}
            actions={
              offline.saved ? (
                <Button variant="ghost" size="sm" onClick={offline.remove} icon={<Trash2 className="h-4 w-4" />}>
                  {tx('ऑफ़लाइन प्रति हटाएँ', 'Remove offline copy')}
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={offline.download} loading={offline.busy} icon={<Download className="h-4 w-4" />}>
                  {tx('ऑफ़लाइन के लिए सहेजें', 'Save for offline')}
                </Button>
              )
            }
          />
          {offline.saved && (
            <p className="-mt-3 mb-5 text-sm text-good-700">
              <CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden />
              {tx('यह अध्याय बिना इंटरनेट भी खुलेगा।', 'This chapter will open without internet.')}
            </p>
          )}

          {q.data.topics.length === 0 ? (
            <EmptyState title={tx('इस अध्याय में अभी विषय नहीं जोड़े गए', 'No topics have been added to this chapter yet')} />
          ) : (
            <ol className="space-y-3">
              {q.data.topics.map((t, i) => (
                <li key={t.slug} className="panel px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink-600">
                        {tx('विषय', 'Topic')} {q.data!.number}.{i + 1}
                        {t.progress?.lessonCompleted && (
                          <span className="ml-2">
                            <Badge tone="good">{tx('पाठ पढ़ा', 'Lesson read')}</Badge>
                          </span>
                        )}
                      </p>
                      <h2 className="mt-0.5 text-lg">{pick(t, 'title')}</h2>
                      <p className="text-[0.95rem] text-ink-700">{pick(t, 'summary')}</p>
                      <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-ink-600">
                        {t.estMinutes && (
                          <span>
                            <Clock className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                            {t.estMinutes} {tx('मिनट', 'min')}
                          </span>
                        )}
                        <span>{tx(`${t.questionCount} अभ्यास प्रश्न`, `${t.questionCount} practice questions`)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <ButtonLink to={`/app/learn/topics/${t.slug}`} size="sm" variant={t.progress?.lessonCompleted ? 'secondary' : 'primary'}>
                        {t.progress?.lessonCompleted ? tx('दोबारा पढ़ें', 'Read again') : tx('पाठ पढ़ें', 'Read lesson')}
                      </ButtonLink>
                      <ButtonLink to={`/app/practice?topic=${t.slug}`} size="sm" variant="secondary">
                        {tx('अभ्यास', 'Practise')}
                      </ButtonLink>
                    </div>
                  </div>
                  {t.progress && t.progress.attempts > 0 && (
                    <div className="mt-3 border-t border-line pt-3">
                      <MasteryBar value={t.progress.mastery} label={tx('महारत', 'Mastery')} />
                      <p className="mt-1 text-xs text-ink-600">{tx(`${t.progress.attempts} में से ${t.progress.correct} सही`, `${t.progress.correct} of ${t.progress.attempts} correct`)}</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {q.data.assessment && (
            <div className="mt-8 flex flex-col gap-3 rounded border border-ink-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{pick(q.data.assessment, 'title')}</p>
                <p className="text-sm text-ink-600">{tx(`${q.data.assessment.questionCount} प्रश्न · ${q.data.assessment.durationMinutes} मिनट · संकेत नहीं मिलेंगे`, `${q.data.assessment.questionCount} questions · ${q.data.assessment.durationMinutes} minutes · no hints`)}</p>
              </div>
              <ButtonLink to={`/app/quiz/${q.data.assessment.slug}`} variant="secondary">
                {tx('क्विज़ दें', 'Take the quiz')}
              </ButtonLink>
            </div>
          )}
        </>
      )}
    </>
  );
}
