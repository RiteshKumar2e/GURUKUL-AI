import { useLocation } from 'react-router-dom';
import { useLang } from '@/context/LanguageContext';
import { useAuth, homePathFor } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks';
import { ButtonLink } from '@/components/ui';

export default function NotFound({ inApp = false }: { inApp?: boolean }) {
  const { tx } = useLang();
  const { user } = useAuth();
  const { pathname } = useLocation();
  useDocumentTitle(tx('पेज नहीं मिला', 'Page not found'));

  return (
    <div className={inApp ? 'py-6' : 'container-page py-16 md:py-24'}>
      <p className="font-semibold tabular-nums text-saffron-700">404</p>
      <h1 className="mt-1 text-[1.75rem]">{tx('यह पेज नहीं मिला', 'This page does not exist')}</h1>
      <p className="mt-2 max-w-prose text-ink-700">
        {tx('हो सकता है लिंक पुराना हो या पता गलत लिखा गया हो:', 'The link may be old or the address mistyped:')} <code className="break-all rounded bg-ink-50 px-1">{pathname}</code>
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink to={user ? homePathFor(user) : '/'}>{user ? tx('डैशबोर्ड पर जाएँ', 'Go to dashboard') : tx('होम पेज पर जाएँ', 'Go to the home page')}</ButtonLink>
        {user?.role === 'STUDENT' && (
          <ButtonLink to="/app/learn" variant="secondary">
            {tx('अध्याय देखें', 'Browse chapters')}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
