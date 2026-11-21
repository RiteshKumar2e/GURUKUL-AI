import { useQuery } from '@tanstack/react-query';
import { useLang } from '@/context/LanguageContext';
import { useDocumentTitle, useHealth } from '@/hooks';
import { api } from '@/services/api';
import type { ContentMeta } from '@/types/api';
import { Badge, Skeleton } from '@/components/ui';

export default function About() {
  const { tx, formatDate } = useLang();
  useDocumentTitle(tx('सामग्री और AI', 'Content & AI'), tx('GURUKUL AI की सामग्री के स्रोत और AI के उपयोग की जानकारी।', 'Where GURUKUL AI content comes from and how AI is used.'));
  const meta = useQuery({ queryKey: ['content-sources'], queryFn: () => api<ContentMeta>('/curriculum/sources') });
  const health = useHealth();

  return (
    <article className="container-page max-w-3xl py-10 md:py-14">
      <h1 className="text-[1.75rem]">{tx('सामग्री कहाँ से आती है, और AI क्या करता है', 'Where the content comes from, and what the AI does')}</h1>

      <section className="mt-8">
        <h2 className="text-xl">{tx('पाठ और प्रश्न', 'Lessons and questions')}</h2>
        <p className="mt-2 text-ink-800">
          {tx(
            'सभी पाठ, उदाहरण और अभ्यास प्रश्न GURUKUL AI के लिए नए सिरे से लिखे गए मूल नमूना सामग्री हैं। ये किसी पाठ्यपुस्तक से कॉपी नहीं किए गए हैं और न ही JAC या NCERT द्वारा स्वीकृत हैं। ऐप में इन्हें "मूल नमूना पाठ" के रूप में चिह्नित किया गया है।',
            'All lessons, examples and practice questions are original sample material written for GURUKUL AI. They are not copied from any textbook and are not approved by JAC or NCERT. The app labels them "Original sample lesson".',
          )}
        </p>
        <p className="mt-2 text-ink-800">
          {tx('सामग्री backend/content/class9-maths.json में रखी है, ताकि शिक्षक उसे आसानी से सुधार सकें।', 'Content lives in backend/content/class9-maths.json so teachers can edit it easily.')}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">{tx('पाठ्यक्रम की जाँच', 'Curriculum check')}</h2>
        {meta.isLoading && <Skeleton className="mt-3 h-24" />}
        {meta.data && (
          <div className="panel mt-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="saffron">{tx('केवल द्वितीयक स्रोत', 'Secondary sources only')}</Badge>
              <span className="text-sm text-ink-600">
                {tx('जाँच की तारीख:', 'Checked on:')} {formatDate(meta.data.curriculumVerification.verifiedOn, { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <p className="mt-2 text-ink-800">
              {tx(
                'अध्यायों की सूची संशोधित NCERT कक्षा 9 गणित (12 अध्याय) पर आधारित है। कई स्रोत बताते हैं कि JAC इसे अपनाता है, पर विकास के दौरान JAC की आधिकारिक अधिसूचित पाठ्यक्रम फ़ाइल नहीं खुल सकी। इसलिए हम आधिकारिक मिलान का दावा नहीं करते।',
                'The chapter list follows the rationalised NCERT Class 9 Mathematics book (12 chapters). Several sources report that JAC follows it, but the official JAC notified syllabus file could not be opened during development, so we do not claim official alignment.',
              )}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {meta.data.curriculumVerification.sources.map((s) => (
                <li key={s} className="break-all">
                  {s.startsWith('http') ? (
                    <a href={s.split(' ')[0]} target="_blank" rel="noopener noreferrer">
                      {s}
                    </a>
                  ) : (
                    s
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl">{tx('AI का उपयोग', 'How AI is used')}</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-ink-800">
          <li>{tx('ट्यूटर के जवाब, फोटो से सवाल पढ़ना और आवाज़ को लिखित रूप देना एक बाहरी AI सेवा (Groq API, Llama और Whisper मॉडल) से होता है।', 'Tutor replies, reading questions from photos and turning speech into text use an external AI service (Groq API with Llama and Whisper models).')}</li>
          <li>{tx('AI गलती कर सकता है। संख्यात्मक उत्तर एक अलग कैलकुलेटर से जाँचे जाते हैं और परिणाम साफ़ दिखाया जाता है।', 'AI can be wrong. Numeric answers are re-checked with a separate calculator and the result is shown clearly.')}</li>
          <li>{tx('फोटो और आवाज़ की रिकॉर्डिंग प्रोसेस होते ही सर्वर से हटा दी जाती है।', 'Photos and voice recordings are deleted from the server as soon as they are processed.')}</li>
          <li>{tx('पढ़ने-बोलने की आवाज़ (टेक्स्ट-टू-स्पीच) आपके फ़ोन/ब्राउज़र की अपनी आवाज़ से चलती है।', 'Read-aloud (text-to-speech) uses your own phone or browser voice.')}</li>
        </ul>
        {health.data && (
          <p className="mt-3 text-sm text-ink-700">
            {tx('इस सर्वर की वर्तमान स्थिति:', 'Current status of this server:')}{' '}
            {health.data.ai.mode === 'live' ? (
              <Badge tone="good">
                {tx('AI चालू', 'AI live')} · {health.data.ai.model}
              </Badge>
            ) : (
              <Badge tone="saffron">{tx('डेमो मोड — AI जुड़ा नहीं', 'Demo mode — AI not connected')}</Badge>
            )}
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl">{tx('डेमो डेटा', 'Demo data')}</h2>
        <p className="mt-2 text-ink-800">
          {tx('डेमो खाते (demo.student, demo.parent, demo.teacher) और उनका इतिहास कंप्यूटर से बनाया गया नकली डेटा है। इसमें किसी असली विद्यार्थी की जानकारी नहीं है।', 'The demo accounts (demo.student, demo.parent, demo.teacher) and their history are computer-generated synthetic data. They contain no real student information.')}
        </p>
      </section>
    </article>
  );
}
