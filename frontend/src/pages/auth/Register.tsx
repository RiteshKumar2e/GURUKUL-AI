import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLang } from '@/context/LanguageContext';
import { homePathFor, useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { ApiError } from '@/services/api';
import { Alert, Button, Input, PasswordInput } from '@/components/ui';

type RoleOption = 'STUDENT' | 'PARENT' | 'TEACHER';

export default function Register() {
  const { tx, lang } = useLang();
  const { register: signUp, user, status } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  useDocumentTitle(tx('खाता बनाएँ', 'Create account'), tx('GURUKUL AI पर मुफ़्त खाता बनाएँ।', 'Create a free GURUKUL AI account.'));

  const schema = z
    .object({
      role: z.enum(['STUDENT', 'PARENT', 'TEACHER']),
      displayName: z.string().trim().min(2, tx('कम से कम 2 अक्षर', 'At least 2 characters')).max(40, tx('अधिकतम 40 अक्षर', 'At most 40 characters')),
      username: z
        .string()
        .trim()
        .min(3, tx('कम से कम 3 अक्षर', 'At least 3 characters'))
        .max(24, tx('अधिकतम 24 अक्षर', 'At most 24 characters'))
        .regex(/^[a-zA-Z0-9_.]+$/, tx('केवल अंग्रेज़ी अक्षर, अंक, . और _', 'Only letters, numbers, . and _')),
      password: z.string().min(8, tx('कम से कम 8 अक्षर', 'At least 8 characters')).max(72),
      email: z.string().trim().optional(),
      schoolName: z.string().trim().max(80).optional(),
      website: z.string().optional(),
      acceptTerms: z.boolean().refine((v) => v, tx('आगे बढ़ने के लिए शर्तें स्वीकार करें', 'Please accept the terms to continue')),
    })
    .superRefine((v, ctx) => {
      if (v.role !== 'STUDENT') {
        if (!v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: tx('अभिभावक/शिक्षक के लिए ईमेल ज़रूरी है', 'Email is required for parents and teachers') });
        else if (!z.string().email().safeParse(v.email).success) ctx.addIssue({ code: 'custom', path: ['email'], message: tx('सही ईमेल लिखें', 'Enter a valid email') });
      }
    });
  type Form = z.infer<typeof schema>;

  const { register, handleSubmit, watch, setValue, setError, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'STUDENT', acceptTerms: false },
  });
  const role = watch('role');

  if (status !== 'loading' && user) return <Navigate to={homePathFor(user)} replace />;

  const onSubmit = async (data: Form) => {
    setServerError(null);
    try {
      const u = await signUp({
        ...data,
        email: data.role === 'STUDENT' ? undefined : data.email,
        schoolName: data.role === 'TEACHER' ? data.schoolName : undefined,
        preferredLanguage: lang === 'hi' ? 'HI' : 'EN',
      });
      toast(tx('खाता बन गया!', 'Your account is ready!'));
      navigate(homePathFor(u), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          const field = err.message.toLowerCase().includes('email') ? 'email' : 'username';
          setError(field, { message: field === 'email' ? tx('यह ईमेल पहले से दर्ज है', 'This email is already registered') : tx('यह यूज़रनेम कोई और ले चुका है', 'This username is taken') });
          return;
        }
        if (err.details?.length) {
          err.details.forEach((d) => setError(d.field as keyof Form, { message: d.message }));
          return;
        }
        setServerError(err.isNetwork ? tx('सर्वर से संपर्क नहीं हो पाया।', 'Could not reach the server.') : err.message);
      }
    }
  };

  const roles: Array<{ value: RoleOption; hi: string; en: string; dhi: string; den: string }> = [
    { value: 'STUDENT', hi: 'विद्यार्थी', en: 'Student', dhi: 'मैं पढ़ाई करूँगा/करूँगी', den: 'I will study' },
    { value: 'PARENT', hi: 'अभिभावक', en: 'Parent', dhi: 'बच्चे की प्रगति देखूँगा/देखूँगी', den: "I'll follow my child's progress" },
    { value: 'TEACHER', hi: 'शिक्षक', en: 'Teacher', dhi: 'विद्यार्थियों की मदद करूँगा/करूँगी', den: "I'll support my students" },
  ];

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mx-auto max-w-lg">
        <h1 className="text-[1.75rem]">{tx('मुफ़्त खाता बनाएँ', 'Create a free account')}</h1>
        <p className="mt-1 text-ink-700">{tx('हम केवल उतनी जानकारी लेते हैं जितनी ज़रूरी है।', 'We only ask for what is necessary.')}</p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && <Alert tone="error">{serverError}</Alert>}

          <fieldset>
            <legend className="label">{tx('आप कौन हैं?', 'Who are you?')}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {roles.map((r) => (
                <label key={r.value} className={`cursor-pointer border-2 px-3 py-2.5 ${role === r.value ? 'border-ink-950 bg-saffron-100 shadow-brut-sm' : 'border-ink-950 bg-white hover:bg-saffron-50'}`}>
                  <input type="radio" value={r.value} className="sr-only" checked={role === r.value} onChange={() => setValue('role', r.value)} />
                  <span className="block font-semibold">{tx(r.hi, r.en)}</span>
                  <span className="block text-sm text-ink-600">{tx(r.dhi, r.den)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Input id="displayName" label={tx('आपका नाम', 'Your name')} hint={role === 'STUDENT' ? tx('केवल पहला नाम भी चलेगा।', 'A first name is enough.') : undefined} autoComplete="given-name" error={formState.errors.displayName?.message} {...register('displayName')} />
          <Input id="username" label={tx('यूज़रनेम (लॉग इन के लिए)', 'Username (for logging in)')} hint={tx('जैसे: riya_9b', 'e.g. riya_9b')} autoCapitalize="none" spellCheck={false} autoComplete="username" error={formState.errors.username?.message} {...register('username')} />
          {role !== 'STUDENT' && <Input id="email" type="email" label={tx('ईमेल', 'Email')} autoComplete="email" error={formState.errors.email?.message} {...register('email')} />}
          {role === 'TEACHER' && <Input id="schoolName" label={tx('विद्यालय का नाम (वैकल्पिक)', 'School name (optional)')} error={formState.errors.schoolName?.message} {...register('schoolName')} />}
          <PasswordInput id="password" label={tx('पासवर्ड', 'Password')} hint={tx('कम से कम 8 अक्षर। इसे लिखकर सुरक्षित रखें।', 'At least 8 characters. Write it down somewhere safe.')} autoComplete="new-password" error={formState.errors.password?.message} {...register('password')} />

          {/* Honeypot: hidden from people, filled by bots */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="website">Website</label>
            <input id="website" tabIndex={-1} autoComplete="off" {...register('website')} />
          </div>

          <div>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1.5 h-4 w-4 accent-ink-900" {...register('acceptTerms')} />
              <span className="text-[0.97rem] text-ink-800">
                {tx('मैंने ', 'I have read the ')}
                <Link to="/terms" target="_blank">{tx('नियम और शर्तें', 'terms')}</Link>
                {tx(' और ', ' and ')}
                <Link to="/privacy" target="_blank">{tx('गोपनीयता नीति', 'privacy policy')}</Link>
                {tx(' पढ़ ली है।', '.')}
                {role === 'STUDENT' && tx(' 18 वर्ष से कम हूँ तो अभिभावक की अनुमति से खाता बना रहा/रही हूँ।', ' If I am under 18, I am signing up with a parent’s or guardian’s permission.')}
              </span>
            </label>
            {formState.errors.acceptTerms && (
              <p className="mt-1 text-sm text-bad-700" role="alert">
                {formState.errors.acceptTerms.message}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
            {tx('खाता बनाएँ', 'Create account')}
          </Button>
        </form>
        <p className="mt-6 text-[0.97rem]">
          {tx('पहले से खाता है?', 'Already have an account?')} <Link to="/login">{tx('लॉग इन करें', 'Log in')}</Link>
        </p>
      </div>
    </div>
  );
}
