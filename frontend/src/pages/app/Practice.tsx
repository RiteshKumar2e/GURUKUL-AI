import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useDocumentTitle } from '@/hooks';
import { api, ApiError } from '@/services/api';
import type { AnswerFeedback, ChapterDetail, CurriculumOverview, NextQuestion } from '@/types/api';
import { Alert, Badge, ButtonLink, EmptyState, MasteryBar, PageHeader, Select, Skeleton } from '@/components/ui';
import { QueryError } from '@/components/common';
import { QuestionCard } from '@/features/practice/QuestionCard';

const LEVEL_NAME = { 1: ['आसान', 'easy'], 2: ['मध्यम', 'medium'], 3: ['कठिन', 'hard'] } as const;

export default function Practice() {
  const { tx, pick } = useLang();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic') ?? undefined;
  const [chapterSlug, setChapterSlug] = useState<string>('');
  const [round, setRound] = useState(0);
  const [tally, setTally] = useState({ right: 0, total: 0 });
  const [lastProgress, setLastProgress] = useState<AnswerFeedback['progress']>();
  useDocumentTitle(tx('अभ्यास', 'Practice'));

  const curriculum = useQuery({ queryKey: ['curriculum'], queryFn: () => api<CurriculumOverview>('/curriculum') });
  const next = useQuery({
    queryKey: ['practice-next', topic ?? 'auto', round],
    queryFn: () => api<NextQuestion>('/practice/next', { query: { topic } }),
    staleTime: Infinity,
    gcTime: 0,
  });
  const currentChapter = chapterSlug || next.data?.topic?.chapterSlug || '';
  const chapter = useQuery({ queryKey: ['chapter', currentChapter], queryFn: () => api<ChapterDetail>(`/chapters/${currentChapter}`), enabled: !!currentChapter });

  const chooseTopic = (slug: string) => {
    if (slug) params.set('topic', slug);
    else params.delete('topic');
    setParams(params);
    setLastProgress(undefined);
  };

  const submit = async (answer: string, timeTakenSec: number) => {
    const res = await api<AnswerFeedback>('/practice/answer', { body: { questionId: next.data!.question!.id, answer, timeTakenSec } });
    setTally((t) => ({ right: t.right + (res.isCorrect ? 1 : 0), total: t.total + 1 }));
    setLastProgress(res.progress);
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    void qc.invalidateQueries({ queryKey: ['progress'] });
    return res;
  };

  const level = lastProgress?.level ?? next.data?.level ?? 1;
  const levelChanged = lastProgress && next.data && lastProgress.level !== next.data.level;

  return (
    <>
      <PageHeader
        title={tx('अभ्यास', 'Practice')}
        subtitle={tx('प्रश्न आपके उत्तरों के हिसाब से आसान या कठिन होते जाते हैं। दो सही पर स्तर बढ़ता है, दो गलत पर घटता है।', 'Questions get easier or harder based on your answers. Two right raises the level; two wrong lowers it.')}
      />

      <div className="panel mb-5 grid gap-3 p-4 sm:grid-cols-2">
        <Select id="chapter" label={tx('अध्याय', 'Chapter')} value={currentChapter} onChange={(e) => setChapterSlug(e.target.value)}>
          <option value="">{tx('चुनें…', 'Choose…')}</option>
          {curriculum.data?.chapters.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.number}. {pick(c, 'name')}
            </option>
          ))}
        </Select>
        <Select id="topic" label={tx('विषय', 'Topic')} value={topic ?? ''} onChange={(e) => chooseTopic(e.target.value)}>
          <option value="">{tx('अपने-आप (कमज़ोर विषय पहले)', 'Automatic (weak topics first)')}</option>
          {chapter.data?.topics.map((t) => (
            <option key={t.slug} value={t.slug}>
              {pick(t, 'title')}
            </option>
          ))}
        </Select>
      </div>

      {next.data && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {next.data.topic && (
            <span className="font-semibold">
              <Link to={`/app/learn/topics/${next.data.topic.slug}`}>{pick(next.data.topic, 'title')}</Link>
            </span>
          )}
          <Badge tone="saffron">
            {tx('स्तर', 'Level')}: {tx(LEVEL_NAME[level as 1 | 2 | 3][0], LEVEL_NAME[level as 1 | 2 | 3][1])}
          </Badge>
          {tally.total > 0 && <span className="text-ink-700">{tx(`इस बार: ${tally.right}/${tally.total} सही`, `This session: ${tally.right}/${tally.total} correct`)}</span>}
          <span className="w-40">
            <MasteryBar value={lastProgress?.mastery ?? next.data.mastery} label={tx('महारत', 'Mastery')} />
          </span>
        </div>
      )}

      {levelChanged && (
        <div className="mb-4">
          <Alert tone={lastProgress!.level > next.data!.level ? 'success' : 'info'}>
            <Sparkles className="mr-1 inline h-4 w-4" aria-hidden />
            {lastProgress!.level > next.data!.level ? tx('शाबाश! अगला प्रश्न थोड़ा कठिन होगा।', 'Well done! The next question will be a bit harder.') : tx('कोई बात नहीं — अगला प्रश्न थोड़ा आसान होगा।', 'No problem — the next question will be a little easier.')}
          </Alert>
        </div>
      )}

      {next.isLoading && <Skeleton className="h-64" />}
      {next.error && (next.error instanceof ApiError && next.error.status === 404 ? <EmptyState title={tx('इस विषय में अभी प्रश्न नहीं हैं', 'No questions in this topic yet')} /> : <QueryError error={next.error} onRetry={() => next.refetch()} />)}
      {next.data && !next.data.question && (
        <EmptyState
          title={next.data.reason === 'NO_QUESTIONS_IN_TOPIC' ? tx('इस विषय में अभी प्रश्न नहीं हैं', 'No questions in this topic yet') : tx('आपकी कक्षा के लिए अभ्यास प्रश्न अभी तैयार नहीं हैं', 'Practice questions for your class are not ready yet')}
          action={<ButtonLink to="/app/tutor">{tx('ट्यूटर से सवाल पूछें', 'Ask the tutor')}</ButtonLink>}
        >
          {tx(
            'अभी अभ्यास प्रश्न केवल कक्षा 9 गणित (नमूना सामग्री) में हैं। तब तक अपने किसी भी विषय का सवाल AI ट्यूटर से पूछ सकते हैं।',
            'Practice questions exist only for Class 9 maths (sample content) so far. Meanwhile you can ask the AI tutor about any of your subjects.',
          )}
        </EmptyState>
      )}
      {next.data?.question && (
        <>
          {next.data.allRecentlySolved && (
            <div className="mb-4">
              <Alert tone="success">{tx('आपने इस विषय के सभी प्रश्न हाल में सही किए हैं। दोहराने के लिए फिर से दिखा रहे हैं — या दूसरा विषय चुनें।', 'You solved every question in this topic recently. Showing them again for revision — or pick another topic.')}</Alert>
            </div>
          )}
          <QuestionCard question={next.data.question} onSubmit={submit} onNext={() => setRound((r) => r + 1)} />
        </>
      )}
    </>
  );
}
