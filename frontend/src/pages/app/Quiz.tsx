import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { api, ApiError } from '@/services/api';
import type { QuizDetail, QuizResult } from '@/types/api';
import { Alert, Button, ButtonLink, PageHeader, SkeletonList } from '@/components/ui';
import { QueryError } from '@/components/common';
import NotFound from '../NotFound';

type Stage = 'intro' | 'running' | 'done';

export default function Quiz() {
  const { slug = '' } = useParams();
  const { tx, pick, bi } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['quiz', slug], queryFn: () => api<QuizDetail>(`/assessments/${slug}`) });
  const [stage, setStage] = useState<Stage>('intro');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(q.data ? pick(q.data, 'title') : tx('क्विज़', 'Quiz'));

  const remaining = deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : null;

  useEffect(() => {
    if (stage !== 'running') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [stage]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await api<{ sessionId: string; durationMinutes: number }>(`/assessments/${slug}/start`, { method: 'POST' });
      setSessionId(s.sessionId);
      setDeadline(Date.now() + s.durationMinutes * 60_000);
      setStage('running');
    } catch (e) {
      setError(e instanceof ApiError && e.isNetwork ? tx('क्विज़ के लिए इंटरनेट चाहिए।', 'The quiz needs internet.') : tx('क्विज़ शुरू नहीं हो सका।', 'Could not start the quiz.'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (auto = false) => {
    if (!sessionId || !q.data) return;
    if (!auto) {
      const unanswered = q.data.questions.filter((x) => !answers[x.id]?.trim()).length;
      if (unanswered && !window.confirm(tx(`${unanswered} प्रश्न बाकी हैं। फिर भी जमा करें?`, `${unanswered} question(s) unanswered. Submit anyway?`))) return;
    }
    setBusy(true);
    try {
      const res = await api<QuizResult>(`/assessments/sessions/${sessionId}/submit`, { body: { answers: q.data.questions.map((x) => ({ questionId: x.id, answer: answers[x.id] ?? '' })) } });
      setResult(res);
      setStage('done');
      window.scrollTo(0, 0);
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['activity'] });
      if (auto) toast(tx('समय पूरा — क्विज़ अपने-आप जमा हो गया', 'Time is up — the quiz was submitted'), 'info');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : tx('जमा नहीं हो सका, फिर कोशिश करें', 'Could not submit, try again'), 'error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (stage === 'running' && remaining === 0 && !busy) void submit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, stage]);

  if (q.error instanceof ApiError && q.error.status === 404) return <NotFound inApp />;
  if (q.isLoading) return <SkeletonList rows={4} />;
  if (q.error) return <QueryError error={q.error} onRetry={() => q.refetch()} />;
  const quiz = q.data!;
  const question = quiz.questions[index];

  if (stage === 'intro') {
    return (
      <>
        <PageHeader eyebrow={`${tx('अध्याय', 'Chapter')} ${quiz.chapter.number}`} title={pick(quiz, 'title')} />
        <div className="panel max-w-xl p-5">
          <ul className="space-y-1.5 text-ink-800">
            <li>{tx(`${quiz.questions.length} प्रश्न, ${quiz.durationMinutes} मिनट`, `${quiz.questions.length} questions, ${quiz.durationMinutes} minutes`)}</li>
            <li>{tx('संकेत नहीं मिलेंगे। प्रश्नों के बीच आगे-पीछे जा सकते हैं।', 'No hints. You can move back and forth between questions.')}</li>
            <li>{tx('समय पूरा होने पर क्विज़ अपने-आप जमा हो जाएगा।', 'The quiz submits automatically when time runs out.')}</li>
          </ul>
          {error && (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          <Button className="mt-5" size="lg" onClick={start} loading={busy}>
            {tx('क्विज़ शुरू करें', 'Start quiz')}
          </Button>
        </div>
      </>
    );
  }

  if (stage === 'done' && result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <>
        <PageHeader title={tx('आपका परिणाम', 'Your result')} subtitle={pick(quiz, 'title')} />
        <div className="panel mb-6 flex flex-wrap items-center gap-6 p-5">
          <p className="text-4xl font-bold tabular-nums">
            {result.score}
            <span className="text-2xl text-ink-500">/{result.total}</span>
          </p>
          <p className="max-w-md text-ink-800">
            {pct >= 80
              ? tx('बहुत बढ़िया! यह अध्याय आपकी पकड़ में है।', 'Excellent! You have a good grip on this chapter.')
              : pct >= 50
                ? tx('अच्छी कोशिश। नीचे गलत उत्तरों की व्याख्या पढ़ें, फिर अभ्यास करें।', 'Good effort. Read the explanations for wrong answers below, then practise.')
                : tx('इस अध्याय के पाठ एक बार फिर पढ़ें — फिर अभ्यास से शुरू करें।', 'Read this chapter’s lessons again, then start with practice.')}
          </p>
          <div className="flex gap-2">
            <ButtonLink to={`/app/learn/chapters/${quiz.chapter.slug}`} variant="secondary">
              {tx('अध्याय खोलें', 'Open chapter')}
            </ButtonLink>
            <ButtonLink to="/app/practice">{tx('अभ्यास करें', 'Practise')}</ButtonLink>
          </div>
        </div>
        <ol className="space-y-3">
          {result.results.map((r, i) => (
            <li key={r.questionId} className={`panel border-l-4 px-4 py-3 ${r.isCorrect ? 'border-l-good-600' : 'border-l-bad-600'}`}>
              <p className="flex items-start gap-2 font-semibold">
                {r.isCorrect ? <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-good-600" aria-label={tx('सही', 'Correct')} /> : <XCircle className="mt-1 h-5 w-5 shrink-0 text-bad-600" aria-label={tx('गलत', 'Wrong')} />}
                <span>
                  {i + 1}. {pick(r, 'prompt')}
                </span>
              </p>
              <p className="mt-1 pl-7 text-sm text-ink-700">
                {r.skipped ? tx('छोड़ दिया', 'Skipped') : `${tx('आपका उत्तर', 'Your answer')}: ${quiz.questions.find((x) => x.id === r.questionId)?.options?.find((o) => o.id === r.answer) ? bi(quiz.questions.find((x) => x.id === r.questionId)!.options!.find((o) => o.id === r.answer)!) : r.answer}`}
                {!r.isCorrect && ` · ${tx('सही उत्तर', 'Correct')}: ${bi(r.correctAnswerDisplay)}`}
              </p>
              {!r.isCorrect && <p className="mt-1 pl-7 text-ink-800">{pick(r, 'explanation')}</p>}
            </li>
          ))}
        </ol>
      </>
    );
  }

  const mm = remaining !== null ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : '';
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-semibold">
          {tx('प्रश्न', 'Question')} {index + 1}/{quiz.questions.length}
        </p>
        <p className={`flex items-center gap-1.5 font-semibold tabular-nums ${remaining !== null && remaining < 60 ? 'text-bad-700' : 'text-ink-800'}`} aria-live="off">
          <Clock className="h-4 w-4" aria-hidden />
          {mm}
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5" aria-label={tx('प्रश्न सूची', 'Question list')}>
        {quiz.questions.map((x, i) => (
          <button
            key={x.id}
            onClick={() => setIndex(i)}
            className={`h-9 w-9 rounded border text-sm font-semibold ${i === index ? 'border-ink-900 bg-ink-900 text-white' : answers[x.id] ? 'border-ink-400 bg-ink-50' : 'border-ink-200 bg-white'}`}
            aria-current={i === index}
            aria-label={`${tx('प्रश्न', 'Question')} ${i + 1}${answers[x.id] ? tx(' (उत्तर दिया)', ' (answered)') : ''}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="panel px-4 py-5 sm:px-5">
        <p className="text-[1.12rem] font-medium leading-8">{pick(question, 'prompt')}</p>
        {question.type === 'MCQ' && question.options ? (
          <fieldset className="mt-4 grid gap-2">
            <legend className="sr-only">{tx('विकल्प', 'Options')}</legend>
            {question.options.map((o) => (
              <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded border px-3 py-3 ${answers[question.id] === o.id ? 'border-ink-900 bg-ink-50' : 'border-ink-200 bg-white hover:border-ink-400'}`}>
                <input type="radio" name={`quiz-${question.id}`} className="h-4 w-4 accent-ink-900" checked={answers[question.id] === o.id} onChange={() => setAnswers((a) => ({ ...a, [question.id]: o.id }))} />
                <span className="w-5 font-semibold uppercase text-ink-500">{o.id}</span>
                <span>{bi(o)}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="mt-4">
            <label htmlFor={`quiz-ans-${question.id}`} className="label">
              {tx('आपका उत्तर', 'Your answer')}
            </label>
            <input id={`quiz-ans-${question.id}`} className="field max-w-xs text-lg" autoComplete="off" value={answers[question.id] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [question.id]: e.target.value }))} placeholder={tx('जैसे 12 या -2.5', 'e.g. 12 or -2.5')} />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
            {tx('पिछला', 'Previous')}
          </Button>
          <Button variant="secondary" onClick={() => setIndex((i) => i + 1)} disabled={index === quiz.questions.length - 1}>
            {tx('अगला', 'Next')}
          </Button>
        </div>
        <Button onClick={() => submit(false)} loading={busy}>
          {tx('क्विज़ जमा करें', 'Submit quiz')}
        </Button>
      </div>
      <p className="mt-4 text-sm">
        <Link to="/app/quiz">{tx('क्विज़ छोड़ें', 'Leave quiz')}</Link>
      </p>
    </>
  );
}
