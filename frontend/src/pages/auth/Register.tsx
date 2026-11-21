import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, AtSign, Check, KeyRound, Mail, School, User } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { homePathFor, useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { ApiError } from '@/services/api';
import { Alert, Button, Input, PasswordInput } from '@/components/ui';

type RoleOption = 'STUDENT' | 'PARENT' | 'TEACHER';
type Step = 0 | 1 | 2;

export default function Register() {
  const { tx, lang } = useLang();
  const { register: signUp, user, status } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(0);
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
      guardianConsent: z.boolean().optional(),
    })
    .superRefine((v, ctx) => {
      if (v.role === 'STUDENT' && !v.guardianConsent) {
        ctx.addIssue({ code: 'custom', path: ['guardianConsent'], message: tx('माता-पिता या अभिभावक की अनुमति ज़रूरी है', 'A parent or guardian must agree first') });
      }
      if (v.role !== 'STUDENT') {
        if (!v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: tx('अभिभावक/शिक्षक के लिए ईमेल ज़रूरी है', 'Email is required for parents and teachers') });
        else if (!z.string().email().safeParse(v.email).success) ctx.addIssue({ code: 'custom', path: ['email'], message: tx('सही ईमेल लिखें', 'Enter a valid email') });
      }
    });
  type Form = z.infer<typeof schema>;

  const { register, handleSubmit, watch, setValue, setError, clearErrors, trigger, getValues, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'STUDENT', acceptTerms: false, guardianConsent: false },
  });
  const role = watch('role');

  if (status !== 'loading' && user) return <Navigate to={homePathFor(user)} replace />;

  const steps = [
    { hi: 'आपके बारे में', en: 'About you' },
    { hi: 'लॉग इन', en: 'Login details' },
    { hi: 'पुष्टि', en: 'Confirm' },
  ];

  /** Validate only the fields on the current step before moving on. */
  const next = async () => {
    if (step === 0) {
      const ok = await trigger('displayName');
      // The email rule lives in a whole-form refine, so check it here directly.
      let emailOk = true;
      if (getValues('role') !== 'STUDENT') {
        const email = (getValues('email') ?? '').trim();
        if (!email) {
          setError('email', { message: tx('अभिभावक/शिक्षक के लिए ईमेल ज़रूरी है', 'Email is required for parents and teachers') });
          emailOk = false;
        } else if (!z.string().email().safeParse(email).success) {
          setError('email', { message: tx('सही ईमेल लिखें', 'Enter a valid email') });
          emailOk = false;
        } else clearErrors('email');
      }
      if (ok && emailOk) setStep(1);
    } else if (step === 1) {
      if (await trigger(['username', 'password'])) setStep(2);
    }
  };

  const onSubmit = async (data: Form) => {
    setServerError(null);
    try {
      const u = await signUp({
        ...data,
        email: data.role === 'STUDENT' ? undefined : data.email,
        schoolName: data.role === 'TEACHER' ? data.schoolName : undefined,
        guardianConsent: data.role === 'STUDENT' ? data.guardianConsent : undefined,
        preferredLanguage: lang === 'hi' ? 'HI' : 'EN',
      });
      toast(tx('खाता बन गया!', 'Your account is ready!'));
      navigate(homePathFor(u), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          const field = err.raw.toLowerCase().includes('email') ? 'email' : 'username';
          setError(field, { message: field === 'email' ? tx('यह ईमेल पहले से दर्ज है', 'This email is already registered') : tx('यह यूज़रनेम कोई और ले चुका है', 'This username is taken') });
          setStep(field === 'email' ? 0 : 1);
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

  // If the server rejects a field from an earlier step, jump back to it.
  const onInvalid = (errors: Partial<Record<keyof Form, unknown>>) => {
    if (errors.displayName || errors.email || errors.schoolName) setStep(0);
    else if (errors.username || errors.password) setStep(1);
  };

  const roles: Array<{ value: RoleOption; hi: string; en: string }> = [
    { value: 'STUDENT', hi: 'विद्यार्थी', en: 'Student' },
    { value: 'PARENT', hi: 'अभिभावक', en: 'Parent' },
    { value: 'TEACHER', hi: 'शिक्षक', en: 'Teacher' },
  ];
  const roleLabel = roles.find((r) => r.value === role)!;
  const v = getValues();

  return (
    <div className="bg-sunk px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[30rem] rounded-lg border-2 border-ink-950 bg-white px-5 py-7 shadow-brut sm:px-8">
        <div className="text-center">
          <img src="/favicon.svg" alt="" width={48} height={48} className="mx-auto h-12 w-12" />
          <h1 className="mt-3 text-[1.6rem]">{tx('GURUKUL AI से जुड़िए', 'Join GURUKUL AI')}</h1>
          <p className="mt-1 text-ink-600">{tx('हम केवल उतनी जानकारी लेते हैं जितनी ज़रूरी है।', 'We only ask for what is necessary.')}</p>
        </div>

        {/* Progress */}
        <div className="mt-6">
          <div className="h-2 overflow-hidden rounded-full border-[1.5px] border-ink-950 bg-sunk" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-label={tx('चरण', 'Step')}>
            <div className="h-full bg-ink-950 transition-[width] duration-200" style={{ width: `${((step + 1) / 3) * 100}%` }} />
          </div>
          <ol className="mt-3 grid grid-cols-3 gap-2 text-sm">
            {steps.map((s, i) => (
              <li key={s.en} className={`flex min-w-0 items-center gap-1.5 ${i === 1 ? 'justify-center' : i === 2 ? 'justify-end' : ''} ${i === step ? 'font-bold text-ink-950' : 'text-ink-600'}`} aria-current={i === step ? 'step' : undefined}>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs font-bold ${
                    i < step ? 'border-ink-950 bg-ink-950 text-white' : i === step ? 'border-ink-950 bg-saffron-400 text-ink-950' : 'border-ink-300 bg-white'
                  }`}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                </span>
                <span className={`whitespace-nowrap pr-0.5 ${i === step ? '' : 'hidden sm:inline'}`}>{tx(s.hi, s.en)}</span>
              </li>
            ))}
          </ol>
        </div>

        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            if (step < 2) {
              e.preventDefault();
              void next();
              return;
            }
            void handleSubmit(onSubmit, onInvalid)(e);
          }}
          noValidate
        >
          {serverError && <Alert tone="error">{serverError}</Alert>}

          {step === 0 && (
            <>
              <fieldset>
                <legend className="label">{tx('आप कौन हैं?', 'Who are you?')}</legend>
                <div className="grid grid-cols-3 overflow-hidden rounded border-2 border-ink-950">
                  {roles.map((r) => (
                    <label key={r.value} className={`flex min-h-[44px] cursor-pointer items-center justify-center border-r-2 border-ink-950 px-2 text-center text-sm font-bold last:border-r-0 has-[:focus-visible]:bg-saffron-100 ${role === r.value ? 'bg-ink-950 text-white' : 'bg-white hover:bg-saffron-100'}`}>
                      <input type="radio" value={r.value} className="sr-only" checked={role === r.value} onChange={() => setValue('role', r.value)} />
                      {tx(r.hi, r.en)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Input id="displayName" icon={<User />} label={tx('आपका नाम', 'Your name')} placeholder={tx('जैसे: रिया', 'e.g. Riya')} hint={role === 'STUDENT' ? tx('केवल पहला नाम भी चलेगा।', 'A first name is enough.') : undefined} autoComplete="given-name" error={formState.errors.displayName?.message} {...register('displayName')} />
              {role !== 'STUDENT' && <Input id="email" type="email" icon={<Mail />} label={tx('ईमेल', 'Email')} placeholder="name@example.com" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />}
              {role === 'TEACHER' && <Input id="schoolName" icon={<School />} label={tx('विद्यालय का नाम (वैकल्पिक)', 'School name (optional)')} error={formState.errors.schoolName?.message} {...register('schoolName')} />}
              {role === 'STUDENT' && <p className="callout text-sm">{tx('विद्यार्थियों से हम ईमेल या फ़ोन नंबर नहीं लेते।', 'We do not ask students for an email or phone number.')}</p>}
            </>
          )}

          {step === 1 && (
            <>
              <Input id="username" icon={<AtSign />} label={tx('यूज़रनेम (लॉग इन के लिए)', 'Username (for logging in)')} placeholder="riya_9b" hint={tx('अंग्रेज़ी अक्षर, अंक, . और _', 'Letters, numbers, . and _')} autoCapitalize="none" spellCheck={false} autoComplete="username" error={formState.errors.username?.message} {...register('username')} />
              <PasswordInput id="password" icon={<KeyRound />} label={tx('पासवर्ड', 'Password')} placeholder={tx('कम से कम 8 अक्षर', 'At least 8 characters')} hint={tx('इसे लिखकर सुरक्षित रखें। पासवर्ड रीसेट अभी संभव नहीं है।', 'Write it down somewhere safe. Password reset is not available yet.')} autoComplete="new-password" error={formState.errors.password?.message} {...register('password')} />
            </>
          )}

          {step === 2 && (
            <>
              <dl className="divide-y divide-line rounded border-2 border-ink-950 text-[0.97rem]">
                {[
                  [tx('भूमिका', 'Role'), tx(roleLabel.hi, roleLabel.en)],
                  [tx('नाम', 'Name'), v.displayName],
                  ...(role !== 'STUDENT' ? [[tx('ईमेल', 'Email'), v.email ?? '']] : []),
                  [tx('यूज़रनेम', 'Username'), v.username],
                ].map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-4 px-3 py-2">
                    <dt className="text-ink-600">{k}</dt>
                    <dd className="min-w-0 truncate font-semibold">{val}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <label className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1.5 h-5 w-5 shrink-0 accent-ink-950" {...register('acceptTerms')} />
                  <span className="text-[0.97rem] text-ink-800">
                    {tx('मैंने ', 'I have read the ')}
                    <Link to="/terms" target="_blank">{tx('नियम और शर्तें', 'terms')}</Link>
                    {tx(' और ', ' and ')}
                    <Link to="/privacy" target="_blank">{tx('गोपनीयता नीति', 'privacy policy')}</Link>
                    {tx(' पढ़ ली है।', '.')}
                  </span>
                </label>
                {formState.errors.acceptTerms && (
                  <p className="mt-1 text-sm text-bad-700" role="alert">
                    {formState.errors.acceptTerms.message}
                  </p>
                )}
              </div>
              {role === 'STUDENT' && (
                <div>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1.5 h-5 w-5 shrink-0 accent-ink-950" {...register('guardianConsent')} />
                    <span className="text-[0.97rem] text-ink-800">
                      {tx(
                        'मेरे माता-पिता या अभिभावक को पता है कि मैं यह ऐप इस्तेमाल कर रहा/रही हूँ, और उन्होंने अनुमति दी है।',
                        'My parent or guardian knows I am using this app and has agreed.',
                      )}
                    </span>
                  </label>
                  <p className="mt-1 text-sm text-ink-600">
                    {tx('बाद में वे अपने खाते से आपका कोड जोड़कर अनुमति की पुष्टि कर सकते हैं।', 'Later they can confirm it by linking your code from their own account.')}
                  </p>
                  {formState.errors.guardianConsent && (
                    <p className="mt-1 text-sm text-bad-700" role="alert">
                      {formState.errors.guardianConsent.message}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Honeypot: hidden from people, filled by bots */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="website">Website</label>
            <input id="website" tabIndex={-1} autoComplete="off" {...register('website')} />
          </div>

          <div className="flex gap-3">
            {step > 0 && (
              <Button type="button" variant="secondary" size="lg" onClick={() => setStep((s) => (s - 1) as Step)} aria-label={tx('पीछे', 'Back')}>
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </Button>
            )}
            <Button type="submit" size="lg" className="flex-1" loading={formState.isSubmitting}>
              {step < 2 ? tx('आगे बढ़ें', 'Continue') : tx('खाता बनाएँ', 'Create account')}
              {step < 2 && <ArrowRight className="h-5 w-5" aria-hidden />}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-[0.97rem]">
          {tx('पहले से खाता है?', 'Already have an account?')} <Link to="/login">{tx('लॉग इन करें', 'Log in')}</Link>
        </p>
      </div>
    </div>
  );
}
