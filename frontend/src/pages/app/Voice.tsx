import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Keyboard, Mic, Square } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle, useHealth, useOnline } from '@/hooks';
import { speechSupport, useRecorder, useSpeechRecognition } from '@/hooks/useSpeech';
import { api, ApiError } from '@/services/api';
import { toWav16k } from '@/utils/audio';
import type { TutorMessage, VoiceLang } from '@/types/api';
import { Alert, Button, PageHeader, Segmented, Textarea } from '@/components/ui';
import { DemoModeNotice } from '@/components/common';
import { speakableText, TutorReply } from '@/features/tutor/TutorReply';
import { useAskTutor, type Intent } from '@/features/tutor/useTutor';
import { useVoiceCapabilities, useVoicePlayback } from '@/features/voice/useVoicePlayback';

type Phase = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'error';
interface Turn {
  id: string;
  question: string;
  lang: VoiceLang;
  reply: TutorMessage;
}

const LANG_LABEL: Record<VoiceLang, string> = { hi: 'हिंदी', en: 'English', te: 'తెలుగు' };
const TUTOR_LANG = { hi: 'HI', en: 'EN', te: 'TE' } as const;

export default function Voice() {
  const { tx, lang: uiLang } = useLang();
  const toast = useToast();
  const online = useOnline();
  const health = useHealth();
  const caps = useVoiceCapabilities();
  useDocumentTitle(tx('बोलकर पूछें', 'Ask by voice'));

  const [voiceLang, setVoiceLang] = useState<VoiceLang>(uiLang === 'hg' ? 'hi' : uiLang);
  const support = speechSupport();
  const maxSeconds = caps.data?.maxRecordingSeconds ?? 60;
  const recog = useSpeechRecognition(voiceLang);
  const recorder = useRecorder(maxSeconds);
  const player = useVoicePlayback();
  const ask = useAskTutor();

  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [intent, setIntent] = useState<Intent>('hint');
  const [autoAsk, setAutoAsk] = useState(false);
  const [autoRead, setAutoRead] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Server speech-to-text (Sarvam) is preferred for Telugu and when the browser has none.
  const serverStt = !!caps.data?.serverTranscription && support.recording;
  const method: 'server' | 'browser' | 'none' =
    serverStt && (caps.data?.sttProvider === 'sarvam' || !support.recognition) ? 'server' : support.recognition ? 'browser' : serverStt ? 'server' : 'none';

  const listening = recog.listening || recorder.recording;

  useEffect(() => {
    if (recog.transcript) setText(recog.transcript);
  }, [recog.transcript]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length]);

  // Switching language starts a fresh conversation in the new language
  useEffect(() => {
    setConversationId(undefined);
  }, [voiceLang]);

  const submit = async (content = text) => {
    const q = content.trim();
    if (!q) return;
    setPhase('thinking');
    setErrorMsg(null);
    player.stop();
    try {
      const res = await ask.mutateAsync({ conversationId, content: q, intent, mode: 'VOICE', language: TUTOR_LANG[voiceLang] });
      setConversationId(res.conversationId);
      setTurns((t) => [...t, { id: res.assistantMessage.id, question: q, lang: voiceLang, reply: res.assistantMessage }]);
      setText('');
      recog.setTranscript('');
      setPhase('idle');
      if (autoRead && !res.assistantMessage.structured?.demo) void player.play(speakableText(res.assistantMessage), voiceLang);
    } catch (e) {
      setPhase('error');
      setErrorMsg(e instanceof ApiError ? (e.isNetwork ? tx('इंटरनेट नहीं है।', 'No internet connection.') : e.message) : tx('भेजा नहीं जा सका।', 'Could not send.'));
    }
  };

  const transcribe = async (blob: Blob) => {
    setPhase('transcribing');
    try {
      let upload: Blob = blob;
      try {
        upload = await toWav16k(blob); // universal format for every STT provider
      } catch {
        /* send the original recording if the browser cannot decode it */
      }
      const form = new FormData();
      const ext = upload.type === 'audio/wav' ? 'wav' : upload.type.includes('mp4') ? 'm4a' : upload.type.includes('ogg') ? 'ogg' : 'webm';
      form.append('audio', upload, `question.${ext}`);
      const res = await api<{ text: string }>('/voice/transcribe', { form, query: { language: voiceLang } });
      if (!res.text) {
        setPhase('error');
        setErrorMsg(tx('कुछ सुनाई नहीं दिया। पास से और साफ़ बोलकर फिर कोशिश करें।', 'Nothing was heard. Speak closer and clearly, then try again.'));
        return;
      }
      const combined = `${text} ${res.text}`.trim();
      setText(combined);
      setPhase('idle');
      if (autoAsk) void submit(combined);
    } catch (e) {
      setPhase('error');
      setErrorMsg(e instanceof ApiError ? e.message : tx('रिकॉर्डिंग समझी नहीं जा सकी।', 'Could not process the recording.'));
    }
  };

  // Recording that hit the time limit
  useEffect(() => {
    if (recorder.autoStopped) {
      const b = recorder.autoStopped;
      recorder.clearAutoStopped();
      toast(tx(`${maxSeconds} सेकंड पूरे — रिकॉर्डिंग रोकी गई`, `${maxSeconds}s limit reached — recording stopped`), 'info');
      void transcribe(b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.autoStopped]);

  // Browser recognition finished: optionally ask right away
  useEffect(() => {
    if (!recog.listening && phase === 'recording' && method === 'browser') {
      setPhase('idle');
      if (autoAsk && recog.transcript.trim()) void submit(recog.transcript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recog.listening]);

  const toggleMic = async () => {
    setErrorMsg(null);
    player.stop();
    if (method === 'browser') {
      if (recog.listening) recog.stop();
      else {
        recog.setTranscript(text);
        recog.start();
        setPhase('recording');
      }
      return;
    }
    if (!recorder.recording) {
      await recorder.start();
      setPhase('recording');
      return;
    }
    const blob = await recorder.stop();
    if (blob) void transcribe(blob);
    else setPhase('idle');
  };

  const micError =
    recog.error === 'not-allowed' || recorder.error === 'permission'
      ? tx('माइक की अनुमति नहीं मिली। ब्राउज़र सेटिंग्स में माइक चालू करें, या नीचे लिखकर पूछें।', 'Microphone permission was denied. Allow it in browser settings, or type below.')
      : recog.error === 'no-speech'
        ? tx('कुछ सुनाई नहीं दिया। फिर से कोशिश करें।', 'No speech detected. Try again.')
        : recog.error === 'language-not-supported'
          ? tx('यह ब्राउज़र इस भाषा को नहीं पहचानता। लिखकर पूछें या Android पर Chrome इस्तेमाल करें।', 'This browser cannot recognise this language. Type instead, or use Chrome on Android.')
          : recog.error === 'network'
            ? tx('आवाज़ पहचानने के लिए इंटरनेट चाहिए।', 'Speech recognition needs internet.')
            : recog.error && recog.error !== 'aborted'
              ? tx('आवाज़ पहचानने में दिक्कत हुई। लिखकर पूछ सकते हैं।', 'Speech recognition had a problem. You can type instead.')
              : null;

  const status =
    phase === 'recording'
      ? recorder.recording
        ? tx(`सुन रहे हैं… ${recorder.seconds}/${maxSeconds} सेकंड`, `Listening… ${recorder.seconds}/${maxSeconds}s`)
        : tx('सुन रहे हैं… बोलिए', 'Listening… go ahead')
      : phase === 'transcribing'
        ? tx('आपकी आवाज़ को लिखा जा रहा है…', 'Turning your voice into text…')
        : phase === 'thinking'
          ? tx('ट्यूटर सोच रहा है…', 'The tutor is thinking…')
          : player.state === 'loading'
            ? tx('जवाब की आवाज़ तैयार हो रही है…', 'Preparing the spoken reply…')
            : player.state === 'playing'
              ? tx('जवाब सुनाया जा रहा है…', 'Reading the reply aloud…')
              : method === 'none'
                ? tx('नीचे सवाल लिखिए', 'Type your question below')
                : tx(`${LANG_LABEL[voiceLang]} में बोलने के लिए माइक दबाइए`, `Tap the mic to speak in ${LANG_LABEL[voiceLang]}`);

  const busy = phase === 'transcribing' || phase === 'thinking';

  return (
    <>
      <PageHeader
        title={tx('बोलकर पूछें', 'Ask by voice')}
        subtitle={tx('अपनी भाषा चुनिए, सवाल बोलिए, लिखे हुए शब्द जाँचिए, फिर जवाब सुनिए।', 'Pick your language, say your question, check the words, then listen to the answer.')}
      />

      <div className="mb-4 space-y-2">
        <DemoModeNotice mode={health.data?.ai.mode} />
        {!online && <Alert tone="warning">{tx('बोलकर पूछने के लिए इंटरनेट चाहिए। पहले सुने गए जवाब फिर से चलाए जा सकते हैं।', 'Asking by voice needs internet. Replies you already heard can be replayed.')}</Alert>}
        {method === 'none' && (
          <Alert tone="info" title={tx('इस ब्राउज़र में आवाज़ से पूछना उपलब्ध नहीं', 'Voice input is not available here')}>
            {tx('Android पर Chrome में यह सबसे अच्छा चलता है। तब तक नीचे सवाल लिखकर पूछ सकते हैं — जवाब फिर भी सुनाया जाएगा।', 'It works best in Chrome on Android. Meanwhile you can type below — the answer is still read aloud.')}
          </Alert>
        )}
        {micError && <Alert tone="error">{micError}</Alert>}
        {errorMsg && <Alert tone="error">{errorMsg}</Alert>}
      </div>

      <div className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label={tx('बोलने की भाषा', 'Speaking language')}
            value={voiceLang}
            onChange={(l) => {
              if (!listening && !busy) setVoiceLang(l);
            }}
            options={(['hi', 'en', 'te'] as const).map((l) => ({ value: l, label: LANG_LABEL[l] }))}
          />
          <span className="text-xs text-ink-600">
            {method === 'server' ? tx(`आवाज़ पहचान: सर्वर (${caps.data?.sttProvider})`, `Recognition: server (${caps.data?.sttProvider})`) : method === 'browser' ? tx('आवाज़ पहचान: ब्राउज़र', 'Recognition: browser') : tx('आवाज़ पहचान: उपलब्ध नहीं', 'Recognition: unavailable')}
            {' · '}
            {player.serverSpeech ? tx(`आवाज़: ${caps.data?.ttsProvider}`, `Voice: ${caps.data?.ttsProvider}`) : tx('आवाज़: फ़ोन की', 'Voice: device')}
          </span>
        </div>

        {method !== 'none' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <button
              type="button"
              onClick={() => void toggleMic()}
              disabled={!online || busy}
              className={`flex h-20 w-20 items-center justify-center rounded-full border-4 transition-colors disabled:opacity-50 ${listening ? 'border-bad-600 bg-bad-600 text-white' : 'border-saffron-200 bg-saffron-400 text-ink-950 hover:bg-saffron-500'}`}
              aria-pressed={listening}
              aria-label={listening ? tx('रिकॉर्डिंग रोकें', 'Stop recording') : tx('बोलना शुरू करें', 'Start speaking')}
            >
              {listening ? <Square className="h-8 w-8" /> : <Mic className="h-9 w-9" />}
            </button>
            {recorder.recording && (
              <div className="h-1 w-40 overflow-hidden rounded-full bg-ink-100" aria-hidden>
                <div className="h-full bg-bad-600 transition-all" style={{ width: `${(recorder.seconds / maxSeconds) * 100}%` }} />
              </div>
            )}
            {recog.interim && <p className="text-center text-ink-500">{recog.interim}</p>}
          </div>
        )}

        <p className={`mb-3 text-center text-sm font-semibold text-ink-800 ${method === 'none' ? 'mt-4' : ''}`} role="status" aria-live="polite">
          {status}
        </p>

        <Textarea
          id="voice-text"
          label={method === 'none' ? tx('अपना सवाल लिखें', 'Type your question') : tx('आपका सवाल (सुधार भी सकते हैं, या सीधे लिखें)', 'Your question (edit it, or just type)')}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={phase === 'transcribing'}
        />

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            label={tx('मुझे चाहिए', 'I want')}
            value={intent}
            onChange={setIntent}
            options={[
              { value: 'hint', label: tx('संकेत', 'Hint') },
              { value: 'solution', label: tx('पूरा हल', 'Solution') },
              { value: 'explain', label: tx('समझाएँ', 'Explain') },
            ]}
          />
          <Button onClick={() => void submit()} loading={phase === 'thinking'} disabled={!text.trim() || !online || listening || phase === 'transcribing'} icon={<Keyboard className="h-4 w-4" />}>
            {tx('ट्यूटर से पूछें', 'Ask the tutor')}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3 text-sm text-ink-800">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-ink-950" checked={autoAsk} onChange={(e) => setAutoAsk(e.target.checked)} />
            {tx('बोलना रुकते ही अपने-आप पूछें', 'Ask automatically when I stop speaking')}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-ink-950" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} />
            {tx('जवाब अपने-आप सुनाएँ', 'Read answers aloud automatically')}
          </label>
        </div>
      </div>

      {turns.length > 0 && (
        <section className="mt-8" aria-label={tx('बातचीत', 'Conversation')}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg">{tx('इस बार की बातचीत', 'This conversation')}</h2>
            {conversationId && (
              <Link to={`/app/tutor/${conversationId}`} className="text-sm font-semibold">
                {tx('ट्यूटर में खोलें', 'Open in tutor')}
              </Link>
            )}
          </div>
          <ol className="space-y-4">
            {turns.map((t, i) => (
              <li key={t.id} className="space-y-2">
                <div className="ml-auto w-fit max-w-[88%] rounded bg-ink-900 px-4 py-2.5 text-white">
                  <span className="mb-0.5 block text-xs text-ink-200">
                    {LANG_LABEL[t.lang]} · {tx('सवाल', 'Question')} {i + 1}
                  </span>
                  {t.question}
                </div>
                <TutorReply message={t.reply} player={i === turns.length - 1 ? player : undefined} />
              </li>
            ))}
          </ol>
          <div ref={bottomRef} />
        </section>
      )}
    </>
  );
}
