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
import { ApiError } from './services/api';
import { useEffect } from 'react';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const About = lazy(() => import('./pages/About'));
const Privacy = lazy(() => import('./pages/legal/Privacy'));
const Terms = lazy(() => import('./pages/legal/Terms'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Onboarding = lazy(() => import('./pages/app/Onboarding'));
const ClassSettings = lazy(() => import('./pages/app/ClassSettings'));
const Dashboard = lazy(() => import('./pages/app/Dashboard'));
const Learn = lazy(() => import('./pages/app/Learn'));
const Chapters = lazy(() => import('./pages/app/Chapters'));
const ChapterDetail = lazy(() => import('./pages/app/ChapterDetail'));
const Topic = lazy(() => import('./pages/app/Topic'));
const Tutor = lazy(() => import('./pages/app/Tutor'));
const Voice = lazy(() => import('./pages/app/Voice'));
const Photo = lazy(() => import('./pages/app/Photo'));
const Practice = lazy(() => import('./pages/app/Practice'));
const Quizzes = lazy(() => import('./pages/app/Quizzes'));
const Quiz = lazy(() => import('./pages/app/Quiz'));
const Progress = lazy(() => import('./pages/app/Progress'));
const Offline = lazy(() => import('./pages/app/Offline'));
const Settings = lazy(() => import('./pages/app/Settings'));
const Guardian = lazy(() => import('./pages/guardian/GuardianHome'));
const GuardianStudent = lazy(() => import('./pages/guardian/GuardianStudent'));

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
