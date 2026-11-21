import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CloudOff, Download, RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle, useOnline, useSyncState } from '@/hooks';
import { offlineDb } from '@/lib/offlineDb';
import { checkAnswer } from '@/lib/answers';
import { syncManager } from '@/lib/sync';
import { api } from '@/services/api';
import type { AnswerFeedback, CurriculumOverview, OfflinePack } from '@/types/api';
import { Alert, Button, EmptyState, PageHeader, Section, Skeleton } from '@/components/ui';
import { LessonBlocks } from '@/features/learning/LessonBlocks';
import { QuestionCard } from '@/features/practice/QuestionCard';
import { useOfflinePack } from './ChapterDetail';

type View = { kind: 'list' } | { kind: 'lesson'; pack: OfflinePack; topic: number } | { kind: 'practice'; pack: OfflinePack; topic: number };

function DownloadRow({ slug, label }: { slug: string; label: string }) {
  const { tx } = useLang();
  const { saved, busy, download } = useOfflinePack(slug);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="min-w-0 flex-1">{label}</span>
      {saved ? (
        <span className="text-sm text-good-700">{tx('सहेजा गया', 'Saved')}</span>
      ) : (
        <Button size="sm" variant="secondary" onClick={download} loading={busy} icon={<Download className="h-4 w-4" />}>
          {tx('सहेजें', 'Save')}
        </Button>
      )}
    </li>
  );
}

export default function Offline() {
  const { tx, pick, formatDate } = useLang();
  const toast = useToast();
  const online = useOnline();
  const sync = useSyncState();
  const qc = useQueryClient();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [qIndex, setQIndex] = useState(0);
  useDocumentTitle(tx('ऑफ़लाइन पढ़ाई', 'Offline learning'));

  const packs = useQuery({ queryKey: ['offline-packs'], queryFn: () => offlineDb.listPacks(), staleTime: 0 });
  const curriculum = useQuery({ queryKey: ['curriculum'], queryFn: () => api<CurriculumOverview>('/curriculum'), enabled: online });
  const savedSlugs = useMemo(() => new Set(packs.data?.map((p) => p.chapter.slug)), [packs.data]);

  const remove = async (slug: string) => {
    await offlineDb.deletePack(slug);
    await qc.invalidateQueries({ queryKey: ['offline-packs'] });
    await qc.invalidateQueries({ queryKey: ['offline-pack', slug] });
  };

  const syncNow = async () => {
    const r = await syncManager.flush();
    if (r) toast(tx(`${r.applied} रिकॉर्ड सर्वर पर भेजे गए`, `${r.applied} record(s) synced`));
    else if (!online) toast(tx('इंटरनेट आने पर अपने-आप भेजे जाएँगे', 'They will sync automatically when you are online'), 'info');
  };

  if (view.kind === 'lesson') {
    const t = view.pack.topics[view.topic];
    return (
      <>
        <button className="mb-4 inline-flex items-center gap-1 font-semibold" onClick={() => setView({ kind: 'list' })}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {tx('ऑफ़लाइन सूची', 'Offline list')}
        </button>
        <article className="max-w-prose">
          <p className="eyebrow">{pick(view.pack.chapter, 'name')}</p>
          <h1 className="mt-1 text-[1.6rem]">{pick(t, 'title')}</h1>
          <p className="mb-6 text-sm text-ink-600">{tx('ऑफ़लाइन प्रति · मूल नमूना पाठ', 'Offline copy · Original sample lesson')}</p>
          {t.lesson ? <LessonBlocks blocks={t.lesson.content} /> : <EmptyState title={tx('इस विषय का पाठ उपलब्ध नहीं', 'No lesson for this topic')} />}
          <div className="mt-8 flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                await syncManager.queueLessonComplete(t.slug);
                toast(tx('पाठ पूरा — इंटरनेट आने पर सहेजा जाएगा', 'Lesson done — it will be saved when you are online'));
                if (online) void syncManager.flush();
                setQIndex(0);
                setView({ kind: 'practice', pack: view.pack, topic: view.topic });
              }}
            >
              {tx('पाठ पूरा, अभ्यास करें', 'Done — practise')}
            </Button>
          </div>
        </article>
      </>
    );
  }

  if (view.kind === 'practice') {
    const t = view.pack.topics[view.topic];
    const questions = [...t.questions].sort((a, b) => a.difficulty - b.difficulty);
    const q = questions[qIndex % questions.length];
    const submit = async (answer: string, timeTakenSec: number): Promise<AnswerFeedback> => {
      const isCorrect = checkAnswer(q.type, q.correctAnswer, answer);
      await syncManager.queueAnswer(q.id, answer, timeTakenSec);
      if (online) void syncManager.flush();
      return { isCorrect, correctAnswer: q.correctAnswer, correctAnswerDisplay: q.correctAnswerDisplay, explanationHi: q.explanationHi, explanationEn: q.explanationEn };
    };
    return (
      <>
        <button className="mb-4 inline-flex items-center gap-1 font-semibold" onClick={() => setView({ kind: 'list' })}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {tx('ऑफ़लाइन सूची', 'Offline list')}
        </button>
        <PageHeader eyebrow={pick(view.pack.chapter, 'name')} title={pick(t, 'title')} subtitle={tx(`प्रश्न ${(qIndex % questions.length) + 1}/${questions.length} · उत्तर फ़ोन पर जाँचे जाते हैं और बाद में सर्वर पर दोबारा।`, `Question ${(qIndex % questions.length) + 1}/${questions.length} · answers are checked on the phone and re-checked on the server later.`)} />
        {questions.length === 0 ? (
          <EmptyState title={tx('इस विषय में प्रश्न नहीं हैं', 'No questions in this topic')} />
        ) : (
          <QuestionCard question={q} onSubmit={submit} onNext={() => setQIndex((i) => i + 1)} tutorLink={online} nextLabel={(qIndex + 1) % questions.length === 0 ? tx('फिर से शुरू करें', 'Start again') : undefined} />
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader title={tx('ऑफ़लाइन पढ़ाई', 'Offline learning')} subtitle={tx('अध्याय सहेजिए और बिना इंटरनेट पढ़िए व अभ्यास कीजिए। आपके उत्तर फ़ोन में रहते हैं और नेटवर्क मिलते ही सर्वर पर पहुँच जाते हैं।', 'Save chapters to read and practise without internet. Your answers stay on the phone and reach the server once you are back online.')} />

      <div className="panel mb-8 flex flex-wrap items-center gap-4 p-4">
        <span className={`inline-flex items-center gap-2 font-semibold ${online ? 'text-good-700' : 'text-ink-800'}`}>
          {online ? <Wifi className="h-5 w-5" aria-hidden /> : <WifiOff className="h-5 w-5" aria-hidden />}
          {online ? tx('ऑनलाइन', 'Online') : tx('ऑफ़लाइन', 'Offline')}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <CloudOff className="h-5 w-5" aria-hidden />
          {tx(`${sync.pending} रिकॉर्ड भेजने बाकी`, `${sync.pending} record(s) waiting to sync`)}
        </span>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={syncNow} loading={sync.syncing} disabled={sync.pending === 0} icon={<RefreshCw className="h-4 w-4" />}>
          {tx('अभी भेजें', 'Sync now')}
        </Button>
      </div>

      <Section title={tx('आपके सहेजे अध्याय', 'Your saved chapters')}>
        {packs.isLoading && <Skeleton className="h-20" />}
        {packs.data && packs.data.length === 0 && (
          <EmptyState icon={<Download className="h-8 w-8" />} title={tx('अभी कोई अध्याय सहेजा नहीं गया', 'No chapters saved yet')}>
            {online ? tx('नीचे से कोई अध्याय सहेजिए। हर अध्याय कुछ ही KB का है।', 'Save a chapter from the list below. Each one is only a few KB.') : tx('इंटरनेट मिलने पर यहाँ से अध्याय सहेज सकते हैं।', 'Once you are online you can save chapters from here.')}
          </EmptyState>
        )}
        {packs.data && packs.data.length > 0 && (
          <ul className="space-y-3">
            {packs.data
              .sort((a, b) => a.chapter.number - b.chapter.number)
              .map((p) => (
                <li key={p.chapter.slug} className="panel">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {p.chapter.number}. {pick(p.chapter, 'name')}
                      </p>
                      <p className="text-xs text-ink-600">
                        {tx('सहेजा गया', 'Saved')} {formatDate(p.savedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <button onClick={() => remove(p.chapter.slug)} className="rounded p-2 text-ink-500 hover:text-bad-700" aria-label={tx('हटाएँ', 'Remove')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="divide-y divide-line">
                    {p.topics.map((t, i) => (
                      <li key={t.slug} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                        <span className="min-w-0 flex-1">{pick(t, 'title')}</span>
                        <Button size="sm" variant="ghost" onClick={() => setView({ kind: 'lesson', pack: p, topic: i })}>
                          {tx('पढ़ें', 'Read')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setQIndex(0);
                            setView({ kind: 'practice', pack: p, topic: i });
                          }}
                        >
                          {tx(`अभ्यास (${t.questions.length})`, `Practise (${t.questions.length})`)}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        )}
      </Section>

      {online && curriculum.data && (
        <Section title={tx('और अध्याय सहेजें', 'Save more chapters')}>
          <ul className="divide-y divide-line rounded border border-line bg-white">
            {curriculum.data.chapters
              .filter((c) => !savedSlugs.has(c.slug))
              .map((c) => (
                <DownloadRow key={c.slug} slug={c.slug} label={`${c.number}. ${pick(c, 'name')}`} />
              ))}
          </ul>
        </Section>
      )}
      {!online && (
        <Alert tone="info">{tx('ट्यूटर, फोटो और आवाज़ के लिए इंटरनेट चाहिए। पाठ और अभ्यास ऊपर से खोलिए।', 'The tutor, photo and voice need internet. Open lessons and practice from above.')}</Alert>
      )}
    </>
  );
}
