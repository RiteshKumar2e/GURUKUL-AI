import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { api, ApiError } from '@/services/api';
import type { GuardianReport } from '@/types/api';
import { Button, EmptyState, PageHeader, Section, SkeletonList, Stat } from '@/components/ui';
import { QueryError } from '@/components/common';
import { ActivityBars, WeakTopicList } from '@/features/learning/Widgets';
import { ChapterProgressList, SessionList } from '../app/Progress';
import NotFound from '../NotFound';

export default function GuardianStudent() {
  const { id = '' } = useParams();
  const { tx } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['guardian-report', id], queryFn: () => api<GuardianReport>(`/parents/students/${id}/report`) });
  useDocumentTitle(q.data ? q.data.student.displayName : tx('विद्यार्थी', 'Student'));

  if (q.error instanceof ApiError && q.error.status === 404) return <NotFound inApp />;

  const unlink = async () => {
    if (!window.confirm(tx('इस विद्यार्थी को अपनी सूची से हटाएँ?', 'Remove this student from your list?'))) return;
    await api(`/parents/students/${id}`, { method: 'DELETE' });
    void qc.invalidateQueries({ queryKey: ['guardian-students'] });
    toast(tx('विद्यार्थी हटा दिया गया', 'Student removed'), 'info');
    navigate('/guardian');
  };

  return (
    <>
      <nav className="mb-3 text-sm">
        <Link to="/guardian">{tx('सभी विद्यार्थी', 'All students')}</Link>
      </nav>
      {q.isLoading && <SkeletonList rows={5} />}
      {q.error && !(q.error instanceof ApiError && q.error.status === 404) && <QueryError error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <PageHeader
            title={q.data.student.displayName}
            subtitle={`${tx('कक्षा', 'Class')} ${q.data.student.classLevel} · ${q.data.student.board}${q.data.student.district ? ` · ${q.data.student.district}` : ''}`}
            actions={
              <Button variant="ghost" size="sm" onClick={unlink}>
                {tx('सूची से हटाएँ', 'Unlink')}
              </Button>
            }
          />
          {q.data.totals.answered === 0 && q.data.totals.lessonsCompleted === 0 ? (
            <EmptyState title={tx('अभी कोई पढ़ाई दर्ज नहीं', 'No study recorded yet')}>{tx('विद्यार्थी के पाठ पढ़ने और प्रश्न हल करने पर यहाँ जानकारी दिखेगी।', 'Information appears here once the student reads lessons and answers questions.')}</EmptyState>
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
                <Section title={tx('कमज़ोर विषय', 'Weak areas')}>
                  {q.data.weakTopics.length ? (
                    <WeakTopicList items={q.data.weakTopics} linkable={false} />
                  ) : (
                    <EmptyState title={tx('कोई कमज़ोर विषय नहीं', 'No weak areas')}>{tx('जहाँ आधे से कम उत्तर सही हों, वे विषय यहाँ दिखेंगे।', 'Topics with fewer than half correct will show here.')}</EmptyState>
                  )}
                </Section>
              </div>
              <Section title={tx('अध्याय-वार प्रगति', 'Progress by chapter')}>
                <ChapterProgressList chapters={q.data.chapters} linkable={false} />
              </Section>
              <Section title={tx('हाल की पढ़ाई', 'Recent study')}>
                {q.data.sessions.length ? <SessionList sessions={q.data.sessions} /> : <p className="text-ink-600">{tx('कोई गतिविधि नहीं।', 'No activity.')}</p>}
              </Section>
              <p className="flex items-start gap-2 text-sm text-ink-600">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {tx(`विद्यार्थी ने ट्यूटर से ${q.data.tutorConversations} बार बातचीत की है। बातचीत की सामग्री निजी रहती है।`, `The student has had ${q.data.tutorConversations} tutor conversation(s). Their content stays private.`)}
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
