import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, AtSign, KeyRound } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { homePathFor, useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { ApiError } from '@/services/api';
import { Alert, Button, Input, PasswordInput } from '@/components/ui';

export default function Login() {
  const { tx } = useLang();
  const { login, user, status } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  useDocumentTitle(tx('लॉग इन', 'Log in'), tx('अपने GURUKUL AI खाते में लॉग इन करें।', 'Log in to your GURUKUL AI account.'));

  const schema = z.object({
    username: z.string().trim().min(1, tx('यूज़रनेम लिखें', 'Enter your username')),
    password: z.string().min(1, tx('पासवर्ड लिखें', 'Enter your password')),
  });
  type Form = z.infer<typeof schema>;
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  if (status !== 'loading' && user) return <Navigate to={homePathFor(user)} replace />;

  const onSubmit = async (data: Form) => {
    setServerError(null);
    try {
      const u = await login(data.username, data.password);
      toast(tx(`नमस्ते, ${u.displayName}!`, `Welcome back, ${u.displayName}!`));
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : homePathFor(u), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setServerError(tx('यूज़रनेम या पासवर्ड सही नहीं है।', 'Username or password is incorrect.'));
      else if (err instanceof ApiError && err.status === 429) setServerError(err.message);
      else if (err instanceof ApiError && err.isNetwork) setServerError(tx('सर्वर से संपर्क नहीं हो पाया। इंटरनेट जाँचें।', 'Could not reach the server. Check your internet.'));
      else setServerError(tx('लॉग इन नहीं हो सका। फिर कोशिश करें।', 'Could not log in. Please try again.'));
    }
  };

  return (
    <div className="bg-sunk px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[30rem] rounded-lg border-2 border-ink-950 bg-white px-5 py-7 shadow-brut sm:px-8">
        <div className="text-center">
          <img src="/favicon.svg" alt="" width={48} height={48} className="mx-auto h-12 w-12" />
          <h1 className="mt-3 text-[1.6rem]">{tx('फिर से स्वागत है', 'Welcome back')}</h1>
          <p className="mt-1 text-ink-600">{tx('जहाँ छोड़ा था, वहीं से पढ़ाई जारी रखिए।', 'Pick up where you left off.')}</p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <Input id="username" icon={<AtSign />} label={tx('यूज़रनेम', 'Username')} autoComplete="username" autoCapitalize="none" spellCheck={false} error={formState.errors.username?.message} {...register('username')} />
          <PasswordInput id="password" icon={<KeyRound />} label={tx('पासवर्ड', 'Password')} autoComplete="current-password" error={formState.errors.password?.message} {...register('password')} />
          <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>
            {tx('लॉग इन करें', 'Log in')}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Button>
          <p className="callout text-sm">
            {tx('पासवर्ड भूल गए? अपने शिक्षक या अभिभावक से नया खाता बनवाएँ — विद्यार्थियों से हम ईमेल नहीं लेते, इसलिए पासवर्ड रीसेट अभी संभव नहीं है।', 'Forgot your password? Ask a teacher or parent to help you make a new account — we do not collect student emails, so password reset is not available yet.')}
          </p>
        </form>

        <p className="mt-6 text-center text-[0.97rem]">
          {tx('नया खाता चाहिए?', 'New here?')} <Link to="/register">{tx('मुफ़्त खाता बनाएँ', 'Create a free account')}</Link>
        </p>
      </div>
    </div>
  );
}
