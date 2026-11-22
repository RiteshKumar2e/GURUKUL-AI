import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Github, Linkedin, Mail, Menu, X } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { homePathFor, useAuth } from '@/context/AuthContext';
import { LanguageToggle, Logo } from '@/components/common';
import { ButtonLink } from '@/components/ui';

const CONTACT = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim();

const AUTHOR_LINKS = [
  { href: 'https://www.linkedin.com/in/riteshkumar-tech', label: 'LinkedIn', Icon: Linkedin },
  { href: 'mailto:riteshkumar90359@gmail.com', label: 'Email: riteshkumar90359@gmail.com', Icon: Mail },
  { href: 'https://github.com/RiteshKumar2e', label: 'GitHub', Icon: Github },
];

export function PublicLayout() {
  const { tx } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  // Login and register stay focused on the form: logo + language only, no menu, no footer.
  const authPage = pathname === '/login' || pathname === '/register';
  const showFooter = pathname === '/';

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
      <header className="sticky top-0 z-30 border-b-2 border-ink-950 bg-paper">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />
          {authPage ? (
            <LanguageToggle />
          ) : (
            <>
              <nav className="hidden items-center gap-6 md:flex" aria-label={tx('मुख्य', 'Main')}>
                {links.map((l) => (
                  <Link key={l.to} to={l.to} className="font-display text-[0.95rem] font-bold text-ink-950 no-underline decoration-saffron-400 decoration-[3px] underline-offset-[6px] hover:underline">
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
                    <NavLink to="/login" className="font-display text-[0.95rem] font-bold text-ink-950 no-underline decoration-saffron-400 decoration-[3px] underline-offset-[6px] hover:underline">
                      {tx('लॉग इन', 'Log in')}
                    </NavLink>
                    <ButtonLink to="/register" size="sm">
                      {tx('शुरू करें', 'Get started')}
                    </ButtonLink>
                  </>
                )}
              </div>
              <button
                className="rounded-lg border-2 border-ink-950 bg-white p-2 text-ink-950 shadow-brut-sm md:hidden"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label={open ? tx('मेन्यू बंद करें', 'Close menu') : tx('मेन्यू खोलें', 'Open menu')}
              >
                {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </>
          )}
        </div>
        {open && !authPage && (
          <nav id="mobile-menu" className="border-t-2 border-ink-950 bg-white md:hidden" aria-label={tx('मुख्य', 'Main')}>
            <div className="container-page flex flex-col py-3">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className="border-b-2 border-ink-950 py-3 font-display font-bold text-ink-950 no-underline">
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

      {showFooter && (
        <footer className="border-t-2 border-ink-950 bg-ink-900 text-ink-100 [&_a]:text-white [&_a]:decoration-saffron-400">
          <div className="container-page grid gap-6 py-10 text-sm sm:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <span className="inline-block bg-paper px-2 py-1">
                <Logo />
              </span>
              <p className="mt-3 max-w-sm">{tx('कक्षा 1 से 12 के विद्यार्थियों के लिए हिंदी-प्रथम पढ़ाई का साथी।', 'A Hindi-first learning companion for students in Classes 1 to 12.')}</p>
              <p className="mt-2 text-xs text-ink-200">
                {tx(
                  'ACE Builders Global Hackathon 2026 के लिए बनाया गया प्रोटोटाइप। JAC या NCERT से संबद्ध नहीं।',
                  'Prototype built for ACE Builders Global Hackathon 2026. Not affiliated with JAC or NCERT.',
                )}
              </p>
              <p className="mt-2 text-xs text-ink-200">
                {tx(
                  'Codebenders IDE (हैकथॉन के लिए दिया गया IDE) में, AI कोडिंग सहायकों के साथ बनाया गया।',
                  'Built in the Codebenders IDE (the IDE provided for the hackathon), together with AI coding assistants.',
                )}
              </p>
            </div>
            <div>
              <p className="eyebrow mb-3 text-saffron-400">{tx('उत्पाद', 'Product')}</p>
              <ul className="space-y-1.5">
                <li>
                  <Link to="/register">{tx('खाता बनाएँ', 'Create account')}</Link>
                </li>
                <li>
                  <Link to="/login">{tx('लॉग इन', 'Log in')}</Link>
                </li>
                <li>
                  <Link to="/about">{tx('सामग्री और AI के बारे में', 'About content & AI')}</Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="eyebrow mb-3 text-saffron-400">{tx('नीतियाँ', 'Policies')}</p>
              <ul className="space-y-1.5">
                <li>
                  <Link to="/privacy">{tx('गोपनीयता नीति', 'Privacy policy')}</Link>
                </li>
                <li>
                  <Link to="/terms">{tx('नियम और शर्तें', 'Terms & conditions')}</Link>
                </li>
                {CONTACT && (
                  <li>
                    <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="border-t border-ink-700">
            <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-sm sm:flex-row">
              <p>
                {tx('निर्माता', 'Built by')} <span className="font-display font-bold text-white">Ritesh Kumar</span>
              </p>
              <ul className="flex items-center gap-2">
                {AUTHOR_LINKS.map(({ href, label, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target={href.startsWith('mailto:') ? undefined : '_blank'}
                      rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                      aria-label={label}
                      title={label}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-ink-100 text-white transition-colors hover:border-saffron-400 hover:bg-saffron-400 hover:!text-ink-950"
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
