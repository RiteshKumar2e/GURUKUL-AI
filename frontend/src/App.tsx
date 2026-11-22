import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider, useLang } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CookieBanner, ErrorBoundary, RequireAuth } from './components/common';
import { Spinner } from './components/ui';
import { PublicLayout } from './layouts/PublicLayout';
import { AppLayout } from './layouts/AppLayout';
import { usePageAnalytics } from './hooks';
import { api, ApiError } from './services/api';
import { syncManager } from './lib/sync';
import { useEffect } from 'react';

/** Page modules. Each is its own chunk, loaded on first visit and prefetched in the background. */
const pages = {
  Landing: () => import('./pages/Landing'),
  Login: () => import('./pages/auth/Login'),
  Register: () => import('./pages/auth/Register'),
  About: () => import('./pages/About'),
  Privacy: () => import('./pages/legal/Privacy'),
  Terms: () => import('./pages/legal/Terms'),
  NotFound: () => import('./pages/NotFound'),
  Onboarding: () => import('./pages/app/Onboarding'),
  ClassSettings: () => import('./pages/app/ClassSettings'),
  Dashboard: () => import('./pages/app/Dashboard'),
  Learn: () => import('./pages/app/Learn'),
  Chapters: () => import('./pages/app/Chapters'),
  ChapterDetail: () => import('./pages/app/ChapterDetail'),
  Topic: () => import('./pages/app/Topic'),
  Tutor: () => import('./pages/app/Tutor'),
  Voice: () => import('./pages/app/Voice'),
  Photo: () => import('./pages/app/Photo'),
  Practice: () => import('./pages/app/Practice'),
  Quizzes: () => import('./pages/app/Quizzes'),
  Quiz: () => import('./pages/app/Quiz'),
  Progress: () => import('./pages/app/Progress'),
  Offline: () => import('./pages/app/Offline'),
  Settings: () => import('./pages/app/Settings'),
  Guardian: () => import('./pages/guardian/GuardianHome'),
  GuardianStudent: () => import('./pages/guardian/GuardianStudent'),
};

const Landing = lazy(pages.Landing);
const Login = lazy(pages.Login);
const Register = lazy(pages.Register);
const About = lazy(pages.About);
const Privacy = lazy(pages.Privacy);
const Terms = lazy(pages.Terms);
const NotFound = lazy(pages.NotFound);
const Onboarding = lazy(pages.Onboarding);
const ClassSettings = lazy(pages.ClassSettings);
const Dashboard = lazy(pages.Dashboard);
const Learn = lazy(pages.Learn);
const Chapters = lazy(pages.Chapters);
const ChapterDetail = lazy(pages.ChapterDetail);
const Topic = lazy(pages.Topic);
const Tutor = lazy(pages.Tutor);
const Voice = lazy(pages.Voice);
const Photo = lazy(pages.Photo);
const Practice = lazy(pages.Practice);
const Quizzes = lazy(pages.Quizzes);
const Quiz = lazy(pages.Quiz);
const Progress = lazy(pages.Progress);
const Offline = lazy(pages.Offline);
const Settings = lazy(pages.Settings);
const Guardian = lazy(pages.Guardian);
const GuardianStudent = lazy(pages.GuardianStudent);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // Do not hammer a slow network: retry once, never on 4xx
      retry: (count, err) => count < 1 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
    },
  },
});

// Render puts the API to sleep when idle. Wake it as soon as the app opens, so the first real
// request (login, tutor) does not wait for the cold start. This also fills the health cache.
void queryClient.prefetchQuery({ queryKey: ['health'], queryFn: () => api('/health'), staleTime: 5 * 60_000 });

/**
 * After the first screen is up, download every other page in the background, so opening a page
 * later is instant instead of waiting for its chunk. Skipped when the user asked to save data.
 */
function prefetchPages() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') return;
  const run = () => Object.values(pages).forEach((load) => void load().catch(() => undefined));
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 3000 });
  else setTimeout(run, 1500);
}
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') prefetchPages();
  else window.addEventListener('load', prefetchPages, { once: true });
}

// After a sync stores offline work (answers, lessons, tutor replies), refetch so every screen shows it
let lastSyncSeen = 0;
syncManager.subscribe(({ lastResult }) => {
  if (!lastResult || lastResult.at === lastSyncSeen) return;
  lastSyncSeen = lastResult.at;
  if (lastResult.applied > 0) void queryClient.invalidateQueries();
});

function Loading() {
  const { tx } = useLang();
  return (
    <div className="container-page">
      <Spinner label={tx('लोड हो रहा है…', 'Loading…')} />
    </div>
  );
}

function ScrollAndAnalytics() {
  const { pathname, hash } = useLocation();
  const { lang } = useLang();
  usePageAnalytics(lang);
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
}

const student = (el: ReactNode) => <RequireAuth roles={['STUDENT']}>{el}</RequireAuth>;

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ToastProvider>
            {/* Opt in to React Router v7 behaviour now; silences the future-flag console warnings */}
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AuthProvider>
                <ScrollAndAnalytics />
                <Suspense fallback={<Loading />}>
                  <Routes>
                    <Route element={<PublicLayout />}>
                      <Route index element={<Landing />} />
                      <Route path="login" element={<Login />} />
                      <Route path="register" element={<Register />} />
                      <Route path="about" element={<About />} />
                      <Route path="privacy" element={<Privacy />} />
                      <Route path="terms" element={<Terms />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>

                    <Route
                      path="onboarding"
                      element={
                        <RequireAuth roles={['STUDENT']} allowIncompleteOnboarding>
                          <Onboarding />
                        </RequireAuth>
                      }
                    />

                    <Route path="app" element={student(<AppLayout kind="student" />)}>
                      <Route index element={<Dashboard />} />
                      <Route path="learn" element={<Learn />} />
                      <Route path="class" element={<ClassSettings />} />
                      <Route path="learn/chapters" element={<Chapters />} />
                      <Route path="learn/chapters/:slug" element={<ChapterDetail />} />
                      <Route path="learn/topics/:slug" element={<Topic />} />
                      <Route path="tutor" element={<Tutor />} />
                      <Route path="tutor/:id" element={<Tutor />} />
                      <Route path="voice" element={<Voice />} />
                      <Route path="photo" element={<Photo />} />
                      <Route path="practice" element={<Practice />} />
                      <Route path="quiz" element={<Quizzes />} />
                      <Route path="quiz/:slug" element={<Quiz />} />
                      <Route path="progress" element={<Progress />} />
                      <Route path="offline" element={<Offline />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="*" element={<NotFound inApp />} />
                    </Route>

                    <Route path="guardian" element={<RequireAuth roles={['PARENT', 'TEACHER']}><AppLayout kind="guardian" /></RequireAuth>}>
                      <Route index element={<Guardian />} />
                      <Route path="students/:id" element={<GuardianStudent />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="*" element={<NotFound inApp />} />
                    </Route>

                    <Route path="dashboard" element={<Navigate to="/app" replace />} />
                  </Routes>
                </Suspense>
                <CookieBanner />
              </AuthProvider>
            </BrowserRouter>
          </ToastProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
