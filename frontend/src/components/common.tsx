import { Component, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { homePathFor, useAuth } from '@/context/AuthContext';
import { readConsent, useOnline, useSyncState, writeConsent } from '@/hooks';
import { syncManager } from '@/lib/sync';
import { ApiError } from '@/services/api';
import type { Role } from '@/types/api';
import { Alert, Button, Spinner } from './ui';

export function Logo({ to = '/', compact = false }: { to?: string; compact?: boolean }) {
  const { tx } = useLang();
  return (
    <Link to={to} className="flex items-center gap-2 text-ink-900 no-underline" aria-label={tx('GURUKUL AI — मुख्य पेज', 'GURUKUL AI — home')}>
      <img src="/favicon.svg" alt="" width={32} height={32} className="h-8 w-8" />
      {!compact && (
        <span className="text-[1.2rem] font-extrabold tracking-tight text-ink-950">
          GURUKUL<span className="ml-1 rounded-sm bg-saffron-400 px-1">AI</span>
        </span>
      )}
    </Link>
  );
}

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`inline-flex overflow-hidden rounded-md border-2 border-ink-950 bg-white text-sm ${className}`} role="group" aria-label="Language / भाषा">
      {(['hi', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`min-h-[36px] px-2.5 py-1 font-bold first:border-r-2 first:border-ink-950 ${lang === l ? 'bg-ink-900 text-white' : 'text-ink-950 hover:bg-saffron-100'}`}
        >
          {l === 'hi' ? 'हिंदी' : 'English'}
        </button>
      ))}
    </div>
  );
}

/**
 * Connection and sync status for the student app, in five plain states:
 * ऑफ़लाइन · सिंक बाकी है · सिंक हो रहा है · सिंक पूरा हुआ · दोबारा कोशिश करें.
 * Hidden when online with nothing pending, apart from a short "sync complete" confirmation.
 */
export function OfflineBanner() {
  const online = useOnline();
  const { pending, syncing, failed, lastResult } = useSyncState();
  const { tx } = useLang();
  const [showDone, setShowDone] = useState(false);
  const doneAt = lastResult && lastResult.applied > 0 && !failed ? lastResult.at : 0;
  useEffect(() => {
    if (!doneAt) return;
    setShowDone(true);
    const t = window.setTimeout(() => setShowDone(false), 5000);
    return () => window.clearTimeout(t);
  }, [doneAt]);

  const state: 'offline' | 'syncing' | 'retry' | 'pending' | 'done' | null = !online
    ? 'offline'
    : syncing
      ? 'syncing'
      : pending > 0 && failed
        ? 'retry'
        : pending > 0
          ? 'pending'
          : showDone
            ? 'done'
            : null;
  if (!state) return null;

  const tone = {
    offline: 'border-ink-700 bg-ink-800 text-white',
    syncing: 'border-saffron-200 bg-saffron-50 text-ink-950',
    pending: 'border-saffron-200 bg-saffron-50 text-ink-950',
    retry: 'border-bad-600 bg-bad-50 text-ink-950',
    done: 'border-good-600 bg-good-50 text-ink-950',
  }[state];
  const Icon = { offline: WifiOff, syncing: RefreshCw, pending: CloudOff, retry: AlertTriangle, done: CheckCircle2 }[state];
  const label = {
    offline: tx('ऑफ़लाइन', 'Offline'),
    syncing: tx('सिंक हो रहा है…', 'Syncing…'),
    pending: tx('सिंक बाकी है', 'Sync pending'),
    retry: tx('सिंक नहीं हो पाया', 'Sync failed'),
    done: tx('सिंक पूरा हुआ', 'Sync complete'),
  }[state];
  const detail = {
    offline:
      tx('डाउनलोड किए अध्याय और अभ्यास चलते रहेंगे। ट्यूटर से पूछे सवाल नेटवर्क आने पर भेजे जाएँगे। आवाज़ और फ़ोटो के लिए इंटरनेट चाहिए।', 'Downloaded chapters and practice still work. Questions for the tutor are sent when you are back online. Voice and photo need internet.') +
      (pending > 0 ? tx(` ${pending} उत्तर/सवाल फ़ोन पर सुरक्षित हैं।`, ` ${pending} answer(s)/question(s) saved on this phone.`) : ''),
    syncing: tx(`${pending} उत्तर/सवाल सर्वर पर भेजे जा रहे हैं।`, `Sending ${pending} answer(s)/question(s) to the server.`),
    pending: tx(`${pending} उत्तर/सवाल सर्वर पर भेजने बाकी हैं।`, `${pending} answer(s)/question(s) waiting to be sent.`),
    retry: tx(`${pending} उत्तर/सवाल फ़ोन पर सुरक्षित हैं, पर अभी भेजे नहीं जा सके।`, `${pending} answer(s)/question(s) are safe on this phone but could not be sent yet.`),
    done: tx(`${lastResult?.applied ?? 0} उत्तर/सवाल सर्वर पर पहुँच गए। प्रगति और ट्यूटर के जवाब अपडेट हो गए।`, `${lastResult?.applied ?? 0} answer(s)/question(s) reached the server. Progress and tutor replies updated.`),
  }[state];

  return (
    <div className={`border-b-2 px-4 py-2 text-sm ${tone}`} role="status" aria-live="polite">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1">
        <Icon className={`h-4 w-4 shrink-0 ${state === 'syncing' ? 'motion-safe:animate-spin' : ''}`} aria-hidden />
        <span className="font-display font-bold">{label}</span>
        <span className="min-w-0 flex-1">{detail}</span>
        {(state === 'pending' || state === 'retry') && (
          <button onClick={() => void syncManager.flush()} className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-ink-950 underline">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {state === 'retry' ? tx('दोबारा कोशिश करें', 'Try again') : tx('अभी भेजें', 'Sync now')}
          </button>
        )}
        {state === 'offline' && (
          <Link to="/app/offline" className="inline-flex min-h-[44px] items-center font-semibold text-white underline decoration-saffron-400">
            {tx('ऑफ़लाइन पढ़ाई', 'Offline learning')}
          </Link>
        )}
      </div>
    </div>
  );
}

export function CookieBanner() {
  const { tx } = useLang();
  const [show, setShow] = useState(() => readConsent() === null);
  useEffect(() => {
    const h = () => setShow(readConsent() === null);
    window.addEventListener('gk-consent', h);
    return () => window.removeEventListener('gk-consent', h);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink-950 bg-white px-4 py-4" role="dialog" aria-label={tx('कुकी सूचना', 'Cookie notice')}>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center">
        <p className="flex-1 text-sm text-ink-800">
          {tx(
            'हम लॉग-इन बनाए रखने के लिए केवल एक ज़रूरी कुकी रखते हैं। आप चाहें तो गुमनाम पेज-गिनती की अनुमति दे सकते हैं — इसमें आपका नाम, फ़ोन या IP नहीं जाता।',
            'We use one essential cookie to keep you signed in. You can also allow anonymous page counts — no name, phone or IP address is recorded.',
          )}{' '}
          <Link to="/privacy">{tx('गोपनीयता नीति', 'Privacy policy')}</Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={() => writeConsent('essential')}>
            {tx('केवल ज़रूरी', 'Essential only')}
          </Button>
          <Button size="sm" onClick={() => writeConsent('analytics')}>
            {tx('अनुमति दें', 'Allow')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Route guard. Allows the cached offline session for student pages. */
export function RequireAuth({ roles, children, allowIncompleteOnboarding = false }: { roles?: Role[]; children: ReactNode; allowIncompleteOnboarding?: boolean }) {
  const { user, status } = useAuth();
  const location = useLocation();
  const { tx } = useLang();
  if (status === 'loading') {
    return (
      <div className="container-page">
        <Spinner label={tx('लोड हो रहा है…', 'Loading…')} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />;
  if (!allowIncompleteOnboarding && user.role === 'STUDENT' && user.student && !user.student.onboardingDone) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** Consistent error state for failed queries, with offline awareness and retry. */
export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { tx } = useLang();
  const offline = error instanceof ApiError && error.isNetwork;
  return (
    <Alert
      tone={offline ? 'warning' : 'error'}
      title={offline ? tx('इंटरनेट नहीं है', 'No connection') : tx('यह जानकारी लोड नहीं हो सकी', 'This could not be loaded')}
      action={
        <div className="flex flex-wrap gap-2">
          {onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry} icon={<RefreshCw className="h-4 w-4" />}>
              {tx('फिर कोशिश करें', 'Try again')}
            </Button>
          )}
          {offline && (
            <Link to="/app/offline" className="self-center text-sm font-semibold">
              {tx('ऑफ़लाइन पढ़ाई खोलें', 'Open offline learning')}
            </Link>
          )}
        </div>
      }
    >
      {offline
        ? tx('डाउनलोड किए गए अध्याय ऑफ़लाइन पढ़ाई में उपलब्ध हैं।', 'Downloaded chapters are available in offline learning.')
        : error instanceof Error
          ? error.message
          : tx('कृपया दोबारा कोशिश करें।', 'Please try again.')}
    </Alert>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="container-page py-16">
          <h1 className="text-2xl">कुछ गड़बड़ हो गई · Something went wrong</h1>
          <p className="mt-2 text-ink-700">पेज दोबारा लोड करें। आपकी प्रगति सुरक्षित है। · Reload the page. Your progress is safe.</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Visible, honest notice when the server has no AI key. */
export function DemoModeNotice({ mode }: { mode?: 'live' | 'demo' }) {
  const { tx } = useLang();
  if (mode !== 'demo') return null;
  return (
    <Alert tone="warning" title={tx('डेमो मोड', 'Demo mode')}>
      {tx(
        'इस सर्वर पर AI सेवा जुड़ी नहीं है। जवाब AI से नहीं आएँगे — केवल कैलकुलेटर जाँच और पाठ की जानकारी मिलेगी। पाठ, अभ्यास और क्विज़ पूरी तरह काम करते हैं।',
        'The AI service is not connected on this server. Replies will not come from an AI — you will see only a calculator check and lesson notes. Lessons, practice and quizzes work fully.',
      )}
    </Alert>
  );
}
