import { pickIndianVoice } from '@/features/voice/useVoicePlayback';
import { useCallback, useEffect, useRef, useState } from 'react';

/* Minimal typings for the Web Speech API (not in lib.dom for all browsers) */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupport() {
  return {
    recognition: !!getRecognitionCtor(),
    recording: typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia,
    synthesis: typeof window !== 'undefined' && 'speechSynthesis' in window,
  };
}

/** Browser speech-to-text (Chrome/Edge on Android and desktop support hi-IN). */
const RECOG_LOCALE = { hi: 'hi-IN', en: 'en-IN', te: 'te-IN' } as const;

export function useSpeechRecognition(lang: 'hi' | 'en' | 'te') {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('unsupported');
      return;
    }
    setError(null);
    setInterim('');
    const rec = new Ctor();
    rec.lang = RECOG_LOCALE[lang];
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) setTranscript((t) => `${t} ${finalText}`.trim());
      setInterim(interimText);
    };
    rec.onerror = (e) => setError(e.error);
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    ref.current = rec;
    rec.start();
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => ref.current?.stop(), []);
  useEffect(() => () => ref.current?.abort(), []);

  return { listening, transcript, setTranscript, interim, error, start, stop };
}

/** Records audio for server-side transcription (fallback when browser STT is unavailable). */
export function useRecorder(maxSeconds = 60) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  const resolver = useRef<((b: Blob | null) => void) | null>(null);
  /** Recording that ended because it hit maxSeconds; the page picks it up and clears it. */
  const [autoStopped, setAutoStopped] = useState<Blob | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t));
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      resolver.current = null;
      setAutoStopped(null);
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = chunks.current.length ? new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }) : null;
        if (resolver.current) resolver.current(blob);
        else if (blob) setAutoStopped(blob);
        resolver.current = null;
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      timer.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= maxSeconds && mediaRef.current?.state === 'recording') {
            if (timer.current) window.clearInterval(timer.current);
            setRecording(false);
            mediaRef.current.stop();
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError('permission');
    }
  }, [maxSeconds]);

  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        resolver.current = resolve;
        if (timer.current) window.clearInterval(timer.current);
        setRecording(false);
        if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
        else resolve(null);
      }),
    [],
  );

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
  }, []);

  return { recording, seconds, error, start, stop, autoStopped, clearAutoStopped: () => setAutoStopped(null) };
}

/** Text-to-speech using the device's voices; picks a Hindi voice when available. */
export function useSpeak() {
  const [speaking, setSpeaking] = useState(false);
  const [hasHindiVoice, setHasHindiVoice] = useState<boolean | null>(null);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const check = () => setHasHindiVoice(window.speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith('hi')));
    check();
    window.speechSynthesis.addEventListener?.('voiceschanged', check);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', check);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string, lang: 'hi' | 'en') => {
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ''));
    const voice = pickIndianVoice(lang);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? (lang === 'hi' ? 'hi-IN' : 'en-IN');
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
    return true;
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, supported: 'speechSynthesis' in window, hasHindiVoice };
}
