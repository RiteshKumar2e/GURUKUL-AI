import { useLang } from '@/context/LanguageContext';
import { useDocumentTitle } from '@/hooks';

const UPDATED = '21 November 2026';

export default function Privacy() {
  const { tx, lang } = useLang();
  useDocumentTitle(tx('गोपनीयता नीति', 'Privacy policy'), tx('GURUKUL AI कौन-सी जानकारी लेता है और उसका उपयोग कैसे होता है।', 'What GURUKUL AI collects and how it is used.'));

  const sections: Array<[string, string, string[], string[]]> = [
    [
      'हम क्या जानकारी लेते हैं',
      'What we collect',
      [
        'विद्यार्थी: नाम (पहला नाम काफ़ी है), यूज़रनेम, पासवर्ड (सुरक्षित हैश के रूप में), कक्षा, और वैकल्पिक रूप से ज़िला।',
        'अभिभावक/शिक्षक: नाम, यूज़रनेम, ईमेल, और शिक्षक के लिए वैकल्पिक विद्यालय का नाम।',
        'पढ़ाई का डेटा: आपके उत्तर, पढ़े गए पाठ, क्विज़ के अंक और ट्यूटर से की गई बातचीत।',
      ],
      [
        'Students: a name (a first name is enough), username, password (stored as a secure hash), class and, optionally, district.',
        'Parents/teachers: name, username, email and, for teachers, an optional school name.',
        'Learning data: your answers, lessons read, quiz scores and tutor conversations.',
      ],
    ],
    [
      'हम क्या नहीं लेते',
      'What we never collect',
      ['आधार नंबर, फ़ोन नंबर, घर का पता, जन्मतिथि, फोटो पहचान पत्र या स्कूल ID।', 'हम आपका डेटा बेचते नहीं हैं और विज्ञापन नहीं दिखाते।'],
      ['Aadhaar numbers, phone numbers, home addresses, dates of birth, photo IDs or school IDs.', 'We do not sell your data and we do not show ads.'],
    ],
    [
      'फोटो और आवाज़',
      'Photos and voice',
      [
        'फोटो से सवाल पढ़ने और आवाज़ को लिखने के लिए फ़ाइल हमारे सर्वर से होकर AI सेवा (Groq) को भेजी जाती है और प्रोसेस होते ही हमारे सर्वर से हटा दी जाती है।',
        'फोटो में अपना नाम, चेहरा या कोई निजी जानकारी न आने दें।',
      ],
      ['To read a photo or transcribe speech, the file passes through our server to the AI service (Groq) and is deleted from our server as soon as it is processed.', 'Please keep your name, face and other personal details out of photos.'],
    ],
    [
      'AI सेवा',
      'AI service',
      [
        'ट्यूटर के लिए आपका सवाल और बातचीत का हाल का हिस्सा Groq API को भेजा जाता है। इसमें आपका नाम या यूज़रनेम नहीं भेजा जाता।',
        'Groq की अपनी डेटा नीति लागू होती है: https://groq.com/privacy-policy',
      ],
      ['For the tutor, your question and the recent part of the conversation are sent to the Groq API. Your name and username are not sent.', "Groq's own data policy applies: https://groq.com/privacy-policy"],
    ],
    [
      'कौन देख सकता है',
      'Who can see your data',
      [
        'विद्यार्थी का डेटा केवल वही विद्यार्थी देख सकता है, और वे अभिभावक/शिक्षक जिन्हें विद्यार्थी ने अपना लिंक कोड दिया है।',
        'अभिभावक/शिक्षक प्रगति, कमज़ोर विषय और गतिविधि देखते हैं; ट्यूटर बातचीत की सामग्री नहीं।',
        'विद्यार्थी सेटिंग्स से कोड बदलकर नए लोगों को जुड़ने से रोक सकता है।',
      ],
      [
        "A student's data is visible only to that student and to parents/teachers the student gave their link code to.",
        'Parents/teachers see progress, weak topics and activity — not the content of tutor conversations.',
        'A student can change the code in settings to stop new people from linking.',
      ],
    ],
    [
      'कुकी और विश्लेषण',
      'Cookies and analytics',
      [
        'हम केवल एक ज़रूरी कुकी (gk_rt) रखते हैं जो आपको लॉग-इन रखती है।',
        'अनुमति देने पर हम गुमनाम पेज-गिनती रखते हैं: केवल पेज का पता, भाषा और समय। कोई यूज़र ID, IP पता या डिवाइस जानकारी नहीं।',
        'ऑफ़लाइन पढ़ाई के लिए डाउनलोड किए अध्याय और न भेजे गए उत्तर आपके ही फ़ोन में (IndexedDB) रहते हैं और लॉग आउट पर हटा दिए जाते हैं।',
      ],
      [
        'We use one essential cookie (gk_rt) that keeps you signed in.',
        'If you allow it, we count anonymous page views: only the page path, language and time. No user ID, IP address or device details.',
        'Chapters downloaded for offline study and unsent answers stay on your own phone (IndexedDB) and the unsent answers are cleared when you log out.',
      ],
    ],
    [
      'आपके अधिकार',
      'Your choices',
      ['सेटिंग्स से आप अपना नाम और भाषा बदल सकते हैं, और अपना खाता व सारा पढ़ाई डेटा हमेशा के लिए मिटा सकते हैं।'],
      ['In settings you can change your name and language, and permanently delete your account and all learning data.'],
    ],
  ];

  return (
    <article className="container-page max-w-3xl py-10 md:py-14">
      <h1 className="text-[1.75rem]">{tx('गोपनीयता नीति', 'Privacy policy')}</h1>
      <p className="mt-1 text-sm text-ink-600">
        {tx('अंतिम बदलाव:', 'Last updated:')} {UPDATED}
      </p>
      <p className="mt-4 text-ink-800">
        {tx(
          'GURUKUL AI स्कूली विद्यार्थियों के लिए है, जिनमें से अधिकतर 18 वर्ष से कम हैं। इसलिए हम कम से कम जानकारी लेते हैं और उसे सुरक्षित रखते हैं। यह एक हैकाथॉन प्रोटोटाइप है; सार्वजनिक उपयोग से पहले इस नीति की कानूनी समीक्षा (जैसे DPDP अधिनियम 2023) आवश्यक है।',
          'GURUKUL AI is for school students, most of whom are under 18, so we collect as little as possible and keep it safe. This is a hackathon prototype; this policy needs legal review (for example against India’s DPDP Act 2023) before public use.',
        )}
      </p>
      {sections.map(([hHi, hEn, hi, en]) => (
        <section key={hEn} className="mt-7">
          <h2 className="text-xl">{tx(hHi, hEn)}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-800">
            {(lang === 'hi' ? hi : en).map((line) => (
              <li key={line} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
