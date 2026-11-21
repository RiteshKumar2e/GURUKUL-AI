import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, UserPlus, Users } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { api, ApiError } from '@/services/api';
import type { GuardianStudent } from '@/types/api';
import { Alert, Button, EmptyState, PageHeader, Section, SkeletonList } from '@/components/ui';
import { QueryError } from '@/components/common';

export default function GuardianHome() {
  const { tx, formatDate } = useLang();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTeacher = user?.role === 'TEACHER';
  useDocumentTitle(isTeacher ? tx('मेरे विद्यार्थी', 'My students') : tx('मेरे बच्चे', 'My children'));
  const q = useQuery({ queryKey: ['guardian-students'], queryFn: () => api<GuardianStudent[]>('/parents/students') });

  const link = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) {
      setError(tx('कोड में 6 अक्षर/अंक होते हैं', 'The code has 6 letters/digits'));
      return;
    }
    setLinking(true);
    setError(null);
    try {
      const res = await api<{ displayName: string }>('/parents/link', { body: { code: c, guardianConsent: !isTeacher && consent } });
      setCode('');
      toast(tx(`${res.displayName} जुड़ गए`, `${res.displayName} is now linked`));
      void qc.invalidateQueries({ queryKey: ['guardian-students'] });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? tx('यह कोड किसी विद्यार्थी से मेल नहीं खाया। विद्यार्थी की सेटिंग्स में कोड दोबारा देखें।', 'This code did not match a student. Check the code in the student’s settings.') : err instanceof ApiError ? err.message : tx('जोड़ा नहीं जा सका', 'Could not link'));
    } finally {
      setLinking(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={isTeacher ? tx('शिक्षक डैशबोर्ड', 'Teacher dashboard') : tx('अभिभावक डैशबोर्ड', 'Parent dashboard')}
        title={isTeacher ? tx('मेरे विद्यार्थी', 'My students') : tx('मेरे बच्चे', 'My children')}
        subtitle={tx('आप केवल उन्हीं विद्यार्थियों को देख सकते हैं जिन्होंने आपको अपना कोड दिया है।', 'You can only see students who have given you their code.')}
      />

      <Section title={tx('विद्यार्थी जोड़ें', 'Link a student')}>
        <form className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-end" onSubmit={link} noValidate>
          <div className="flex-1">
            <label htmlFor="code" className="label">
              {tx('विद्यार्थी का 6-अक्षर कोड', "Student's 6-character code")}
            </label>
            <input id="code" className="field uppercase tracking-[0.2em]" maxLength={6} autoComplete="off" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AB3K9Q" aria-describedby="code-help" />
            <p id="code-help" className="mt-1 text-sm text-ink-600">
              {tx('विद्यार्थी को यह कोड अपने ऐप में सेटिंग्स → अभिभावक और शिक्षक में मिलेगा।', 'The student finds it in their app under Settings → Parents and teachers.')}
            </p>
            {!isTeacher && (
              <label className="mt-3 flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-ink-950" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>{tx('मैं इस बच्चे का माता-पिता/अभिभावक हूँ और उसके GURUKUL AI इस्तेमाल करने की अनुमति देता/देती हूँ।', 'I am this child’s parent or guardian and I agree to them using GURUKUL AI.')}</span>
              </label>
            )}
          </div>
          <Button type="submit" loading={linking} icon={<UserPlus className="h-4 w-4" />}>
            {tx('जोड़ें', 'Link')}
          </Button>
        </form>
        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
      </Section>

      <Section title={tx('जुड़े हुए विद्यार्थी', 'Linked students')}>
        {q.isLoading && <SkeletonList rows={3} />}
        {q.error && <QueryError error={q.error} onRetry={() => q.refetch()} />}
        {q.data && q.data.length === 0 && (
          <EmptyState icon={<Users className="h-8 w-8" />} title={tx('अभी कोई विद्यार्थी नहीं जुड़ा', 'No students linked yet')}>
            {tx('ऊपर विद्यार्थी का कोड लिखकर जोड़ें।', 'Enter a student’s code above to link them.')}
          </EmptyState>
        )}
        {q.data && q.data.length > 0 && (
          <ul className="divide-y-2 divide-line overflow-hidden rounded-lg border-2 border-ink-950 bg-white">
            {q.data.map((s) => (
              <li key={s.id}>
                <Link to={`/guardian/students/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-ink-900 no-underline hover:bg-ink-50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{s.displayName}</span>
                    <span className="block text-sm text-ink-600">
                      {tx('कक्षा', 'Class')} {s.classLevel} · {s.board}
                      {s.district ? ` · ${s.district}` : ''}
                    </span>
                  </span>
                  <span className="text-sm text-ink-700">
                    {s.answered ? tx(`${s.answered} प्रश्न · ${Math.round(s.accuracy * 100)}% सही`, `${s.answered} questions · ${Math.round(s.accuracy * 100)}% correct`) : tx('अभी शुरुआत नहीं', 'Not started yet')}
                  </span>
                  <span className="text-sm text-ink-600">{s.lastActivityAt ? `${tx('पिछली पढ़ाई', 'Last active')}: ${formatDate(s.lastActivityAt)}` : ''}</span>
                  <ArrowRight className="h-4 w-4 text-ink-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
