import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, Camera, ChartLine, ClipboardCheck, Home, LogOut, MessageCircle, Mic, Settings, Target, Users, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { LanguageToggle, Logo, OfflineBanner } from '@/components/common';

interface NavItem {
  to: string;
  hi: string;
  en: string;
  icon: LucideIcon;
  end?: boolean;
  mobile?: boolean;
}

const studentNav: NavItem[] = [
  { to: '/app', hi: 'होम', en: 'Home', icon: Home, end: true, mobile: true },
  { to: '/app/learn', hi: 'पढ़ाई', en: 'Learn', icon: BookOpen, mobile: true },
  { to: '/app/tutor', hi: 'ट्यूटर', en: 'Tutor', icon: MessageCircle, mobile: true },
  { to: '/app/practice', hi: 'अभ्यास', en: 'Practice', icon: Target, mobile: true },
  { to: '/app/progress', hi: 'प्रगति', en: 'Progress', icon: ChartLine, mobile: true },
  { to: '/app/voice', hi: 'बोलकर पूछें', en: 'Ask by voice', icon: Mic },
  { to: '/app/photo', hi: 'फोटो से पूछें', en: 'Ask by photo', icon: Camera },
  { to: '/app/quiz', hi: 'क्विज़', en: 'Quizzes', icon: ClipboardCheck },
  { to: '/app/offline', hi: 'ऑफ़लाइन', en: 'Offline', icon: WifiOff },
  { to: '/app/settings', hi: 'सेटिंग्स', en: 'Settings', icon: Settings },
];

const guardianNav: NavItem[] = [
  { to: '/guardian', hi: 'विद्यार्थी', en: 'Students', icon: Users, end: true, mobile: true },
  { to: '/guardian/settings', hi: 'सेटिंग्स', en: 'Settings', icon: Settings, mobile: true },
];

export function AppLayout({ kind }: { kind: 'student' | 'guardian' }) {
  const { tx } = useLang();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = kind === 'student' ? studentNav : guardianNav;
  const home = kind === 'student' ? '/app' : '/guardian';

  const onLogout = async () => {
    if (await logout()) navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2">
        {tx('मुख्य सामग्री पर जाएँ', 'Skip to content')}
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r-2 border-ink-950 bg-white md:flex">
        <div className="px-5 py-5">
          <Logo to={home} />
        </div>
        <nav className="flex-1 overflow-y-auto px-3" aria-label={tx('ऐप नेविगेशन', 'App navigation')}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `mb-1 flex items-center gap-3 rounded-md border-2 px-3 py-2 text-[0.97rem] no-underline ${isActive ? 'border-ink-950 bg-ink-900 font-bold text-white shadow-brut-sm' : 'border-transparent text-ink-950 hover:bg-lemon-100'}`
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {tx(item.hi, item.en)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t-2 border-ink-950 px-5 py-4">
          <p className="truncate text-sm font-semibold text-ink-900">{user?.displayName}</p>
          <p className="truncate text-xs text-ink-600">
            @{user?.username} · {user?.role === 'STUDENT' ? tx('विद्यार्थी', 'Student') : user?.role === 'PARENT' ? tx('अभिभावक', 'Parent') : tx('शिक्षक', 'Teacher')}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <LanguageToggle />
            <button onClick={onLogout} className="rounded p-1.5 text-ink-600 hover:bg-ink-50 hover:text-ink-900" aria-label={tx('लॉग आउट', 'Log out')} title={tx('लॉग आउट', 'Log out')}>
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b-2 border-ink-950 bg-white px-4 md:hidden">
          <Logo to={home} />
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <NavLink to={kind === 'student' ? '/app/settings' : '/guardian/settings'} className="rounded p-2 text-ink-700" aria-label={tx('सेटिंग्स', 'Settings')}>
              <Settings className="h-5 w-5" />
            </NavLink>
          </div>
        </header>
        <OfflineBanner />
        <main id="main" className="flex-1 pb-24 md:pb-10">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation: large touch targets, five items max */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t-2 border-ink-950 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" style={{ gridTemplateColumns: `repeat(${nav.filter((n) => n.mobile).length}, minmax(0, 1fr))` }} aria-label={tx('ऐप नेविगेशन', 'App navigation')}>
        {nav
          .filter((n) => n.mobile)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 border-t-4 py-2 text-[0.72rem] no-underline ${isActive ? 'border-saffron-400 font-bold text-ink-950' : 'border-transparent text-ink-700'}`}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`h-[22px] w-[22px] ${isActive ? 'text-ink-950' : ''}`} aria-hidden strokeWidth={isActive ? 2.4 : 2} />
                  {tx(item.hi, item.en)}
                </>
              )}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}
