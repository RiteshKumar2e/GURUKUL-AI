import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/services/api';
import type { Stream, StudentCurriculum } from '@/types/api';
import { Alert, Button, PageHeader, Section, SkeletonList } from '@/components/ui';
import { CurriculumPicker, emptyCurriculum, fromStudent, isComplete, type CurriculumValue } from '@/features/curriculum/CurriculumPicker';

interface HistoryRow {
  classLevel: number;
  board: string;
  session: string;
  stream: Stream | null;
  isActive: boolean;
  startedAt: string;
  endedAt: string | null;
  subjects: Array<{ nameHi: string; nameEn: string }>;
}

/** Change class, board, session, medium or subjects. Earlier progress is kept. */
export default function ClassSettings() {
  const { tx, lang, pick, formatDate } = useLang();
  const { refreshUser } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  useDocumentTitle(tx('कक्षा और विषय', 'Class and subjects'));

  const current = useQuery({ queryKey: ['my-curriculum'], queryFn: () => api<{ curriculum: StudentCurriculum | null }>('/students/me/curriculum') });
  const history = useQuery({ queryKey: ['my-curriculum-history'], queryFn: () => api<HistoryRow[]>('/students/me/curriculum/history') });
  const [value, setValue] = useState<CurriculumValue>(() => emptyCurriculum(lang === 'en' ? 'EN' : 'HI'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (current.data?.curriculum) setValue(fromStudent(current.data.curriculum));
  }, [current.data]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api('/students/me/curriculum', { method: 'PUT', body: value });
      await Promise.all([refreshUser(), qc.invalidateQueries()]);
      toast(tx('कक्षा और विषय सहेज लिए गए। पिछली प्रगति सुरक्षित है।', 'Class and subjects saved. Your earlier progress is kept.'));
      navigate('/app/learn');
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('सहेजा नहीं जा सका', 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={tx('कक्षा और विषय', 'Class and subjects')}
        subtitle={tx('नई कक्षा या सत्र चुनने पर पिछली कक्षा की प्रगति मिटती नहीं, इतिहास में रहती है।', 'Choosing a new class or session does not erase your earlier progress; it stays in your history.')}
      />
      {current.isLoading ? (
        <SkeletonList rows={4} />
      ) : (
        <div className="panel space-y-6 p-4">
          <CurriculumPicker value={value} onChange={setValue} />
          {error && <Alert tone="error">{error}</Alert>}
          <Button onClick={save} loading={saving} disabled={!isComplete(value)}>
            {tx('सहेजें', 'Save')}
          </Button>
        </div>
      )}

      {history.data && history.data.length > 1 && (
        <Section title={tx('पिछली कक्षाएँ', 'Earlier classes')} className="mt-8">
          <ul className="space-y-2">
            {history.data
              .filter((h) => !h.isActive)
              .map((h) => (
                <li key={h.startedAt} className="panel px-4 py-3 text-sm">
                  <p className="font-semibold">
                    {tx('कक्षा', 'Class')} {h.classLevel} · {h.board} · {h.session}
                  </p>
                  <p className="text-ink-600">{h.subjects.map((s) => pick(s, 'name')).join(', ')}</p>
                  <p className="text-xs text-ink-500">
                    {formatDate(h.startedAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {h.endedAt ? ` – ${formatDate(h.endedAt, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                  </p>
                </li>
              ))}
          </ul>
        </Section>
      )}
    </>
  );
}
