import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Lightbulb, MessageCircle, XCircle } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import type { AnswerFeedback, PublicQuestion } from '@/types/api';
import { Badge, Button } from '@/components/ui';

const LEVEL = { 1: ['आसान', 'Easy'], 2: ['मध्यम', 'Medium'], 3: ['कठिन', 'Hard'] } as const;

interface Props {
  question: PublicQuestion;
  /** Grades the answer (server online, or local offline). */
  onSubmit: (answer: string, timeTakenSec: number) => Promise<AnswerFeedback>;
  onNext?: () => void;
  nextLabel?: string;
  showHint?: boolean;
  /** Offers "ask the tutor about this" after a wrong answer */
  tutorLink?: boolean;
  footnote?: string;
}

export function QuestionCard({ question, onSubmit, onNext, nextLabel, showHint = true, tutorLink = true, footnote }: Props) {
  const { tx, pick, bi } = useLang();
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAnswer('');
    setFeedback(null);
    setHintOpen(false);
    setError(null);
    started.current = Date.now();
    if (question.type === 'NUMERIC') inputRef.current?.focus({ preventScroll: true });
  }, [question.id, question.type]);

  const submit = async () => {
    if (!answer.trim()) {
      setError(question.type === 'MCQ' ? tx('एक विकल्प चुनें', 'Choose an option') : tx('उत्तर लिखें', 'Type your answer'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      setFeedback(await onSubmit(answer, Math.round((Date.now() - started.current) / 1000)));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('उत्तर जमा नहीं हो सका', 'Could not submit the answer'));
    } finally {
      setSubmitting(false);
    }
  };

  const level = LEVEL[question.difficulty as 1 | 2 | 3] ?? LEVEL[1];
  const prompt = pick(question, 'prompt');
  const hint = pick(question, 'hint');

  return (
    <div className="panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 sm:px-5">
        <Badge tone={question.difficulty === 3 ? 'saffron' : 'neutral'}>{tx(level[0], level[1])}</Badge>
        <span className="text-xs text-ink-500">{question.type === 'MCQ' ? tx('एक विकल्प चुनें', 'Choose one') : tx('संख्या लिखें', 'Type a number')}</span>
      </div>

      <form
        className="px-4 py-5 sm:px-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!feedback) void submit();
        }}
      >
        <p className="text-[1.12rem] font-medium leading-8 text-ink-900">{prompt}</p>

        {question.type === 'MCQ' && question.options ? (
          <fieldset className="mt-4 grid gap-2" disabled={!!feedback}>
            <legend className="sr-only">{tx('विकल्प', 'Options')}</legend>
            {question.options.map((o) => {
              const chosen = answer === o.id;
              const isRight = feedback && o.id === feedback.correctAnswer;
              const isWrongChoice = feedback && chosen && !feedback.isCorrect;
              return (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border-2 px-3 py-3 ${
                    isRight ? 'border-good-600 bg-good-50' : isWrongChoice ? 'border-bad-600 bg-bad-50' : chosen ? 'border-ink-950 bg-saffron-100 shadow-brut-sm' : 'border-ink-950 bg-white hover:bg-saffron-50'
                  }`}
                >
                  <input type="radio" name={`q-${question.id}`} value={o.id} checked={chosen} onChange={() => setAnswer(o.id)} className="h-5 w-5 accent-ink-950" />
                  <span className="w-5 font-semibold uppercase text-ink-500">{o.id}</span>
                  <span className="flex-1 text-ink-900">{bi(o)}</span>
                  {isRight && <CheckCircle2 className="h-5 w-5 text-good-600" aria-label={tx('सही', 'Correct')} />}
                  {isWrongChoice && <XCircle className="h-5 w-5 text-bad-600" aria-label={tx('गलत', 'Wrong')} />}
                </label>
              );
            })}
          </fieldset>
        ) : (
          <div className="mt-4">
            <label htmlFor={`ans-${question.id}`} className="label">
              {tx('आपका उत्तर', 'Your answer')}
            </label>
            <input
              ref={inputRef}
              id={`ans-${question.id}`}
              className="field max-w-xs text-lg"
              inputMode="text"
              autoComplete="off"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={!!feedback}
              placeholder={tx('जैसे 12, -2.5 या 3/4', 'e.g. 12, -2.5 or 3/4')}
            />
          </div>
        )}

        {error && (
          <p className="mt-2 text-sm text-bad-700" role="alert">
            {error}
          </p>
        )}

        {showHint && hint && !feedback && (
          <div className="mt-4">
            {hintOpen ? (
              <p className="flex gap-2 rounded bg-saffron-50 px-3 py-2 text-ink-900">
                <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-saffron-600" aria-hidden />
                {hint}
              </p>
            ) : (
              <button type="button" onClick={() => setHintOpen(true)} className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-ink-800 underline decoration-saffron-400 decoration-2 underline-offset-4">
                <Lightbulb className="h-4 w-4" aria-hidden />
                {tx('संकेत देखें', 'Show a hint')}
              </button>
            )}
          </div>
        )}

        {feedback && (
          <div className={`mt-5 border-2 px-4 py-3 ${feedback.isCorrect ? 'border-good-700 bg-good-50' : 'border-bad-700 bg-bad-50'}`} role="status" aria-live="polite">
            <p className="flex items-center gap-2 font-semibold">
              {feedback.isCorrect ? <CheckCircle2 className="h-5 w-5 text-good-600" aria-hidden /> : <XCircle className="h-5 w-5 text-bad-600" aria-hidden />}
              {feedback.isCorrect ? tx('सही उत्तर!', 'Correct!') : tx(`सही उत्तर: ${bi(feedback.correctAnswerDisplay)}`, `Correct answer: ${bi(feedback.correctAnswerDisplay)}`)}
            </p>
            <p className="mt-1 text-ink-800">{pick(feedback, 'explanation')}</p>
            {!feedback.isCorrect && tutorLink && (
              <Link to={`/app/tutor?q=${encodeURIComponent(`${prompt}\n${tx('मेरा उत्तर', 'My answer')}: ${answer}`)}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold">
                <MessageCircle className="h-4 w-4" aria-hidden />
                {tx('ट्यूटर से समझें कि गलती कहाँ हुई', 'Ask the tutor where it went wrong')}
              </Link>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!feedback ? (
            <Button type="submit" loading={submitting}>
              {tx('उत्तर जाँचें', 'Check answer')}
            </Button>
          ) : (
            onNext && (
              <Button type="button" onClick={onNext} autoFocus>
                {nextLabel ?? tx('अगला प्रश्न', 'Next question')}
              </Button>
            )
          )}
          {footnote && <span className="text-sm text-ink-600">{footnote}</span>}
        </div>
      </form>
    </div>
  );
}
