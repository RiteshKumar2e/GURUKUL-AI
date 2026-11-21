import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, History, Mic, Plus, Send, Trash2 } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useCurriculum, useDocumentTitle, useHealth, useOnline } from '@/hooks';
import { api, ApiError } from '@/services/api';
import type { Conversation } from '@/types/api';
import { Alert, Button, EmptyState, Segmented, Select, Skeleton } from '@/components/ui';
import { DemoModeNotice, QueryError } from '@/components/common';
import { TutorReply } from '@/features/tutor/TutorReply';
import { useAskTutor, type Intent } from '@/features/tutor/useTutor';

export default function Tutor() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { tx, lang, formatDate } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const online = useOnline();
  const health = useHealth();
  const [text, setText] = useState(() => params.get('q') ?? '');
  const [intent, setIntent] = useState<Intent>(params.get('q') ? 'check' : 'hint');
  const [pending, setPending] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topicSlug = params.get('topic') ?? undefined;
  const curriculum = useCurriculum();
  const mySubjects = curriculum.data?.subjects ?? [];
  const [subjectSlug, setSubjectSlug] = useState(() => params.get('subject') ?? '');
  useDocumentTitle(tx('AI ट्यूटर', 'AI tutor'));

  const list = useQuery({ queryKey: ['conversations'], queryFn: () => api<Conversation[]>('/tutor/conversations') });
  const conv = useQuery({ queryKey: ['conversation', id], queryFn: () => api<Conversation>(`/tutor/conversations/${id}`), enabled: !!id });
  const ask = useAskTutor();

  const remove = useMutation({
    mutationFn: (cid: string) => api(`/tutor/conversations/${cid}`, { method: 'DELETE' }),
    onSuccess: (_d, cid) => {
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      toast(tx('बातचीत हटा दी गई', 'Conversation deleted'), 'info');
      if (cid === id) navigate('/app/tutor');
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conv.data?.messages?.length, pending]);

  // Clear the one-time ?q= prefill from the URL once it is in the box
  useEffect(() => {
    if (params.get('q')) {
      params.delete('q');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const send = async (content = text) => {
    const c = content.trim();
    if (!c) return;
    setPending(c);
    setText('');
    try {
      const res = await ask.mutateAsync({ conversationId: id, content: c, intent, topicSlug, subjectSlug, language: lang === 'hi' ? 'HI' : 'EN' });
      if (!id) navigate(`/app/tutor/${res.conversationId}`, { replace: true });
    } catch (e) {
      setText(c);
      toast(e instanceof ApiError ? (e.isNetwork ? tx('इंटरनेट नहीं है — ट्यूटर के लिए कनेक्शन चाहिए', 'No internet — the tutor needs a connection') : e.message) : tx('भेजा नहीं जा सका', 'Could not send'), 'error');
    } finally {
      setPending(null);
    }
  };

  const intents: Array<{ value: Intent; label: string }> = [
    { value: 'hint', label: tx('संकेत दें', 'Hint') },
    { value: 'solution', label: tx('पूरा हल', 'Full solution') },
    { value: 'explain', label: tx('अवधारणा समझाएँ', 'Explain concept') },
    { value: 'check', label: tx('मेरा उत्तर जाँचें', 'Check my work') },
  ];

  const messages = id ? conv.data?.messages ?? [] : [];

  const historyPanel = (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold">{tx('पिछली बातचीत', 'Past conversations')}</p>
        <Link to="/app/tutor" className="inline-flex items-center gap-1 text-sm font-semibold" onClick={() => setShowHistory(false)}>
          <Plus className="h-4 w-4" aria-hidden />
          {tx('नई', 'New')}
        </Link>
      </div>
      {list.isLoading && <Skeleton className="h-24" />}
      {list.data && list.data.length === 0 && <p className="text-sm text-ink-600">{tx('अभी कोई बातचीत नहीं।', 'No conversations yet.')}</p>}
      <ul className="space-y-1">
        {list.data?.map((c) => (
          <li key={c.id} className={`group flex items-center gap-1 rounded ${c.id === id ? 'bg-ink-50' : ''}`}>
            <Link to={`/app/tutor/${c.id}`} onClick={() => setShowHistory(false)} className="min-w-0 flex-1 px-2 py-1.5 text-ink-900 no-underline hover:underline">
              <span className="block truncate text-[0.95rem]">{c.title}</span>
              <span className="block text-xs text-ink-500">{formatDate(c.updatedAt)}</span>
            </Link>
            <button
              onClick={() => window.confirm(tx('यह बातचीत हटाएँ?', 'Delete this conversation?')) && remove.mutate(c.id)}
              className="rounded p-1.5 text-ink-400 hover:text-bad-700"
              aria-label={tx('हटाएँ', 'Delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_15rem]">
      <div className="min-w-0">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[1.6rem]">{tx('AI ट्यूटर', 'AI tutor')}</h1>
            <p className="text-ink-700">{tx('सवाल पूछिए — पहले संकेत मिलेगा, ज़रूरत हो तो पूरा हल।', 'Ask a question — you get a hint first, and the full solution if you need it.')}</p>
          </div>
          <button className="rounded-lg border-2 border-ink-950 bg-white p-2 lg:hidden" onClick={() => setShowHistory((s) => !s)} aria-expanded={showHistory} aria-label={tx('पिछली बातचीत', 'Past conversations')}>
            <History className="h-5 w-5" />
          </button>
        </header>

        {showHistory && <div className="panel mb-4 p-3 lg:hidden">{historyPanel}</div>}

        <div className="mb-4 space-y-2">
          <DemoModeNotice mode={health.data?.ai.mode} />
          {!online && <Alert tone="warning">{tx('आप ऑफ़लाइन हैं। ट्यूटर को इंटरनेट चाहिए, पर डाउनलोड किए पाठ और अभ्यास चलते रहेंगे।', 'You are offline. The tutor needs internet, but downloaded lessons and practice still work.')}</Alert>}
          {topicSlug && !id && <Alert tone="info">{tx('यह बातचीत आपके चुने हुए पाठ से जुड़ी रहेगी।', 'This conversation will be linked to the lesson you came from.')}</Alert>}
        </div>

        {id && conv.isLoading && <Skeleton className="h-40" />}
        {id && conv.error && <QueryError error={conv.error} onRetry={() => conv.refetch()} />}

        <div className="space-y-4" aria-live="polite">
          {!id && !pending && (
            <EmptyState title={tx('किस सवाल में मदद चाहिए?', 'Which question do you need help with?')}>
              <p>{tx('उदाहरण: "x² − 5x + 6 के गुणनखंड कैसे करें?" या "समांतर चतुर्भुज के विकर्ण क्यों समद्विभाजित होते हैं?"', 'For example: "How do I factorise x² − 5x + 6?" or "Why do the diagonals of a parallelogram bisect each other?"')}</p>
            </EmptyState>
          )}
          {messages.map((m) =>
            m.role === 'USER' ? (
              <div key={m.id} className="ml-auto w-fit max-w-[88%] whitespace-pre-line rounded bg-ink-900 px-4 py-2.5 text-white">
                {m.content}
              </div>
            ) : (
              <TutorReply key={m.id} message={m} onFollowUp={() => document.getElementById('tutor-input')?.focus()} />
            ),
          )}
          {pending && (
            <>
              <div className="ml-auto w-fit max-w-[88%] whitespace-pre-line rounded bg-ink-900 px-4 py-2.5 text-white">{pending}</div>
              <div className="panel flex items-center gap-2 px-4 py-3 text-ink-600" role="status">
                <span className="flex gap-1" aria-hidden>
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400 [animation-delay:-0.2s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400 [animation-delay:-0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400" />
                </span>
                {tx('ट्यूटर सोच रहा है…', 'The tutor is thinking…')}
              </div>
            </>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="mt-6 rounded-lg border-2 border-ink-950 bg-white p-3 shadow-brut md:sticky md:bottom-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="mb-2 overflow-x-auto">
            {!id && mySubjects.length > 1 && (
              <Select id="tutor-subject" label={tx('विषय', 'Subject')} value={subjectSlug} onChange={(e) => setSubjectSlug(e.target.value)}>
                <option value="">{tx('कोई भी विषय', 'Any subject')}</option>
                {mySubjects.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {lang === 'hi' ? s.nameHi : s.nameEn}
                  </option>
                ))}
              </Select>
            )}
            <Segmented label={tx('मुझे चाहिए', 'I want')} value={intent} onChange={setIntent} options={intents} />
          </div>
          <label htmlFor="tutor-input" className="sr-only">
            {tx('अपना सवाल लिखें', 'Type your question')}
          </label>
          <textarea
            id="tutor-input"
            className="field min-h-[5rem] resize-y"
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send();
            }}
            placeholder={intent === 'check' ? tx('सवाल और अपना हल लिखें…', 'Write the question and your working…') : tx('अपना सवाल लिखें…', 'Type your question…')}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              <Link to="/app/voice" className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-sm font-semibold text-ink-700 no-underline hover:bg-ink-50">
                <Mic className="h-4 w-4" aria-hidden />
                {tx('बोलें', 'Speak')}
              </Link>
              <Link to="/app/photo" className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-sm font-semibold text-ink-700 no-underline hover:bg-ink-50">
                <Camera className="h-4 w-4" aria-hidden />
                {tx('फोटो', 'Photo')}
              </Link>
            </div>
            <Button type="submit" loading={!!pending} disabled={!text.trim() || !online} icon={<Send className="h-4 w-4" />}>
              {tx('भेजें', 'Send')}
            </Button>
          </div>
        </form>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-6">{historyPanel}</div>
      </aside>
    </div>
  );
}
