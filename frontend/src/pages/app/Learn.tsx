import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Info, MessageCircle } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useCurriculum, useDocumentTitle } from '@/hooks';
import { Badge, ButtonLink, EmptyState, MasteryBar, PageHeader, Section, SkeletonList, Stat } from '@/components/ui';
import { QueryError } from '@/components/common';
import { VerificationBadge } from '@/features/curriculum/CurriculumPicker';

export default function Learn() {
  const { tx, pick } = useLang();
  useDocumentTitle(tx('पढ़ाई', 'Learn'));
  const q = useCurriculum();
  const [params, setParams] = useSearchParams();

  const sel = q.data?.selection;
  const subjects = q.data?.subjects ?? [];
  const current = subjects.find((s) => s.slug === params.get('subject')) ?? subjects[0];
  const chapters = (q.data?.chapters ?? []).filter((c) => !current || c.subjectSlug === current.slug);
  const inProgress = chapters.filter((c) => c.topicsStarted > 0 && c.mastery < 0.75);
  const lessonsDone = chapters.reduce((n, c) => n + c.lessonsCompleted, 0);
  const topicTotal = chapters.reduce((n, c) => n + c.topicCount, 0);
  const hasLessons = topicTotal > 0;

  return (
    <>
      <PageHeader
        eyebrow={sel ? `${sel.board.code} · ${tx('कक्षा', 'Class')} ${sel.classLevel} · ${sel.session.code}` : undefined}
        title={current ? pick(current, 'name') : tx('पढ़ाई', 'Learn')}
        subtitle={tx('विषय चुनिए, अध्याय पढ़िए, फिर अभ्यास से पक्का कीजिए।', 'Pick a subject and a chapter, then lock it in with practice.')}
        actions={<ButtonLink to="/app/class" variant="secondary">{tx('कक्षा या विषय बदलें', 'Change class or subjects')}</ButtonLink>}
      />
      {q.isLoading && <SkeletonList rows={5} />}
      {q.error && <QueryError error={q.error} onRetry={() => q.refetch()} />}
      {q.data && !sel && (
        <EmptyState icon={<BookOpen />} title={tx('पहले अपनी कक्षा चुनें', 'Choose your class first')} action={<ButtonLink to="/app/class">{tx('कक्षा और विषय चुनें', 'Choose class and subjects')}</ButtonLink>}>
          {tx('कक्षा 1 से 12 तक, अपना बोर्ड और विषय चुनिए।', 'Pick your class (1 to 12), board and subjects.')}
        </EmptyState>
      )}
      {q.data && sel && (
        <>
          {subjects.length > 1 && (
            <nav aria-label={tx('विषय', 'Subjects')} className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
              {subjects.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setParams({ subject: s.slug }, { replace: true })}
                  aria-pressed={current?.slug === s.slug}
                  className={`min-h-[44px] shrink-0 rounded-md border-2 border-ink-950 px-3 py-2 font-semibold ${current?.slug === s.slug ? 'bg-ink-900 text-white' : 'bg-white text-ink-950 hover:bg-saffron-50'}`}
                >
                  {pick(s, 'name')}
                </button>
              ))}
            </nav>
          )}

          {current && (
            <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-700">
              <VerificationBadge status={current.verification} />
              {current.books?.length ? (
                <span>
                  {tx('NCERT पुस्तक:', 'NCERT book:')} {current.books.map((b) => b.title).join(' / ')}
                </span>
              ) : null}
            </p>
          )}

          {hasLessons && (
            <div className="panel mb-8 grid grid-cols-3 gap-3 p-4">
              <Stat label={tx('पाठ पूरे', 'Lessons read')} value={`${lessonsDone}/${topicTotal}`} />
              <Stat label={tx('शुरू किए अध्याय', 'Chapters started')} value={`${chapters.filter((c) => c.topicsStarted > 0).length}/${chapters.length}`} />
              <Stat label={tx('अभ्यास प्रश्न', 'Practice questions')} value={chapters.reduce((n, c) => n + c.questionCount, 0)} />
            </div>
          )}

          {inProgress.length > 0 && (
            <Section title={tx('चल रहे अध्याय', 'In progress')}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {inProgress.slice(0, 4).map((c) => (
                  <li key={c.slug}>
                    <Link to={`/app/learn/chapters/${c.slug}`} className="panel block px-4 py-3 text-ink-900 no-underline hover:bg-saffron-50">
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

          {chapters.length > 0 ? (
            <Section title={tx('अध्याय', 'Chapters')}>
              <ol className="divide-y-2 divide-line overflow-hidden rounded-lg border-2 border-ink-950 bg-white">
                {chapters.map((c) => (
                  <li key={c.slug}>
                    <Link to={`/app/learn/chapters/${c.slug}`} className="flex items-center gap-4 px-4 py-3 text-ink-900 no-underline hover:bg-ink-50">
                      <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-saffron-700">{c.number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{pick(c, 'name')}</span>
                        <span className="block text-sm text-ink-600">
                          {c.topicCount > 0 ? tx(`${c.topicCount} विषय · ${c.questionCount} प्रश्न`, `${c.topicCount} topics · ${c.questionCount} questions`) : tx('पाठ अभी नहीं · ट्यूटर से पूछें', 'No lessons yet · ask the tutor')}
                        </span>
                      </span>
                      {c.topicCount > 0 && (
                        <span className="hidden w-32 sm:block">
                          <MasteryBar value={c.mastery} label={tx('महारत', 'Mastery')} />
                        </span>
                      )}
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ol>
            </Section>
          ) : (
            current && (
              <div className="panel mb-8 space-y-3 p-4">
                <p className="font-semibold">{tx('इस विषय के अध्यायों की सूची अभी ऐप में नहीं है।', 'This subject’s chapter list is not in the app yet.')}</p>
                {current.books?.length ? (
                  <ul className="space-y-1 text-sm">
                    {current.books.map((b) => (
                      <li key={b.code} className="flex flex-wrap items-center gap-2">
                        <Badge>{b.medium === 'HI' ? 'हिंदी' : b.medium === 'EN' ? 'English' : b.medium}</Badge>
                        <span>
                          {b.title} · {tx(`${b.chapters} अध्याय`, `${b.chapters} chapters`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <ButtonLink to={`/app/tutor?subject=${current.slug}`}>
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {tx('इस विषय का सवाल ट्यूटर से पूछें', 'Ask the tutor about this subject')}
                </ButtonLink>
              </div>
            )
          )}

          <p className="flex gap-2 text-sm text-ink-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {tx(
                'अध्यायों के नाम NCERT की आधिकारिक पुस्तकों से हैं। पाठ और प्रश्न GURUKUL AI की मूल नमूना सामग्री हैं, किसी बोर्ड द्वारा स्वीकृत नहीं।',
                'Chapter titles come from official NCERT books. Lessons and questions are original GURUKUL AI sample content, not approved by any board.',
              )}{' '}
              <Link to="/about">{tx('अधिक जानें', 'Learn more')}</Link>
            </span>
          </p>
        </>
      )}
    </>
  );
}
