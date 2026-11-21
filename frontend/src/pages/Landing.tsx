import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Check, Mic, PenLine } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { homePathFor, useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks';
import { ButtonLink } from '@/components/ui';
import { CHAPTERS } from '@/lib/constants';

/** A worked example the visitor can step through. Static content, labelled as such. */
function SampleExchange() {
  const { tx } = useLang();
  const [step, setStep] = useState(0);
  const steps = [
    { label: tx('संकेत', 'Hint'), text: tx('x को अकेला करना है। पहले +5 को बराबर के दूसरी ओर ले जाइए — वहाँ उसका चिह्न बदल जाएगा।', 'Get x on its own. First move +5 to the other side of the equals sign — its sign flips.') },
    { label: tx('कदम 2', 'Step 2'), text: tx('2x = −5। अब दोनों ओर 2 से भाग दीजिए।', '2x = −5. Now divide both sides by 2.') },
    { label: tx('उत्तर', 'Answer'), text: tx('x = −5/2 = −2.5। जाँच: 2(−2.5) + 5 = 0 ✓', 'x = −5/2 = −2.5. Check: 2(−2.5) + 5 = 0 ✓') },
  ];
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="text-sm font-semibold text-ink-800">{tx('ऐसे सीखते हैं', 'How a doubt gets solved')}</p>
        <span className="text-xs text-ink-500">{tx('उदाहरण', 'Example')}</span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="ml-auto max-w-[85%] rounded bg-ink-900 px-3 py-2 text-white">
          <p className="text-[0.95rem]">{tx('2x + 5 = 0 का हल कैसे निकालें?', 'How do I solve 2x + 5 = 0?')}</p>
        </div>
        {steps.slice(0, step + 1).map((s, i) => (
          <div key={i} className="max-w-[92%] rounded border border-line bg-paper px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-saffron-700">{s.label}</p>
            <p className="text-[0.95rem] text-ink-900">{s.text}</p>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          {step < steps.length - 1 ? (
            <button className="text-sm font-semibold text-ink-900 underline decoration-saffron-400 decoration-2 underline-offset-4" onClick={() => setStep((s) => s + 1)}>
              {step === 0 ? tx('अटक गए? अगला कदम', 'Still stuck? Next step') : tx('उत्तर दिखाएँ', 'Show the answer')}
            </button>
          ) : (
            <button className="text-sm font-semibold text-ink-700 underline underline-offset-4" onClick={() => setStep(0)}>
              {tx('फिर से देखें', 'Replay')}
            </button>
          )}
          <span className="text-xs text-ink-500">{step + 1}/3</span>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { tx, lang } = useLang();
  const { user } = useAuth();
  useDocumentTitle(
    tx('कक्षा 9 गणित, अपनी भाषा में', 'Class 9 maths, in your language'),
    tx(
      'GURUKUL AI झारखंड के कक्षा 9 के विद्यार्थियों के लिए हिंदी में गणित सीखने का साथी है। संकेत पहले, फिर हल।',
      'GURUKUL AI is a Hindi-first maths companion for Class 9 students in Jharkhand. Hints before answers.',
    ),
  );
  const cta = user ? homePathFor(user) : '/register';
  const ctaLabel = user ? tx('पढ़ाई जारी रखें', 'Continue learning') : tx('मुफ़्त में शुरू करें', 'Start learning free');

  return (
    <>
      <section className="graph-paper border-b border-line">
        <div className="container-page grid items-center gap-10 py-12 md:grid-cols-[1.15fr_1fr] md:py-20">
          <div>
            <p className="eyebrow mb-3">{tx('JAC · कक्षा 9 · गणित', 'JAC · Class 9 · Mathematics')}</p>
            <h1 className="text-[2rem] leading-tight sm:text-[2.4rem]">
              {lang === 'hi' ? (
                <>
                  गणित का हर सवाल,
                  <br />
                  अपनी भाषा में समझिए।
                </>
              ) : (
                <>
                  Understand every maths question,
                  <br />
                  in your own language.
                </>
              )}
            </h1>
            <p className="mt-4 max-w-xl text-[1.08rem] text-ink-700">
              {tx(
                'GURUKUL AI हिंदी में, कदम-दर-कदम समझाता है — पहले संकेत, फिर हल। सवाल बोलकर, लिखकर या कॉपी की फोटो खींचकर पूछिए। इंटरनेट न हो, तब भी अभ्यास चलता रहता है।',
                'GURUKUL AI explains step by step in Hindi — a hint first, then the solution. Ask by speaking, typing or taking a photo of your notebook. Practice keeps working even without internet.',
              )}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink to={cta} size="lg">
                {ctaLabel}
              </ButtonLink>
              {!user && (
                <p className="text-[0.95rem] text-ink-700">
                  {tx('पहले से खाता है?', 'Already have an account?')} <Link to="/login">{tx('लॉग इन करें', 'Log in')}</Link>
                </p>
              )}
            </div>
          </div>
          <SampleExchange />
        </div>
      </section>

      <section id="how" className="container-page scroll-mt-20 py-14">
        <h2 className="text-[1.5rem]">{tx('तीन तरीके से पूछिए, एक तरीके से सीखिए', 'Three ways to ask, one way to learn')}</h2>
        <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-3">
          {[
            { icon: PenLine, hi: 'लिखकर', en: 'Type it', dhi: 'अपना सवाल या अपनी कोशिश लिखिए। ट्यूटर बताएगा कि गलती कहाँ है।', den: 'Type your question or your own working. The tutor shows exactly where it goes wrong.' },
            { icon: Mic, hi: 'बोलकर', en: 'Say it', dhi: 'हिंदी में बोलकर पूछिए और जवाब सुनिए — जिन फ़ोन में हिंदी आवाज़ है, उनमें।', den: 'Ask aloud in Hindi and hear the reply — on phones that have a Hindi voice.' },
            { icon: Camera, hi: 'फोटो से', en: 'Snap it', dhi: 'किताब या कॉपी के सवाल की फोटो लीजिए। पढ़ा गया सवाल आप पहले जाँच और सुधार सकते हैं।', den: 'Photograph a question from your book or notebook. You check and correct the extracted text first.' },
          ].map((f) => (
            <div key={f.en} className="border-t-2 border-ink-900 pt-4">
              <f.icon className="h-6 w-6 text-saffron-600" aria-hidden />
              <h3 className="mt-2 text-lg">{tx(f.hi, f.en)}</h3>
              <p className="mt-1 text-ink-700">{tx(f.dhi, f.den)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="container-page grid gap-10 py-14 md:grid-cols-2">
          <div>
            <h2 className="text-[1.5rem]">{tx('आख़िरी छोर के विद्यार्थी के लिए बना', 'Built for the student at the last mile')}</h2>
            <p className="mt-3 text-ink-700">
              {tx(
                'बहुत से विद्यार्थियों के पास सस्ता फ़ोन, कमज़ोर नेटवर्क और घर पर पूछने वाला कोई नहीं होता। GURUKUL AI इन्हीं हालात को ध्यान में रखकर बनाया गया है।',
                'Many students have a low-cost phone, a weak network and no one at home to ask. GURUKUL AI is designed around exactly those conditions.',
              )}
            </p>
          </div>
          <ul className="space-y-3">
            {[
              ['पूरा अध्याय डाउनलोड करके बिना इंटरनेट पढ़िए और अभ्यास कीजिए। नेटवर्क लौटते ही प्रगति अपने-आप सर्वर पर पहुँचती है।', 'Download a chapter to read and practise offline. Progress syncs automatically when the network returns.'],
              ['फोटो भेजने से पहले फ़ोन पर ही छोटी कर दी जाती है, ताकि डेटा कम लगे।', 'Photos are shrunk on the phone before upload, so they use less data.'],
              ['अभ्यास आपके उत्तरों के हिसाब से आसान या कठिन होता है, और कमज़ोर विषय पहले सामने आते हैं।', 'Practice gets easier or harder based on your answers, and weak topics come up first.'],
              ['हिंदी पहले, अंग्रेज़ी एक टैप पर। गणित के शब्द दोनों भाषाओं में।', 'Hindi first, English one tap away. Maths terms in both languages.'],
            ].map(([hi, en]) => (
              <li key={en} className="flex gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-good-600" aria-hidden />
                <span className="text-ink-800">{tx(hi, en)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-[1.5rem]">{tx('कक्षा 9 गणित के 12 अध्याय', 'All 12 chapters of Class 9 maths')}</h2>
            <p className="mt-3 text-ink-700">
              {tx(
                'हर अध्याय में छोटे पाठ, हल किए उदाहरण, तीन स्तर के अभ्यास प्रश्न और एक अध्याय परीक्षा है। सारी सामग्री इस परियोजना के लिए नए सिरे से लिखी गई है।',
                'Each chapter has short lessons, worked examples, practice at three levels and a chapter quiz. All content was written fresh for this project.',
              )}
            </p>
            <p className="mt-3 text-sm text-ink-600">
              {tx('अध्यायों की सूची NCERT कक्षा 9 (संशोधित) पुस्तक पर आधारित है, जिसे JAC अपनाता है।', 'The chapter list follows the rationalised NCERT Class 9 book, which JAC follows.')}{' '}
              <Link to="/about">{tx('स्रोत देखें', 'See sources')}</Link>
            </p>
          </div>
          <ol className="grid gap-x-6 sm:grid-cols-2">
            {CHAPTERS.map((c) => (
              <li key={c.n} className="flex gap-3 border-b border-line py-2.5">
                <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-saffron-700">{c.n}</span>
                <span className="text-ink-900">{tx(c.hi, c.en)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="guardians" className="scroll-mt-20 border-y border-line bg-ink-900 text-ink-50">
        <div className="container-page grid gap-8 py-14 md:grid-cols-2">
          <div>
            <h2 className="text-[1.5rem] text-white">{tx('अभिभावक और शिक्षक साथ रहें', 'Keep parents and teachers in the loop')}</h2>
            <p className="mt-3 text-ink-100">
              {tx(
                'विद्यार्थी अपनी सेटिंग्स से 6 अक्षरों का कोड साझा करता है। उससे जुड़कर आप अध्याय-वार प्रगति, कमज़ोर विषय और हाल की पढ़ाई देख सकते हैं।',
                'The student shares a 6-letter code from their settings. Once linked, you can see chapter-wise progress, weak topics and recent study.',
              )}
            </p>
          </div>
          <ul className="space-y-3 text-ink-100">
            <li className="flex gap-3">
              <Check className="mt-1 h-5 w-5 shrink-0 text-saffron-400" aria-hidden />
              {tx('केवल वही अभिभावक/शिक्षक देख सकते हैं जिन्हें विद्यार्थी ने कोड दिया है।', 'Only parents or teachers the student gave a code to can see anything.')}
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 h-5 w-5 shrink-0 text-saffron-400" aria-hidden />
              {tx('ट्यूटर से हुई बातचीत निजी रहती है — अभिभावक को केवल उसकी संख्या दिखती है।', 'Tutor conversations stay private — guardians only see how many there were.')}
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 h-5 w-5 shrink-0 text-saffron-400" aria-hidden />
              {tx('हम आधार, फ़ोन नंबर या स्कूल ID नहीं माँगते।', 'We never ask for Aadhaar, phone numbers or school IDs.')}
            </li>
          </ul>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <h2 className="text-[1.5rem]">{tx('AI से गलती हो सकती है। हम यह छिपाते नहीं।', 'AI can make mistakes. We do not hide that.')}</h2>
            <p className="mt-3 text-ink-700">
              {tx(
                'जब ट्यूटर कोई संख्यात्मक उत्तर देता है, ऐप उसे अलग से कैलकुलेटर से जाँचता है और साफ़ बताता है कि उत्तर मेल खाया या नहीं। अनिश्चित उत्तरों पर चेतावनी दिखती है, और AI की लिखी बातें कभी आधिकारिक पाठ्यपुस्तक बताकर नहीं दिखाई जातीं।',
                'When the tutor gives a numeric answer, the app re-checks it with a separate calculator and says clearly whether it matched. Uncertain answers carry a warning, and AI text is never presented as official textbook material.',
              )}
            </p>
          </div>
          <div className="panel p-5">
            <p className="font-semibold">{tx('आज ही पहला पाठ पढ़िए', 'Read your first lesson today')}</p>
            <p className="mt-1 text-sm text-ink-700">{tx('खाता बनाने में एक मिनट लगता है। ईमेल ज़रूरी नहीं।', 'Creating an account takes a minute. No email needed for students.')}</p>
            <ButtonLink to={cta} className="mt-4 w-full">
              {ctaLabel}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
