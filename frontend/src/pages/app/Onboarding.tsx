import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/services/api';
import type { TeachingLevel } from '@/types/api';
import { DISTRICTS } from '@/lib/constants';
import { Alert, Button, Select } from '@/components/ui';
import { Logo } from '@/components/common';

export default function Onboarding() {
  const { tx, lang, setLang } = useLang();
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [district, setDistrict] = useState(user?.student?.district ?? '');
  const [level, setLevel] = useState<TeachingLevel>(user?.student?.teachingLevel ?? 'STANDARD');
  const [goal, setGoal] = useState(user?.student?.dailyGoalMinutes ?? 20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(tx('शुरुआत', 'Get started'));

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      await api('/users/me', { method: 'PATCH', body: { preferredLanguage: lang === 'hi' ? 'HI' : 'EN' } });
      await api('/students/me', { method: 'PATCH', body: { district: district || null, teachingLevel: level, dailyGoalMinutes: goal, onboardingDone: true } });
      await refreshUser();
      toast(tx('सब तैयार है। चलिए शुरू करते हैं!', 'All set. Let’s begin!'));
      navigate('/app', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('सहेजा नहीं जा सका', 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const levels: Array<{ v: TeachingLevel; hi: string; en: string; dhi: string; den: string }> = [
    { v: 'BASIC', hi: 'गणित मुश्किल लगता है', en: 'Maths feels hard', dhi: 'बहुत आसान शब्दों और छोटे कदमों में समझाएँ', den: 'Explain in very simple words and small steps' },
    { v: 'STANDARD', hi: 'ठीक-ठाक है', en: 'I’m okay with it', dhi: 'कक्षा 9 के स्तर पर साफ़ कदमों में', den: 'Clear steps at Class 9 level' },
    { v: 'ADVANCED', hi: 'मुझे गणित पसंद है', en: 'I enjoy maths', dhi: 'संक्षेप में, और थोड़ा कठिन सवाल भी दें', den: 'Be brief and give me harder follow-ups' },
  ];

  const steps = [
    {
      title: tx('आप किस भाषा में पढ़ना चाहेंगे?', 'Which language would you like to learn in?'),
      body: (
        <div className="grid gap-2 sm:grid-cols-2">
          {(['hi', 'en'] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} className={`rounded-md border-2 px-4 py-4 text-left ${lang === l ? 'border-ink-950 bg-saffron-100 shadow-brut-sm' : 'border-ink-950 bg-white hover:bg-saffron-50'}`} aria-pressed={lang === l}>
              <span className="block text-lg font-semibold">{l === 'hi' ? 'हिंदी' : 'English'}</span>
              <span className="block text-sm text-ink-600">{l === 'hi' ? 'पाठ, संकेत और ट्यूटर हिंदी में' : 'Lessons, hints and tutor in English'}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: tx('आपको गणित कैसा लगता है?', 'How do you feel about maths?'),
      body: (
        <div className="grid gap-2">
          {levels.map((l) => (
            <button key={l.v} type="button" onClick={() => setLevel(l.v)} className={`rounded-md border-2 px-4 py-3 text-left ${level === l.v ? 'border-ink-950 bg-saffron-100 shadow-brut-sm' : 'border-ink-950 bg-white hover:bg-saffron-50'}`} aria-pressed={level === l.v}>
              <span className="block font-semibold">{tx(l.hi, l.en)}</span>
              <span className="block text-sm text-ink-600">{tx(l.dhi, l.den)}</span>
            </button>
          ))}
          <p className="text-sm text-ink-600">{tx('इसे बाद में सेटिंग्स में बदल सकते हैं।', 'You can change this later in settings.')}</p>
        </div>
      ),
    },
    {
      title: tx('थोड़ी और जानकारी (वैकल्पिक)', 'A little more (optional)'),
      body: (
        <div className="space-y-4">
          <Select id="district" label={tx('आपका ज़िला', 'Your district')} hint={tx('केवल सही उदाहरण चुनने के लिए। छोड़ भी सकते हैं।', 'Only used to pick relevant examples. You can skip it.')} value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">{tx('नहीं बताना', 'Prefer not to say')}</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <div>
            <p className="label">{tx('रोज़ कितनी देर पढ़ेंगे?', 'Daily study goal')}</p>
            <div className="flex flex-wrap gap-2">
              {[10, 20, 30, 45].map((m) => (
                <button key={m} type="button" onClick={() => setGoal(m)} className={`rounded-md border-2 px-4 py-2 font-semibold ${goal === m ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-950 bg-white text-ink-950 hover:bg-saffron-50'}`} aria-pressed={goal === m}>
                  {m} {tx('मिनट', 'min')}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="container-page flex h-14 items-center">
          <Logo to="/onboarding" />
        </div>
      </header>
      <main className="container-page max-w-xl py-10">
        <p className="text-sm text-ink-600">
          {tx('कदम', 'Step')} {step + 1} / {steps.length}
        </p>
        <div className="mt-2 h-1 w-full rounded-full bg-ink-100">
          <div className="h-1 rounded-full bg-saffron-400 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <h1 className="mt-6 text-[1.5rem]">{steps[step].title}</h1>
        <div className="mt-5">{steps[step].body}</div>
        {error && (
          <div className="mt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            {tx('पीछे', 'Back')}
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>{tx('आगे', 'Next')}</Button>
          ) : (
            <Button onClick={finish} loading={saving}>
              {tx('पढ़ाई शुरू करें', 'Start learning')}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
