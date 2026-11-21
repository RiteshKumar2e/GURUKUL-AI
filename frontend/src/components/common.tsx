import { Component, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { homePathFor, useAuth } from '@/context/AuthContext';
import { readConsent, useOnline, useSyncState, writeConsent } from '@/hooks';
import { syncManager } from '@/lib/sync';
import { ApiError } from '@/services/api';
import type { Role } from '@/types/api';
import { Alert, Button, Spinner } from './ui';

export function Logo({ to = '/', compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2 text-ink-900 no-underline" aria-label="GURUKUL AI — home">
      <img src="/favicon.svg" alt="" width={32} height={32} className="h-8 w-8" />
      {!compact && (
        <span className="text-[1.15rem] font-bold tracking-tight">
          GURUKUL<span className="text-saffron-600"> AI</span>
        </span>
      )}
    </Link>
  );
}

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`inline-flex rounded border border-ink-200 bg-white p-0.5 text-sm ${className}`} role="group" aria-label="Language / भाषा">
      {(['hi', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-[4px] px-2.5 py-1 font-semibold ${lang === l ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-ink-50'}`}
        >
          {l === 'hi' ? 'हिंदी' : 'English'}
        </button>
      ))}
    </div>
  );
}

/** Shows connectivity and the offline sync queue. Hidden when online with nothing pending. */
export function OfflineBanner() {
  const online = useOnline();
  const { pending, syncing } = useSyncState();
  const { tx } = useLang();
  if (online && pending === 0) return null;
  return (
    <div className={`border-b px-4 py-2 text-sm ${online ? 'border-saffron-200 bg-saffron-50' : 'border-ink-700 bg-ink-800 text-white'}`} role="status">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1">
        {online ? <CloudOff className="h-4 w-4" aria-hidden /> : <WifiOff className="h-4 w-4" aria-hidden />}
        <span className="flex-1">
          {online
            ? tx(`${pending} उत्तर/पाठ सर्वर पर भेजने बाकी हैं।`, `${pending} offline answer(s) or lesson(s) waiting to sync.`)
            : tx('आप ऑफ़लाइन हैं। डाउनलोड किए अध्याय और अभ्यास चलते रहेंगे।', 'You are offline. Downloaded chapters and practice still work.')}
          {!online && pending > 0 && tx(` (${pending} सहेजे गए)`, ` (${pending} saved)`)}
        </span>
        {online && pending > 0 && (
          <button onClick={() => void syncManager.flush()} className="inline-flex items-center gap-1 font-semibold text-ink-900 underline" disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} aria-hidden />
            {syncing ? tx('भेज रहे हैं…', 'Syncing…') : tx('अभी भेजें', 'Sync now')}
          </button>
        )}
        {!online && (
          <Link to="/app/offline" className="font-semibold text-white underline decoration-saffron-400">
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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white px-4 py-4 shadow-[0_-2px_8px_rgba(16,42,67,0.06)]" role="dialog" aria-label={tx('कुकी सूचना', 'Cookie notice')}>
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
