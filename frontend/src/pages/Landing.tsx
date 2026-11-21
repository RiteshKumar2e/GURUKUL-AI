import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calculator, Camera, CloudOff, Eye, Keyboard, Lock, Mic, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { homePathFor, useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks';
import { ButtonLink } from '@/components/ui';
import { CHAPTERS } from '@/lib/constants';

const CONTACT = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim();

/* -------------------------------------------------------------------------------------------- */
/*  Hero preview: a prepared worked example laid out like the tutor screen. Visitors step through */
/*  it one hint at a time. It is labelled as a prepared example; nothing here calls the model.    */
/* -------------------------------------------------------------------------------------------- */

function TutorPreview() {
  const { tx } = useLang();
  const [step, setStep] = useState(0);
  const lines = [
    { tag: tx('संकेत 1', 'Hint 1'), text: tx('बाईं ओर 2x के साथ +5 है। उसे हटाने के लिए दोनों ओर से क्या घटाएँगे?', 'There is +5 next to 2x. What will you subtract from both sides to remove it?') },
    { tag: tx('कदम', 'Step'), text: tx('दोनों ओर से 5 घटाया: 2x = 17 − 5 = 12', 'Subtract 5 from both sides: 2x = 17 − 5 = 12') },
    { tag: tx('कदम', 'Step'), text: tx('दोनों ओर 2 से भाग: x = 12 ÷ 2 = 6', 'Divide both sides by 2: x = 12 ÷ 2 = 6') },
    { tag: tx('अब आप जाँचिए', 'Now you check'), text: tx('x = 6 रखकर देखिए — क्या 2 × 6 + 5 = 17 बनता है?', 'Put x = 6 back — does 2 × 6 + 5 make 17?') },
  ];
  const next = [tx('अभी भी अटका हूँ', 'Still stuck'), tx('अगला कदम', 'Next step'), tx('जाँच कैसे करूँ?', 'How do I check?')];
  const last = lines.length - 1;

  return (
    <div className="relative">
      <div className="panel overflow-hidden shadow-brut-lg" role="group" aria-label={tx('ट्यूटर का नमूना', 'Tutor sample')}>
        {/* window bar */}
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink-950 bg-ink-900 px-4 py-2.5 text-white">
          <p className="font-display text-sm font-bold">{tx('ट्यूटर · रैखिक समीकरण', 'Tutor · Linear equations')}</p>
          <span className="rounded-full border border-white/70 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider">{tx('तैयार उदाहरण', 'Prepared example')}</span>
        </div>

        <div className="space-y-3 bg-paper px-4 py-4">
          {/* student's question, as it arrives from the mic */}
          <div className="ml-auto max-w-[90%] rounded-md border-2 border-ink-950 bg-white px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
              <Mic className="h-3.5 w-3.5" aria-hidden />
              {tx('बोलकर पूछा · लिखावट जाँची', 'Asked aloud · transcript checked')}
            </p>
            <p className="mt-0.5 text-base font-semibold text-ink-950">{tx('2x + 5 = 17 में x कैसे निकालूँ?', 'How do I find x in 2x + 5 = 17?')}</p>
          </div>

          <ol className="space-y-2" aria-live="polite">
            {lines.slice(0, step + 1).map((l, i) => (
              <li key={i} className={`max-w-[94%] rounded-md border-2 border-ink-950 px-3 py-2 ${i === 0 ? 'bg-lemon-100' : i === last ? 'bg-sky' : 'bg-white'}`}>
                <p className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-950">{l.tag}</p>
                <p className="text-base text-ink-950">{l.text}</p>
              </li>
            ))}
          </ol>

          {step === last && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-good-700">
              <Calculator className="h-4 w-4" aria-hidden />
              {tx('x = 6 कैलकुलेटर से दोबारा जाँचा गया', 'x = 6 re-checked with a calculator')}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t-2 border-dashed border-ink-950/30 pt-3">
            {step < last ? (
              <button type="button" onClick={() => setStep((s) => s + 1)} className="min-h-[44px] rounded-md border-2 border-ink-950 bg-white px-3 text-sm font-bold shadow-brut-sm hover:bg-lemon-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                {next[step]}
              </button>
            ) : (
              <button type="button" onClick={() => setStep(0)} className="min-h-[44px] px-1 font-display text-sm font-bold underline decoration-saffron-400 decoration-2 underline-offset-4">
                {tx('शुरू से देखें', 'Start again')}
              </button>
            )}
            <span className="meta tabular-nums">
              {step + 1} / {lines.length}
            </span>
          </div>
        </div>

        {/* composer: the three real input modes, each linking to the working feature */}
        <div className="grid grid-cols-3 border-t-2 border-ink-950 bg-white text-sm font-bold">
          <ModeLink to="/app/voice" icon={Mic} label={tx('बोलें', 'Speak')} />
          <ModeLink to="/app/tutor" icon={Keyboard} label={tx('लिखें', 'Type')} />
          <ModeLink to="/app/photo" icon={Camera} label={tx('फ़ोटो', 'Photo')} />
        </div>
      </div>
    </div>
  );
}

function ModeLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} className="flex min-h-[48px] items-center justify-center gap-1.5 border-r-2 border-ink-950 text-ink-950 no-underline last:border-r-0 hover:bg-lemon-100">
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}

/* --------------------------------------- small pieces --------------------------------------- */

function SectionHead({ label, title, children }: { label: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <h2 className="mt-2 text-[1.7rem] leading-[1.2] sm:text-[2.1rem]">{title}</h2>
      {children && <div className="mt-4 max-w-xl text-base text-ink-800">{children}</div>}
    </div>
  );
}

/* -------------------------------------------- page ------------------------------------------- */

export default function Landing() {
  const { tx, lang } = useLang();
  const { user } = useAuth();
  useDocumentTitle(
    tx('कक्षा 9 गणित, हिंदी में', 'Class 9 maths, in Hindi'),
    tx(
      'GURUKUL AI झारखंड (JAC) के कक्षा 9 के विद्यार्थियों के लिए हिंदी में गणित सीखने का साथी है। पहले संकेत, फिर हल। बोलकर, लिखकर या फ़ोटो से पूछिए।',
      'GURUKUL AI is a Hindi-first maths companion for JAC Class 9 students in Jharkhand. Hints before answers. Ask by voice, typing or photo.',
    ),
  );
  const cta = user ? homePathFor(user) : '/register';
  const ctaLabel = user ? tx('पढ़ाई जारी रखें', 'Continue learning') : tx('पढ़ाई शुरू करें', 'Start learning');
  const hi = lang === 'hi';

  const methods = [
    {
      icon: Mic,
      to: '/app/voice',
      title: tx('बोलकर पूछिए', 'Ask by voice'),
      body: tx('माइक दबाइए और हिंदी में सवाल बोलिए। भेजने से पहले लिखा हुआ सवाल दिखता है, ताकि गलती हो तो आप सुधार सकें। जवाब पढ़कर भी सुनाया जाता है।', 'Tap the mic and ask in Hindi. You see the transcript before sending and can fix it. The reply can be read aloud.'),
      note: tx('इंटरनेट चाहिए', 'Needs internet'),
    },
    {
      icon: Keyboard,
      to: '/app/tutor',
      title: tx('लिखकर पूछिए', 'Type a question'),
      body: tx('हिंदी, अंग्रेज़ी या हिंग्लिश — जैसे लिखना आसान हो। चाहें तो पहले केवल संकेत माँगिए, पूरा हल बाद में।', 'Hindi, English or Hinglish — whatever is easiest. Ask for just a hint first, the full solution later.'),
      note: tx('इंटरनेट चाहिए', 'Needs internet'),
    },
    {
      icon: Camera,
      to: '/app/photo',
      title: tx('कॉपी की फ़ोटो भेजिए', 'Send a notebook photo'),
      body: tx('किताब या कॉपी के सवाल की फ़ोटो लीजिए। फ़ोटो फ़ोन पर ही छोटी होती है, और पढ़ा गया सवाल आप हल माँगने से पहले सुधार सकते हैं।', 'Photograph a question from your book or notebook. It is shrunk on the phone, and you can correct the read-out question before asking.'),
      note: tx('इंटरनेट चाहिए', 'Needs internet'),
    },
  ];

  const ladder = [
    { n: '01', t: tx('पहले एक संकेत', 'A hint first'), d: tx('ट्यूटर सीधा उत्तर नहीं देता। वह बताता है कि शुरुआत कहाँ से करें।', 'The tutor does not hand over the answer. It shows where to begin.') },
    { n: '02', t: tx('फिर छोटे-छोटे कदम', 'Then small steps'), d: tx('हर कदम एक लाइन में, सरल हिंदी में, रोज़ की चीज़ों के उदाहरण के साथ।', 'Each step in one line, in plain Hindi, with everyday examples.') },
    { n: '03', t: tx('उत्तर की जाँच', 'The answer is checked'), d: tx('अंतिम संख्या एक अलग कैलकुलेटर से दोबारा जाँची जाती है। मेल न खाए तो चेतावनी दिखती है।', 'The final number is re-checked by a separate calculator. If it does not match, you see a warning.') },
    { n: '04', t: tx('समझ की जाँच', 'Checking understanding'), d: tx('अंत में एक छोटा सवाल आपसे पूछा जाता है, ताकि पता चले कि बात समझ आई।', 'It ends with a short question back to you, to see whether it clicked.') },
  ];

  const offlineFlow = [
    { icon: ArrowRight, t: tx('अध्याय डाउनलोड करें', 'Download a chapter'), d: tx('Wi-Fi या अच्छे नेटवर्क पर एक बार।', 'Once, on Wi-Fi or a good signal.') },
    { icon: CloudOff, t: tx('बिना नेटवर्क पढ़ें', 'Study with no signal'), d: tx('पाठ, उदाहरण और अभ्यास फ़ोन पर ही खुलते और जाँचे जाते हैं।', 'Lessons, examples and practice open and are checked on the phone.') },
    { icon: RefreshCw, t: tx('अपने-आप सिंक', 'Syncs by itself'), d: tx('उत्तर फ़ोन में सहेजे रहते हैं और नेटवर्क आते ही एक बार भेजे जाते हैं — दोहराव नहीं।', 'Answers wait on the phone and are sent once when the network returns — no duplicates.') },
  ];

  const trust = [
    { icon: Lock, t: tx('कम से कम जानकारी', 'Minimal data'), d: tx('नाम और यूज़रनेम काफ़ी है। आधार, फ़ोन नंबर या स्कूल ID नहीं माँगते।', 'A name and username are enough. No Aadhaar, phone number or school ID.') },
    { icon: Users, t: tx('साझा फ़ोन पर अलग खाते', 'Separate accounts on a shared phone'), d: tx('लॉग आउट करते ही फ़ोन में सहेजा निजी डेटा मिट जाता है, ताकि भाई-बहन एक-दूसरे की प्रगति न देखें।', 'Logging out clears personal data stored on the phone, so siblings do not see each other’s progress.') },
    { icon: Calculator, t: tx('AI की जाँच', 'AI answers are checked'), d: tx('संख्यात्मक उत्तर अलग कैलकुलेटर से जाँचे जाते हैं। मेल न खाए तो साफ़ चेतावनी दिखती है।', 'Numeric answers are re-checked by a separate calculator. A mismatch shows a clear warning.') },
    { icon: Eye, t: tx('पढ़ने में आसान', 'Easy to read'), d: tx('बड़े बटन, साफ़ कंट्रास्ट, स्क्रीन-रीडर और कीबोर्ड से पूरा उपयोग।', 'Large buttons, strong contrast, full screen-reader and keyboard use.') },
  ];

  return (
    <div className="leading-[1.6]">
      {/* 1 ─ Hero */}
      <section className="border-b-2 border-ink-950">
        <div className="container-page grid gap-10 py-10 md:grid-cols-[1.1fr_1fr] md:gap-12 md:py-16">
          <div className="flex flex-col">
            <p className="eyebrow">
              <span className="inline-block rounded-full border-2 border-ink-950 bg-white px-3 py-1 text-ink-950">{tx('JAC · कक्षा 9 · गणित', 'JAC · Class 9 · Maths')}</span>
            </p>
            <h1 className={`mt-6 ${hi ? 'text-[2.1rem] leading-[1.35] sm:text-[2.75rem]' : 'text-[2.1rem] leading-[1.15] sm:text-[2.85rem]'}`}>
              {hi ? (
                <>
                  गणित का हर सवाल, <span className="mark">अपनी भाषा</span> में समझिए।
                </>
              ) : (
                <>
                  Understand every maths question in <span className="mark">your own language.</span>
                </>
              )}
            </h1>
            <p className="mt-5 max-w-lg text-[1.08rem] text-ink-800">
              {tx(
                'कक्षा 9 के विद्यार्थियों के लिए हिंदी में गणित का ट्यूटर। उत्तर बताने से पहले संकेत देता है, कदम-दर-कदम समझाता है, और कमज़ोर नेटवर्क पर भी पढ़ाई रुकने नहीं देता।',
                'A Hindi maths tutor for Class 9. It gives hints before answers, explains step by step, and keeps working on a weak network.',
              )}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <ButtonLink to={cta} size="lg" className="shadow-brut">
                {ctaLabel}
                <ArrowRight className="h-5 w-5" aria-hidden />
              </ButtonLink>
              {!user && (
                <ButtonLink to="/login" size="lg" variant="secondary">
                  {tx('लॉग इन', 'Log in')}
                </ButtonLink>
              )}
            </div>
            <p className="meta mt-5">{tx('मुफ़्त · विद्यार्थी के लिए ईमेल ज़रूरी नहीं · सस्ते Android फ़ोन पर चलता है', 'Free · No email needed for students · Runs on low-cost Android phones')}</p>
          </div>
          <TutorPreview />
        </div>
      </section>

      {/* 2 ─ Three ways to ask */}
      <section className="bg-white">
        <div className="container-page py-14 md:py-20">
          <SectionHead label={tx('पूछने के तीन तरीके', 'Three ways to ask')} title={tx('जैसे आसान लगे, वैसे पूछिए।', 'Ask the way that suits you.')} />
          <ol className="mt-10 grid overflow-hidden rounded-lg border-2 border-ink-950 shadow-brut md:grid-cols-3">
            {methods.map((m, i) => (
              <li key={m.to} className={`flex flex-col p-5 sm:p-6 ${i < 2 ? 'border-b-2 border-ink-950 md:border-b-0 md:border-r-2' : ''} ${i === 0 ? 'bg-lemon-100' : 'bg-white'}`}>
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md border-2 border-ink-950 bg-white">
                    <m.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="meta font-bold">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-xl">{m.title}</h3>
                <p className="mt-2 flex-1 text-ink-800">{m.body}</p>
                <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                  <Link to={m.to} className="inline-flex min-h-[44px] items-center gap-1 font-bold">
                    {tx('आज़माएँ', 'Try it')}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <span className="rounded-full border-[1.5px] border-ink-950 bg-white px-2.5 py-0.5 text-xs font-bold">{m.note}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3 ─ How the tutor teaches */}
      <section id="how" className="scroll-mt-20 border-y-2 border-ink-950">
        <div className="container-page grid gap-10 py-14 md:grid-cols-[0.9fr_1.1fr] md:py-20">
          <SectionHead label={tx('ट्यूटर कैसे पढ़ाता है', 'How the tutor teaches')} title={<>{tx('उत्तर नहीं,', 'Not answers,')} <span className="mark">{tx('समझ', 'understanding')}</span>{tx('।', '.')}</>}>
            <p>
              {tx(
                'अच्छा शिक्षक तुरंत हल नहीं लिखता। GURUKUL AI भी पहले सोचने का मौका देता है — और ज़रूरत पड़ने पर ही अगला कदम खोलता है।',
                'A good teacher does not write the solution straight away. GURUKUL AI also gives you room to think, and opens the next step only when you need it.',
              )}
            </p>
          </SectionHead>
          <ol className="border-t-2 border-ink-950">
            {ladder.map((s) => (
              <li key={s.n} className="grid grid-cols-[3.5rem_1fr] gap-3 border-b-2 border-ink-950 py-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-ink-950 bg-saffron-400 text-sm font-extrabold tabular-nums">{s.n}</span>
                <div>
                  <h3 className="text-lg">{s.t}</h3>
                  <p className="mt-1 text-ink-800">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 ─ Curriculum */}
      <section className="dots">
        <div className="container-page py-14 md:py-20">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <SectionHead label={tx('पाठ्यक्रम', 'Curriculum')} title={tx('कक्षा 9 गणित के 12 अध्याय', 'All 12 chapters of Class 9 maths')}>
              <p>
                {tx(
                  'हर अध्याय में छोटे पाठ, हल किए उदाहरण, तीन स्तर के अभ्यास प्रश्न और अध्याय परीक्षा। सामग्री इस परियोजना के लिए नए सिरे से लिखी गई है; अध्यायों का क्रम NCERT कक्षा 9 (संशोधित) पुस्तक पर आधारित है, जिसे JAC अपनाता है।',
                  'Each chapter has short lessons, worked examples, practice at three levels and a chapter quiz. Content is written fresh for this project; the chapter order follows the rationalised NCERT Class 9 book that JAC uses.',
                )}
              </p>
            </SectionHead>
            <Link to="/about" className="inline-flex min-h-[44px] items-center font-bold">
              {tx('स्रोत और सत्यापन देखें', 'See sources and verification')}
            </Link>
          </div>
          <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHAPTERS.map((c) => (
              <li key={c.n} className="flex min-h-[60px] items-center gap-3 rounded-md border-2 border-ink-950 bg-white px-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-ink-900 text-sm font-bold tabular-nums text-white">{c.n}</span>
                <span className="font-semibold text-ink-950">{tx(c.hi, c.en)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5 ─ Offline */}
      <section className="border-y-2 border-ink-950 bg-sky">
        <div className="container-page grid gap-10 py-14 md:grid-cols-[1fr_1.2fr] md:py-20">
          <SectionHead label={tx('कमज़ोर नेटवर्क', 'Weak network')} title={tx('नेटवर्क जाए, पढ़ाई न रुके।', 'The network drops. Learning does not.')}>
            <p>
              {tx(
                'पाठ और अभ्यास इंटरनेट के बिना चलते हैं। AI ट्यूटर, आवाज़ और फ़ोटो के लिए इंटरनेट चाहिए — ऐप यह हर बार साफ़ बताता है।',
                'Lessons and practice work without internet. The AI tutor, voice and photo need internet — and the app always says so.',
              )}
            </p>
          </SectionHead>
          <div>
            <ol className="panel overflow-hidden shadow-brut">
              {offlineFlow.map((f, i) => (
                <li key={i} className="flex gap-4 border-b-2 border-ink-950 px-4 py-4 last:border-b-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2 border-ink-950 bg-paper">
                    <f.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-base">{f.t}</h3>
                    <p className="text-ink-800">{f.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            {/* The same status strip the app shows while offline */}
            <p className="callout mt-4 flex items-center gap-2 text-sm font-bold text-ink-950">
              <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
              {tx('आप ऑफ़लाइन हैं · 3 उत्तर फ़ोन में सहेजे गए', 'You are offline · 3 answers saved on this phone')}
            </p>
          </div>
        </div>
      </section>

      {/* 6 ─ Parents & teachers */}
      <section id="guardians" className="scroll-mt-20 bg-ink-900 text-white">
        <div className="container-page grid gap-10 py-14 md:grid-cols-[1fr_1fr] md:py-20">
          <div>
            <p className="eyebrow text-saffron-400">{tx('अभिभावक और शिक्षक', 'Parents & teachers')}</p>
            <h2 className="mt-2 text-[1.7rem] leading-[1.2] text-white sm:text-[2.1rem]">{tx('बच्चा कहाँ अटका है, यह दिखे।', 'See where the student is stuck.')}</h2>
            <p className="mt-4 max-w-xl text-ink-100">
              {tx(
                'विद्यार्थी अपनी सेटिंग्स से 6 अक्षरों का कोड देता है। उससे जुड़कर आप अध्याय-वार प्रगति, कमज़ोर विषय, अभ्यास और अगला सुझाया गया विषय देख सकते हैं।',
                'The student shares a 6-letter code from settings. Once linked, you see chapter-wise progress, weak topics, practice activity and the next suggested topic.',
              )}
            </p>
            <ul className="mt-6 space-y-2 text-ink-100">
              <li className="flex gap-2">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-saffron-400" aria-hidden />
                {tx('ट्यूटर से हुई बातचीत निजी रहती है — केवल उसकी संख्या दिखती है।', 'Tutor conversations stay private — only their count is shown.')}
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-saffron-400" aria-hidden />
                {tx('हम आधार, फ़ोन नंबर या स्कूल ID नहीं माँगते।', 'We never ask for Aadhaar, phone numbers or school IDs.')}
              </li>
            </ul>
          </div>

          {/* Shape of the real guardian view, filled with made-up example numbers */}
          <div className="overflow-hidden rounded-lg border-2 border-ink-950 bg-white text-ink-950 shadow-brut-saffron">
            <div className="flex items-center justify-between border-b-2 border-ink-950 px-4 py-3">
              <p className="font-extrabold">{tx('अनु · कक्षा 9', 'Anu · Class 9')}</p>
              <span className="rounded-full border-[1.5px] border-ink-950 bg-lemon-300 px-2.5 py-0.5 text-xs font-bold">{tx('उदाहरण', 'Example')}</span>
            </div>
            <ul className="space-y-3 px-4 py-4 text-sm">
              {[
                [tx('संख्या पद्धति', 'Number systems'), 82],
                [tx('बहुपद', 'Polynomials'), 64],
                [tx('दो चरों वाले रैखिक समीकरण', 'Linear equations in two variables'), 31],
                [tx('त्रिभुज', 'Triangles'), 12],
              ].map(([name, v]) => (
                <li key={name as string}>
                  <div className="flex justify-between font-semibold">
                    <span>{name}</span>
                    <span className="tabular-nums">{v}%</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full border-[1.5px] border-ink-950">
                    <div className={`h-full ${(v as number) >= 70 ? 'bg-good-600' : (v as number) >= 40 ? 'bg-saffron-400' : 'bg-bad-600'}`} style={{ width: `${v}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t-2 border-ink-950 bg-lemon-100 px-4 py-3 text-sm">
              <span className="font-bold">{tx('अगला सुझाव: ', 'Suggested next: ')}</span>
              {tx('रैखिक समीकरण — पिछले 5 में से 3 उत्तर गलत, इसलिए आसान स्तर से दोहराएँ।', 'Linear equations — 3 of the last 5 answers were wrong, so revise from the easy level.')}
            </p>
          </div>
        </div>
      </section>

      {/* 7 ─ Privacy, accessibility, responsible AI */}
      <section>
        <div className="container-page py-14 md:py-20">
          <SectionHead label={tx('भरोसा', 'Trust')} title={tx('AI से गलती हो सकती है। हम यह छिपाते नहीं।', 'AI can make mistakes. We do not hide that.')} />
          <ul className="mt-10 grid gap-x-10 sm:grid-cols-2">
            {trust.map((t) => (
              <li key={t.t} className="flex gap-4 border-t-2 border-ink-950 py-5">
                <t.icon className="mt-1 h-6 w-6 shrink-0" aria-hidden />
                <div>
                  <h3 className="text-lg">{t.t}</h3>
                  <p className="mt-1 text-ink-800">{t.d}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            <Link to="/privacy" className="inline-flex min-h-[44px] items-center font-bold">{tx('गोपनीयता नीति', 'Privacy policy')}</Link>
            <span className="mx-3 text-ink-400">/</span>
            <Link to="/about" className="inline-flex min-h-[44px] items-center font-bold">{tx('AI का उपयोग', 'How AI is used')}</Link>
          </p>
        </div>
      </section>

      {/* 8 ─ Schools, NGOs, CSR */}
      <section className="border-t-2 border-ink-950 bg-white">
        <div className="container-page grid gap-8 py-14 md:grid-cols-[1.2fr_1fr] md:items-center md:py-16">
          <SectionHead label={tx('स्कूल, NGO और CSR', 'Schools, NGOs & CSR')} title={tx('अपने स्कूल या संस्था में आज़माइए।', 'Pilot it in your school or organisation.')}>
            <p>
              {tx(
                'शिक्षक जुड़े हुए सभी विद्यार्थियों की प्रगति एक जगह देख सकते हैं। यह अभी एक हैकथॉन प्रोटोटाइप है; हम सरकारी स्कूलों, NGO और CSR टीमों के साथ छोटे पायलट के लिए तैयार हैं।',
                'Teachers can follow all linked students in one place. This is a hackathon prototype today; we are open to small pilots with government schools, NGOs and CSR teams.',
              )}
            </p>
          </SectionHead>
          <div className="rounded-lg border-2 border-ink-950 bg-paper p-5 shadow-brut">
            <ul className="space-y-2 text-ink-900">
              <li>— {tx('शिक्षक खाता विद्यार्थियों को उनके कोड से जोड़ता है', 'A teacher account links students by their codes')}</li>
              <li>— {tx('साझा फ़ोन और कम डेटा के लिए बना', 'Built for shared phones and low data')}</li>
              <li>— {tx('कोई विज्ञापन नहीं, कोई डेटा बिक्री नहीं', 'No ads, no sale of data')}</li>
            </ul>
            <div className="mt-5">
              {CONTACT ? (
                <a href={`mailto:${CONTACT}?subject=GURUKUL%20AI%20pilot`} className="inline-flex min-h-[44px] items-center font-bold">
                  {tx('पायलट के लिए लिखें', 'Write to us about a pilot')} · {CONTACT}
                </a>
              ) : (
                <ButtonLink to="/register" variant="secondary">
                  {tx('शिक्षक खाता बनाएँ', 'Create a teacher account')}
                </ButtonLink>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 9 ─ Final CTA */}
      <section className="border-t-2 border-ink-950 bg-saffron-400">
        <div className="container-page flex flex-col gap-6 py-12 md:flex-row md:items-center md:justify-between md:py-16">
          <div>
            <h2 className="text-[1.7rem] leading-[1.2] sm:text-[2.1rem]">{tx('आज ही पहला पाठ पढ़िए।', 'Read your first lesson today.')}</h2>
            <p className="mt-2 text-ink-950">{tx('खाता बनाने में एक मिनट लगता है।', 'Creating an account takes a minute.')}</p>
          </div>
          <ButtonLink to={cta} size="lg" variant="secondary" className="shadow-brut">
            {ctaLabel}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
