/**
 * Hindi versions of the API's error messages. The server answers in English; the student app is
 * Hindi-first, so the API client shows these whenever the interface language is Hindi.
 * Unknown messages fall back to a plain Hindi sentence chosen by HTTP status.
 */
const HI: Record<string, string> = {
  // auth and account
  'Username or password is incorrect.': 'यूज़रनेम या पासवर्ड गलत है।',
  'Sign in to continue.': 'आगे बढ़ने के लिए लॉग इन करें।',
  'Your session ended. Please sign in again.': 'आपका सत्र खत्म हो गया। कृपया फिर से लॉग इन करें।',
  'Your session has expired. Please sign in again.': 'आपका सत्र खत्म हो गया। कृपया फिर से लॉग इन करें।',
  'Your session has expired.': 'आपका सत्र खत्म हो गया।',
  'Current password is incorrect.': 'मौजूदा पासवर्ड गलत है।',
  'Password is incorrect.': 'पासवर्ड गलत है।',
  'Registration could not be completed.': 'खाता नहीं बन सका। कृपया फिर कोशिश करें।',
  'This username is already taken. Try another one.': 'यह यूज़रनेम पहले से लिया जा चुका है। कोई दूसरा चुनें।',
  'This email is already registered.': 'यह ईमेल पहले से पंजीकृत है।',
  'Please check the highlighted fields.': 'कृपया लाल रंग में दिखाए गए खाने जाँचें।',
  'Please accept the terms to continue': 'आगे बढ़ने के लिए नियम और शर्तें स्वीकार करें',
  'Email is required for parent and teacher accounts': 'अभिभावक और शिक्षक खाते के लिए ईमेल ज़रूरी है',
  'Password changed. Please sign in again on your other devices.': 'पासवर्ड बदल गया। अपने दूसरे फ़ोन या कंप्यूटर पर फिर से लॉग इन करें।',
  'Request body is not valid JSON.': 'अनुरोध सही रूप में नहीं भेजा गया। पेज दोबारा खोलकर कोशिश करें।',
  'Account not found.': 'खाता नहीं मिला।',
  'This feature is for student accounts.': 'यह सुविधा विद्यार्थी खाते के लिए है।',
  'This dashboard is for parent and teacher accounts.': 'यह डैशबोर्ड अभिभावक और शिक्षक खाते के लिए है।',
  'You do not have access to this.': 'आपको इसकी अनुमति नहीं है।',
  'This code did not match any student. Check it and try again.': 'यह कोड किसी विद्यार्थी से मेल नहीं खाया। कोड जाँचकर फिर कोशिश करें।',
  // learning
  'Please type a question.': 'कृपया अपना सवाल लिखें।',
  'Conversation not found.': 'यह बातचीत नहीं मिली।',
  'No practice questions are available for this topic yet.': 'इस विषय के अभ्यास प्रश्न अभी उपलब्ध नहीं हैं।',
  'Question not found.': 'प्रश्न नहीं मिला।',
  'Chapter not found.': 'अध्याय नहीं मिला।',
  'Topic not found.': 'विषय नहीं मिला।',
  'Quiz not found.': 'क्विज़ नहीं मिला।',
  'Quiz session not found.': 'क्विज़ नहीं मिला। कृपया फिर से शुरू करें।',
  'Session not found.': 'सत्र नहीं मिला।',
  'This quiz has already been submitted.': 'यह क्विज़ पहले ही जमा हो चुका है।',
  'Student not found.': 'विद्यार्थी नहीं मिला।',
  'Student profile not found.': 'विद्यार्थी प्रोफ़ाइल नहीं मिली।',
  // photo
  'Please attach a photo of the question.': 'कृपया सवाल की फोटो लगाएँ।',
  'Please upload a JPG, PNG or WebP image.': 'कृपया JPG, PNG या WebP फोटो ही लगाएँ।',
  'This file is not a valid JPG, PNG or WebP image.': 'यह फ़ाइल सही फोटो नहीं है। JPG, PNG या WebP फोटो लगाएँ।',
  'The photo is too large. Please retake it or crop it closer to the question.': 'फोटो बहुत बड़ी है। सवाल के पास से दोबारा फोटो लें।',
  'Could not read the photo right now. Please try again or type the question.': 'अभी फोटो पढ़ी नहीं जा सकी। फिर कोशिश करें या सवाल लिखकर भेजें।',
  'Reading photos needs the AI service, which is not configured on this server (demo mode). Please type the question instead.':
    'फोटो पढ़ने के लिए AI सेवा चाहिए, जो अभी चालू नहीं है (डेमो मोड)। कृपया सवाल लिखकर भेजें।',
  // voice
  'No recording was received.': 'रिकॉर्डिंग नहीं मिली। फिर से बोलकर देखें।',
  'Unsupported audio format.': 'यह रिकॉर्डिंग फ़ॉर्मेट समर्थित नहीं है।',
  'Nothing to read aloud.': 'सुनाने के लिए कुछ नहीं है।',
  'Could not understand the recording right now. Please try again or type your question.': 'अभी रिकॉर्डिंग समझी नहीं जा सकी। फिर कोशिश करें या सवाल लिखें।',
  'Server speech-to-text is not configured. Use the browser microphone or type your question.': 'सर्वर पर आवाज़ पहचान चालू नहीं है। फ़ोन के माइक से बोलें या सवाल लिखें।',
  'Could not create the audio right now. The app will use the device voice instead.': 'अभी आवाज़ नहीं बन सकी। फ़ोन की आवाज़ से सुनाया जाएगा।',
  'Server text-to-speech is not configured. The app will use the device voice instead.': 'सर्वर की आवाज़ चालू नहीं है। फ़ोन की आवाज़ से सुनाया जाएगा।',
  // limits and failures
  'Too many requests. Please wait a minute.': 'बहुत ज़्यादा अनुरोध हुए। एक मिनट रुककर फिर कोशिश करें।',
  'Too many sign-in attempts. Please try again in 15 minutes.': 'लॉग इन की बहुत कोशिशें हुईं। 15 मिनट बाद फिर कोशिश करें।',
  'You are asking very fast. Take a breath and try again in a minute.': 'आप बहुत जल्दी-जल्दी पूछ रहे हैं। एक मिनट रुककर फिर पूछें।',
  'Too many read-aloud requests. Please wait a minute.': 'बहुत बार सुनाने का अनुरोध हुआ। एक मिनट रुकें।',
  'The database is not reachable right now. Please try again shortly.': 'सर्वर अभी जवाब नहीं दे रहा। थोड़ी देर बाद फिर कोशिश करें।',
  'Something went wrong on our side. Please try again.': 'हमारी तरफ़ से कुछ गड़बड़ हुई। कृपया फिर कोशिश करें।',
  'Something went wrong.': 'कुछ गड़बड़ हुई। कृपया फिर कोशिश करें।',
  'Could not reach the server.': 'सर्वर से संपर्क नहीं हो पाया। इंटरनेट जाँचकर फिर कोशिश करें।',
  'You are offline.': 'आप ऑफ़लाइन हैं। इंटरनेट आने पर फिर कोशिश करें।',
  'Upload failed.': 'फ़ाइल अपलोड नहीं हो सकी।',
  'This already exists.': 'यह पहले से मौजूद है।',
  'A referenced item does not exist.': 'जिस चीज़ का ज़िक्र है वह मौजूद नहीं है।',
};

function byStatus(status: number): string {
  if (status === 0) return HI['Could not reach the server.'];
  if (status === 401) return 'कृपया फिर से लॉग इन करें।';
  if (status === 403) return HI['You do not have access to this.'];
  if (status === 404) return 'यह चीज़ नहीं मिली।';
  if (status === 409) return HI['This already exists.'];
  if (status === 413) return 'फ़ाइल बहुत बड़ी है।';
  if (status === 429) return HI['Too many requests. Please wait a minute.'];
  if (status >= 500) return 'सेवा अभी उपलब्ध नहीं है। थोड़ी देर बाद फिर कोशिश करें।';
  return 'यह अनुरोध पूरा नहीं हो सका। जानकारी जाँचकर फिर कोशिश करें।';
}

/** Returns the message in the interface language. `message` is the server's English text. */
export function localiseError(message: string, status: number, lang: string = currentLang()): string {
  if (lang !== 'hi') return message;
  if (/[ऀ-ॿఀ-౿]/.test(message)) return message; // already Hindi or Telugu
  const exact = HI[message];
  if (exact) return exact;
  const size = message.match(/^File is too large \(max (\d+) MB\)\.$/);
  if (size) return `फ़ाइल बहुत बड़ी है (ज़्यादा से ज़्यादा ${size[1]} MB)।`;
  return byStatus(status);
}

function currentLang() {
  try {
    return document.documentElement.lang || 'hi';
  } catch {
    return 'hi';
  }
}
