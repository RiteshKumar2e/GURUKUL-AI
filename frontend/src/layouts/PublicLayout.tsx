import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { homePathFor, useAuth } from '@/context/AuthContext';
import { LanguageToggle, Logo } from '@/components/common';
import { ButtonLink } from '@/components/ui';

const CONTACT = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim();

export function PublicLayout() {
  const { tx } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { to: '/#how', label: tx('कैसे काम करता है', 'How it works') },
    { to: '/#guardians', label: tx('अभिभावक और शिक्षक', 'Parents & teachers') },
    { to: '/about', label: tx('सामग्री और AI', 'Content & AI') },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2">
        {tx('मुख्य सामग्री पर जाएँ', 'Skip to content')}
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex" aria-label={tx('मुख्य', 'Main')}>
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="text-[0.97rem] font-medium text-ink-800 no-underline hover:text-ink-900 hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <LanguageToggle />
            {user ? (
              <ButtonLink to={homePathFor(user)} size="sm">
                {tx('डैशबोर्ड खोलें', 'Open dashboard')}
              </ButtonLink>
            ) : (
              <>
                <NavLink to="/login" className="text-[0.97rem] font-semibold text-ink-800 no-underline hover:underline">
                  {tx('लॉग इन', 'Log in')}
                </NavLink>
                <ButtonLink to="/register" size="sm">
                  {tx('शुरू करें', 'Get started')}
                </ButtonLink>
              </>
            )}
          </div>
          <button className="rounded p-2 text-ink-900 hover:bg-ink-50 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? tx('मेन्यू बंद करें', 'Close menu') : tx('मेन्यू खोलें', 'Open menu')}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <nav id="mobile-menu" className="border-t border-line bg-white md:hidden" aria-label={tx('मुख्य', 'Main')}>
            <div className="container-page flex flex-col py-3">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className="border-b border-line py-3 font-medium text-ink-900 no-underline last:border-0">
                  {l.label}
                </Link>
              ))}
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-ink-600">{tx('भाषा', 'Language')}</span>
                <LanguageToggle />
              </div>
              {user ? (
                <ButtonLink to={homePathFor(user)} className="mt-1">
                  {tx('डैशबोर्ड खोलें', 'Open dashboard')}
                </ButtonLink>
              ) : (
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <ButtonLink to="/login" variant="secondary">
                    {tx('लॉग इन', 'Log in')}
                  </ButtonLink>
                  <ButtonLink to="/register">{tx('शुरू करें', 'Get started')}</ButtonLink>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-white">
        <div className="container-page grid gap-6 py-8 text-sm text-ink-700 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm">
              {tx('झारखंड के कक्षा 9 के विद्यार्थियों के लिए हिंदी में गणित सीखने का साथी।', 'A Hindi-first maths companion for Class 9 students in Jharkhand.')}
            </p>
            <p className="mt-2 text-xs text-ink-600">
              {tx('ACE Builders Global Hackathon 2026 के लिए बनाया गया प्रोटोटाइप। JAC या NCERT से संबद्ध नहीं।', 'Prototype built for ACE Builders Global Hackathon 2026. Not affiliated with JAC or NCERT.')}
            </p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-ink-900">{tx('उत्पाद', 'Product')}</p>
            <ul className="space-y-1.5">
              <li><Link to="/register">{tx('खाता बनाएँ', 'Create account')}</Link></li>
              <li><Link to="/login">{tx('लॉग इन', 'Log in')}</Link></li>
              <li><Link to="/about">{tx('सामग्री और AI के बारे में', 'About content & AI')}</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-2 font-semibold text-ink-900">{tx('नीतियाँ', 'Policies')}</p>
            <ul className="space-y-1.5">
              <li><Link to="/privacy">{tx('गोपनीयता नीति', 'Privacy policy')}</Link></li>
              <li><Link to="/terms">{tx('नियम और शर्तें', 'Terms & conditions')}</Link></li>
              {CONTACT && (
                <li>
                  <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
                </li>
              )}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
