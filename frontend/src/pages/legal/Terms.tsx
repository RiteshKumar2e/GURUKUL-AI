import { Link } from 'react-router-dom';
import { useLang } from '@/context/LanguageContext';
import { useDocumentTitle } from '@/hooks';

export default function Terms() {
  const { tx, lang } = useLang();
  useDocumentTitle(tx('नियम और शर्तें', 'Terms & conditions'), tx('GURUKUL AI के उपयोग के नियम।', 'Terms for using GURUKUL AI.'));

  const items: Array<[string, string, string, string]> = [
    ['यह क्या है', 'What this is', 'GURUKUL AI ACE Builders Global Hackathon 2026 के लिए बनाया गया एक शैक्षिक प्रोटोटाइप है। यह स्कूल, शिक्षक या आधिकारिक पाठ्यपुस्तक का विकल्प नहीं है।', 'GURUKUL AI is an educational prototype built for ACE Builders Global Hackathon 2026. It does not replace school, teachers or official textbooks.'],
    ['AI के उत्तर', 'AI answers', 'AI ट्यूटर के उत्तर गलत या अधूरे हो सकते हैं। परीक्षा या गृहकार्य के लिए उत्तर अपनी पाठ्यपुस्तक या शिक्षक से जाँच लें। "कैलकुलेटर से जाँचा गया" का अर्थ केवल इतना है कि अंतिम संख्या एक अलग गणना से मेल खाती है, पूरी व्याख्या सही होने की गारंटी नहीं।', 'AI tutor answers can be wrong or incomplete. Check answers against your textbook or teacher before relying on them for exams or homework. "Checked by calculator" only means the final number matched a separate calculation, not that the whole explanation is correct.'],
    ['सामग्री', 'Content', 'ऐप के पाठ और प्रश्न मूल नमूना सामग्री हैं और JAC या NCERT द्वारा स्वीकृत नहीं हैं।', 'Lessons and questions in the app are original sample content and are not approved by JAC or NCERT.'],
    ['खाते', 'Accounts', '18 वर्ष से कम विद्यार्थी अभिभावक या संरक्षक की अनुमति से ही खाता बनाएँ। अपना पासवर्ड किसी से साझा न करें। हर व्यक्ति अपना अलग खाता रखे।', 'Students under 18 should sign up only with a parent or guardian’s permission. Do not share your password. Each person should have their own account.'],
    ['सही उपयोग', 'Acceptable use', 'ऐप का उपयोग केवल पढ़ाई के लिए करें। अपमानजनक, हानिकारक या निजी जानकारी वाली सामग्री न भेजें। सेवा को नुकसान पहुँचाने या दूसरों के डेटा तक पहुँचने की कोशिश न करें।', 'Use the app for learning only. Do not send abusive, harmful or personal content. Do not try to disrupt the service or access other people’s data.'],
    ['उपलब्धता', 'Availability', 'प्रोटोटाइप होने के कारण सेवा कभी भी बदल या बंद हो सकती है। ऑफ़लाइन डेटा आपके डिवाइस पर रहता है; ब्राउज़र डेटा मिटाने पर वह हट सकता है।', 'As a prototype, the service may change or stop at any time. Offline data lives on your device and may be removed if you clear browser data.'],
    ['स्वामित्व और लाइसेंस', 'Ownership and licence', 'इस परियोजना का लाइसेंस और स्वामित्व हैकाथॉन आयोजकों की अंतिम शर्तों की समीक्षा के बाद तय किया जाएगा। तीसरे पक्ष के सॉफ़्टवेयर और फ़ॉन्ट अपने-अपने लाइसेंस के अधीन हैं।', 'The project’s licence and ownership will be decided after reviewing the hackathon organisers’ final terms. Third-party software and fonts remain under their own licences.'],
  ];

  return (
    <article className="container-page max-w-3xl py-10 md:py-14">
      <h1 className="text-[1.75rem]">{tx('नियम और शर्तें', 'Terms & conditions')}</h1>
      <p className="mt-1 text-sm text-ink-600">{tx('अंतिम बदलाव: 21 नवंबर 2026', 'Last updated: 21 November 2026')}</p>
      {items.map(([hHi, hEn, bHi, bEn]) => (
        <section key={hEn} className="mt-7">
          <h2 className="text-xl">{lang === 'hi' ? hHi : hEn}</h2>
          <p className="mt-2 text-ink-800">{lang === 'hi' ? bHi : bEn}</p>
        </section>
      ))}
      <p className="mt-8 text-ink-800">
        {tx('डेटा के बारे में जानने के लिए ', 'For how data is handled, read the ')}
        <Link to="/privacy">{tx('गोपनीयता नीति', 'privacy policy')}</Link>
        {tx(' पढ़ें।', '.')}
      </p>
    </article>
  );
}
