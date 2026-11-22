import { CircleHelp, Loader2, Pause, Play, RotateCcw, ShieldAlert, ShieldCheck, Square, Volume2 } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { deviceHasVoice, useVoicePlayback } from '@/features/voice/useVoicePlayback';
import type { TutorMessage, VoiceLang } from '@/types/api';
import { Badge } from '@/components/ui';

export function speakableText(m: TutorMessage) {
  const s = m.structured;
  if (!s) return m.content;
  // Same order as on screen
  return [s.reply, s.understanding, s.hint, s.explanation, ...s.steps.map((st) => `${st.title}. ${st.detail}`), s.finalAnswer, s.followUp].filter(Boolean).join('. ');
}

/** Play / pause / replay / stop for one reply. Shared by the tutor and voice pages. */
export function ReplyAudioControls({ text, lang, player }: { text: string; lang: VoiceLang; player: ReturnType<typeof useVoicePlayback> }) {
  const { tx } = useLang();
  const { state, play, pause, resume, stop, replay, supported } = player;
  if (!supported) return null;
  const btn = 'inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50';
  return (
    <span className="inline-flex items-center gap-0.5" role="group" aria-label={tx('आवाज़ नियंत्रण', 'Audio controls')}>
      {state === 'idle' || state === 'error' ? (
        <button type="button" className={btn} onClick={() => void play(text, lang)}>
          <Volume2 className="h-4 w-4" aria-hidden />
          {tx('सुनें', 'Listen')}
        </button>
      ) : state === 'loading' ? (
        <span className={btn} role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {tx('आवाज़ बन रही है…', 'Preparing audio…')}
        </span>
      ) : (
        <>
          {state === 'playing' ? (
            <button type="button" className={btn} onClick={pause} aria-label={tx('रोकें', 'Pause')}>
              <Pause className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button type="button" className={btn} onClick={resume} aria-label={tx('चलाएँ', 'Resume')}>
              <Play className="h-4 w-4" aria-hidden />
            </button>
          )}
          <button type="button" className={btn} onClick={replay} aria-label={tx('फिर से सुनें', 'Replay')}>
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className={btn} onClick={stop} aria-label={tx('बंद करें', 'Stop')}>
            <Square className="h-4 w-4" aria-hidden />
          </button>
        </>
      )}
    </span>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="mb-0.5 font-display text-sm font-bold text-ink-700">{children}</h3>;
}

// Hinglish is Hindi written in Roman letters; a Hindi voice pronounces its words the Indian way
const toVoiceLang = (l?: string): VoiceLang | null => (l === 'TE' ? 'te' : l === 'EN' ? 'en' : l === 'HI' || l === 'HG' ? 'hi' : null);

export function TutorReply({ message, onFollowUp, player: external }: { message: TutorMessage; onFollowUp?: (text: string) => void; player?: ReturnType<typeof useVoicePlayback> }) {
  const { tx, lang } = useLang();
  const own = useVoicePlayback();
  const player = external ?? own;
  const s = message.structured;
  const replyLang: VoiceLang = toVoiceLang(s?.language) ?? (lang === 'hg' ? 'hi' : lang);
  const missingVoice = !player.serverSpeech && deviceHasVoice(replyLang) === false;

  const speakButton = <ReplyAudioControls text={speakableText(message)} lang={replyLang} player={player} />;

  if (!s) {
    return (
      <div className="panel px-4 py-3">
        <p className="whitespace-pre-line">{message.content}</p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="space-y-3 px-4 py-3">
        {s.demo && <Badge tone="saffron">{tx('डेमो मोड — AI उत्तर नहीं', 'Demo mode — not an AI answer')}</Badge>}
        {s.outOfSyllabus && <Badge tone="saffron">{tx('आपकी कक्षा के पाठ्यक्रम से बाहर', 'Beyond your class syllabus')}</Badge>}
        {s.reply && <p className="text-ink-900">{s.reply}</p>}

        {s.understanding && (
          <section>
            <SectionTitle>{tx('प्रश्न की समझ', 'Understanding the question')}</SectionTitle>
            <p className="text-ink-900">{s.understanding}</p>
          </section>
        )}

        {s.hint && (
          <section className="rounded border-2 border-saffron-400 bg-saffron-50 px-3 py-2">
            <SectionTitle>{tx('पहला संकेत', 'First hint')}</SectionTitle>
            <p className="text-ink-900">{s.hint}</p>
          </section>
        )}

        {s.explanation && (
          <section>
            <SectionTitle>{tx('आसान व्याख्या', 'Simple explanation')}</SectionTitle>
            <p className="text-ink-900">{s.explanation}</p>
          </section>
        )}

        {s.steps.length > 0 && (
          <section>
          {!s.demo && <SectionTitle>{tx('चरण-दर-चरण हल', 'Step-by-step solution')}</SectionTitle>}
          <ol className="space-y-2">
            {s.steps.map((st, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">{i + 1}</span>
                <div className="min-w-0">
                  {/* Models often number their own titles ("1. ..."); the circle already shows it */}
                  {st.title && <p className="font-semibold text-ink-900">{st.title.replace(/^\s*(step\s*)?\d+\s*[.):-]\s*/i, '')}</p>}
                  <p className="break-words text-ink-800">{st.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          </section>
        )}

        {s.finalAnswer && (
          <section className="rounded-md border-2 border-ink-950 px-3 py-2">
            <SectionTitle>{tx('अंतिम उत्तर', 'Final answer')}</SectionTitle>
            <p className="font-semibold">{s.finalAnswer}</p>
          </section>
        )}

        {s.caveat && (
          <p className="flex gap-2 text-sm text-ink-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-saffron-600" aria-hidden />
            {s.caveat}
          </p>
        )}

        {s.followUp && (
          <div className="flex items-start gap-2 border-t border-line pt-3">
            <CircleHelp className="mt-1 h-4 w-4 shrink-0 text-ink-600" aria-hidden />
            <div>
              <SectionTitle>{tx('अब आप कोशिश करें', 'Now you try')}</SectionTitle>
              <p className="text-ink-900">{s.followUp}</p>
              {onFollowUp && (
                <button className="mt-1 text-sm font-semibold underline decoration-saffron-400 underline-offset-4" onClick={() => onFollowUp(s.followUp!)}>
                  {tx('इसका जवाब दूँ', 'Answer this')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper px-3 py-2 text-xs">
        {s.verification === 'verified' && !s.demo && (
          <Badge tone="good">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {tx('अंतिम संख्या कैलकुलेटर से मेल खाई', 'Final number matched a calculator')}
          </Badge>
        )}
        {s.verification === 'mismatch' && (
          <Badge tone="bad">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            {tx('कैलकुलेटर से मेल नहीं खाया', 'Did not match the calculator')}
          </Badge>
        )}
        {!s.demo && s.confidence !== 'high' && <Badge tone="saffron">{s.confidence === 'low' ? tx('कम भरोसा — ध्यान से जाँचें', 'Low confidence — check carefully') : tx('मध्यम भरोसा', 'Medium confidence')}</Badge>}
        <span className="ml-auto">{speakButton}</span>
      </div>
      {missingVoice && replyLang !== 'en' && (
        <p className="border-t border-line px-3 py-1.5 text-xs text-ink-600">
          {replyLang === 'te'
            ? tx('इस डिवाइस में तेलुगु आवाज़ नहीं मिली; पढ़कर सुनाना ठीक से काम नहीं कर सकता।', 'No Telugu voice on this device; read-aloud may not work well.')
            : tx('इस डिवाइस में हिंदी आवाज़ नहीं मिली; उच्चारण अंग्रेज़ी जैसा हो सकता है।', 'No Hindi voice on this device; pronunciation may sound English.')}
        </p>
      )}
      {player.error === 'server' && player.source === 'device' && (
        <p className="border-t border-line px-3 py-1.5 text-xs text-ink-600">{tx('सर्वर की आवाज़ नहीं मिली, इसलिए फ़ोन की आवाज़ से सुनाया जा रहा है।', 'Server voice was unavailable, so the device voice is used.')}</p>
      )}
    </div>
  );
}
