import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, RefreshCw } from 'lucide-react';
import { profileLanguageFor, useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle, writeConsent, readConsent } from '@/hooks';
import { api, ApiError } from '@/services/api';
import type { TeachingLevel, User } from '@/types/api';
import { DISTRICTS } from '@/lib/constants';
import { Alert, Button, Input, PageHeader, PasswordInput, Section, Segmented, Select } from '@/components/ui';

interface StudentProfile {
  linkCode: string;
  guardians: Array<{ kind: 'PARENT' | 'TEACHER'; name: string; school?: string | null; since: string }>;
}

export default function Settings() {
  const { tx, lang, setLang, formatDate } = useLang();
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isStudent = user?.role === 'STUDENT';
  useDocumentTitle(tx('सेटिंग्स', 'Settings'));

  const [name, setName] = useState(user?.displayName ?? '');
  const [district, setDistrict] = useState(user?.student?.district ?? '');
  const [level, setLevel] = useState<TeachingLevel>(user?.student?.teachingLevel ?? 'STANDARD');
  const [goal, setGoal] = useState(user?.student?.dailyGoalMinutes ?? 20);
  const [consent, setConsent] = useState(readConsent() ?? 'essential');

  const profile = useQuery({ queryKey: ['student-profile'], queryFn: () => api<StudentProfile>('/students/me'), enabled: isStudent });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const res = await api<{ user: User }>('/users/me', { method: 'PATCH', body: { displayName: name.trim(), preferredLanguage: profileLanguageFor(lang) } });
      if (isStudent) await api('/students/me', { method: 'PATCH', body: { district: district || null, teachingLevel: level, dailyGoalMinutes: goal } });
      return (await api<{ user: User }>('/users/me')).user ?? res.user;
    },
    onSuccess: (u) => {
      setUser(u);
      toast(tx('बदलाव सहेज लिए गए', 'Changes saved'));
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : tx('सहेजा नहीं जा सका', 'Could not save'), 'error'),
  });

  const rotate = useMutation({
    mutationFn: () => api<{ linkCode: string }>('/students/me/link-code', { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['student-profile'] });
      toast(tx('नया कोड बन गया। पुराना कोड अब काम नहीं करेगा।', 'New code created. The old one no longer works.'));
    },
  });

  const pwSchema = z
    .object({
      currentPassword: z.string().min(1, tx('मौजूदा पासवर्ड लिखें', 'Enter your current password')),
      newPassword: z.string().min(8, tx('कम से कम 8 अक्षर', 'At least 8 characters')).max(72),
      confirm: z.string(),
    })
    .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: tx('दोनों पासवर्ड एक जैसे नहीं हैं', 'Passwords do not match') });
  const pwForm = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });
  const changePassword = async (v: z.infer<typeof pwSchema>) => {
    try {
      await api('/users/me/password', { body: { currentPassword: v.currentPassword, newPassword: v.newPassword } });
      pwForm.reset();
      toast(tx('पासवर्ड बदल गया। कृपया फिर से लॉग इन करें।', 'Password changed. Please log in again.'));
      // The server has revoked every session; the student must sign in again either way
      await logout({ force: true });
      navigate('/login');
    } catch (e) {
      pwForm.setError('currentPassword', { message: e instanceof ApiError ? tx('मौजूदा पासवर्ड गलत है', 'Current password is incorrect') : tx('बदला नहीं जा सका', 'Could not change it') });
    }
  };

  const [deletePw, setDeletePw] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteAccount = async () => {
    if (!window.confirm(tx('क्या आप सच में अपना खाता और सारा डेटा हमेशा के लिए मिटाना चाहते हैं?', 'Do you really want to permanently delete your account and all data?'))) return;
    setDeleteError(null);
    try {
      await api('/users/me', { method: 'DELETE', body: { password: deletePw } });
      await logout({ force: true });
      toast(tx('आपका खाता मिटा दिया गया', 'Your account has been deleted'), 'info');
      navigate('/', { replace: true });
    } catch (e) {
      setDeleteError(e instanceof ApiError ? tx('पासवर्ड गलत है', 'Password is incorrect') : tx('खाता नहीं मिटाया जा सका', 'Could not delete the account'));
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast(tx('कोड कॉपी हो गया', 'Code copied'));
    } catch {
      toast(code, 'info');
    }
  };

  return (
    <>
      <PageHeader title={tx('सेटिंग्स', 'Settings')} />

      {user?.role === 'STUDENT' && (
        <Section title={tx('कक्षा और विषय', 'Class and subjects')}>
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <p>
              {user.student ? `${tx('कक्षा', 'Class')} ${user.student.classLevel} · ${user.student.board}` : tx('अभी नहीं चुना', 'Not chosen yet')}
            </p>
            <Link to="/app/class" className="inline-flex min-h-[44px] items-center font-semibold">
              {tx('कक्षा, बोर्ड या विषय बदलें', 'Change class, board or subjects')}
            </Link>
          </div>
        </Section>
      )}

      <Section title={tx('प्रोफ़ाइल', 'Profile')}>
        <form
          className="panel space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 2) return toast(tx('नाम कम से कम 2 अक्षर का हो', 'Name must be at least 2 characters'), 'error');
            saveProfile.mutate();
          }}
        >
          <Input id="name" label={tx('नाम', 'Name')} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <div>
            <p className="label">{tx('भाषा', 'Language')}</p>
            <Segmented label={tx('भाषा', 'Language')} value={lang} onChange={setLang} options={[{ value: 'hi', label: 'हिंदी' }, { value: 'en', label: 'English' }]} />
          </div>
          {isStudent && (
            <>
              <div>
                <p className="label">{tx('ट्यूटर कैसे समझाए', 'How the tutor should explain')}</p>
                <Segmented
                  label={tx('स्तर', 'Level')}
                  value={level}
                  onChange={setLevel}
                  options={[
                    { value: 'BASIC', label: tx('बहुत आसान', 'Very simple') },
                    { value: 'STANDARD', label: tx('सामान्य', 'Standard') },
                    { value: 'ADVANCED', label: tx('संक्षेप, कठिन', 'Brief, harder') },
                  ]}
                />
              </div>
              <Select id="district" label={tx('ज़िला (वैकल्पिक)', 'District (optional)')} value={district} onChange={(e) => setDistrict(e.target.value)}>
                <option value="">{tx('नहीं बताना', 'Prefer not to say')}</option>
                {DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
              <Select id="goal" label={tx('रोज़ का लक्ष्य', 'Daily goal')} value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
                {[10, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} {tx('मिनट', 'minutes')}
                  </option>
                ))}
              </Select>
            </>
          )}
          <Button type="submit" loading={saveProfile.isPending}>
            {tx('सहेजें', 'Save')}
          </Button>
        </form>
      </Section>

      {isStudent && (
        <Section title={tx('अभिभावक और शिक्षक', 'Parents and teachers')}>
          <div className="panel p-4">
            <p className="text-ink-800">{tx('यह कोड अपने अभिभावक या शिक्षक को दें। वे इससे आपकी प्रगति देख पाएँगे — आपकी ट्यूटर बातचीत नहीं।', 'Give this code to a parent or teacher. They will see your progress — not your tutor conversations.')}</p>
            {profile.data && (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <code className="rounded-md border-2 border-ink-950 bg-ink-50 px-3 py-1.5 text-xl font-bold tracking-[0.2em]">{profile.data.linkCode}</code>
                  <Button variant="secondary" size="sm" onClick={() => copyCode(profile.data!.linkCode)} icon={<Copy className="h-4 w-4" />}>
                    {tx('कॉपी', 'Copy')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => rotate.mutate()} loading={rotate.isPending} icon={<RefreshCw className="h-4 w-4" />}>
                    {tx('नया कोड', 'New code')}
                  </Button>
                </div>
                <p className="mt-4 font-semibold">{tx('जुड़े हुए लोग', 'Linked people')}</p>
                {profile.data.guardians.length === 0 ? (
                  <p className="text-sm text-ink-600">{tx('अभी कोई नहीं जुड़ा है।', 'No one is linked yet.')}</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-[0.95rem]">
                    {profile.data.guardians.map((g, i) => (
                      <li key={i}>
                        {g.name} · {g.kind === 'PARENT' ? tx('अभिभावक', 'Parent') : tx('शिक्षक', 'Teacher')}
                        {g.school ? ` (${g.school})` : ''} · {tx('जुड़े', 'since')} {formatDate(g.since)}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-ink-600">{tx('नया कोड बनाने से पहले से जुड़े लोग नहीं हटते; केवल नए लोग पुराने कोड से नहीं जुड़ पाएँगे।', 'Creating a new code does not remove people already linked; it only stops the old code from being used.')}</p>
              </>
            )}
          </div>
        </Section>
      )}

      {isStudent && (
        <Section title={tx('ऑफ़लाइन', 'Offline')}>
          <p className="text-ink-800">
            {tx('अध्याय सहेजने और न भेजे गए उत्तर देखने के लिए', 'To save chapters and see unsynced answers, open')} <Link to="/app/offline">{tx('ऑफ़लाइन पढ़ाई', 'Offline learning')}</Link>.
          </p>
        </Section>
      )}

      <Section title={tx('गोपनीयता', 'Privacy')}>
        <div className="panel space-y-3 p-4">
          <p className="text-ink-800">{tx('गुमनाम पेज-गिनती', 'Anonymous page counts')}</p>
          <Segmented
            label={tx('विश्लेषण', 'Analytics')}
            value={consent}
            onChange={(v) => {
              setConsent(v);
              writeConsent(v);
              toast(tx('पसंद सहेज ली गई', 'Preference saved'));
            }}
            options={[
              { value: 'essential', label: tx('केवल ज़रूरी', 'Essential only') },
              { value: 'analytics', label: tx('अनुमति', 'Allowed') },
            ]}
          />
          <p className="text-sm">
            <Link to="/privacy">{tx('गोपनीयता नीति पढ़ें', 'Read the privacy policy')}</Link>
          </p>
        </div>
      </Section>

      <Section title={tx('पासवर्ड बदलें', 'Change password')}>
        <form className="panel space-y-4 p-4" onSubmit={pwForm.handleSubmit(changePassword)} noValidate>
          <PasswordInput id="currentPassword" autoComplete="current-password" label={tx('मौजूदा पासवर्ड', 'Current password')} error={pwForm.formState.errors.currentPassword?.message} {...pwForm.register('currentPassword')} />
          <PasswordInput id="newPassword" autoComplete="new-password" label={tx('नया पासवर्ड', 'New password')} error={pwForm.formState.errors.newPassword?.message} {...pwForm.register('newPassword')} />
          <PasswordInput id="confirm" autoComplete="new-password" label={tx('नया पासवर्ड दोबारा', 'Repeat new password')} error={pwForm.formState.errors.confirm?.message} {...pwForm.register('confirm')} />
          <Button type="submit" variant="secondary" loading={pwForm.formState.isSubmitting}>
            {tx('पासवर्ड बदलें', 'Change password')}
          </Button>
        </form>
      </Section>

      <Section title={tx('खाता', 'Account')}>
        <div className="panel space-y-3 p-4">
          <Button variant="secondary" onClick={async () => { if (await logout()) navigate('/', { replace: true }); }}>
            {tx('लॉग आउट', 'Log out')}
          </Button>
          <div className="border-t border-line pt-4">
            <p className="font-semibold text-bad-700">{tx('खाता मिटाएँ', 'Delete account')}</p>
            <p className="text-sm text-ink-700">{tx('इससे आपका खाता, प्रगति, उत्तर और ट्यूटर बातचीत हमेशा के लिए मिट जाएँगे।', 'This permanently deletes your account, progress, answers and tutor conversations.')}</p>
            {deleteError && (
              <div className="mt-2">
                <Alert tone="error">{deleteError}</Alert>
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <PasswordInput id="delete-pw" autoComplete="current-password" label={tx('पुष्टि के लिए पासवर्ड', 'Password to confirm')} value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
              </div>
              <Button variant="danger" onClick={deleteAccount} disabled={!deletePw}>
                {tx('हमेशा के लिए मिटाएँ', 'Delete permanently')}
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
