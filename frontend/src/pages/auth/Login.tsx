import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  const { register, handleSubmit, setValue, formState } = useForm<Form>({ resolver: zodResolver(schema) });

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

  const fillDemo = (username: string) => {
    setValue('username', username, { shouldValidate: true });
    setValue('password', 'Demo@1234', { shouldValidate: true });
  };

  return (
    <div className="container-page grid gap-10 py-10 md:grid-cols-[1fr_0.9fr] md:py-16">
      <div className="max-w-md">
        <h1 className="text-[1.75rem]">{tx('फिर से स्वागत है', 'Welcome back')}</h1>
        <p className="mt-1 text-ink-700">{tx('जहाँ छोड़ा था, वहीं से पढ़ाई जारी रखिए।', 'Pick up where you left off.')}</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <Input id="username" label={tx('यूज़रनेम', 'Username')} autoComplete="username" autoCapitalize="none" spellCheck={false} error={formState.errors.username?.message} {...register('username')} />
          <PasswordInput id="password" label={tx('पासवर्ड', 'Password')} autoComplete="current-password" error={formState.errors.password?.message} {...register('password')} />
          <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>
            {tx('लॉग इन करें', 'Log in')}
          </Button>
          <p className="text-sm text-ink-700">
            {tx('पासवर्ड भूल गए? अपने शिक्षक या अभिभावक से नया खाता बनवाएँ — विद्यार्थियों से हम ईमेल नहीं लेते, इसलिए पासवर्ड रीसेट अभी संभव नहीं है।', 'Forgot your password? Ask a teacher or parent to help you make a new account — we do not collect student emails, so password reset is not available yet.')}
          </p>
        </form>
        <p className="mt-6 text-[0.97rem]">
          {tx('नया खाता चाहिए?', 'New here?')} <Link to="/register">{tx('मुफ़्त खाता बनाएँ', 'Create a free account')}</Link>
        </p>
      </div>

      <aside className="panel h-fit p-5">
        <p className="font-semibold">{tx('डेमो खाते से देखिए', 'Explore with a demo account')}</p>
        <p className="mt-1 text-sm text-ink-700">
          {tx('ये खाते नकली (सिंथेटिक) डेटा वाले हैं — किसी असली विद्यार्थी की जानकारी नहीं। पासवर्ड: ', 'These accounts hold synthetic data — no real student information. Password: ')}
          <code className="rounded bg-ink-50 px-1">Demo@1234</code>
        </p>
        <div className="mt-4 grid gap-2">
          {[
            ['demo.student', tx('विद्यार्थी', 'Student')],
            ['demo.parent', tx('अभिभावक', 'Parent')],
            ['demo.teacher', tx('शिक्षक', 'Teacher')],
          ].map(([u, label]) => (
            <button key={u} type="button" onClick={() => fillDemo(u)} className="flex items-center justify-between rounded-md border-2 border-ink-950 px-3 py-2 text-left hover:bg-saffron-50">
              <span className="font-semibold">{label}</span>
              <span className="text-sm text-ink-600">{u}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-600">{tx('बटन दबाने पर फ़ॉर्म भर जाएगा, फिर "लॉग इन करें" दबाइए।', 'Tapping fills the form; then press "Log in".')}</p>
      </aside>
    </div>
  );
}
