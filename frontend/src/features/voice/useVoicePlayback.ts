import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, apiBlob } from '@/services/api';
import { offlineDb } from '@/lib/offlineDb';
import { audioCacheKey } from '@/utils/audio';
import type { VoiceCapabilities, VoiceLang } from '@/types/api';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

const LOCALE: Record<VoiceLang, string> = { hi: 'hi-IN', en: 'en-IN', te: 'te-IN' };

export function useVoiceCapabilities() {
  return useQuery({ queryKey: ['voice-caps'], queryFn: () => api<VoiceCapabilities>('/voice/capabilities'), staleTime: 10 * 60_000, retry: 1 });
}

/** Names of Indian voices shipped by Windows, macOS/iOS, Android and Chrome. */
const INDIAN_NAMES = /india|indian|hindi|heera|kalpana|hemant|swara|madhur|neerja|prabhat|ravi|rishi|veena|lekha|sangeeta|aarav|aditi|kajal|ananya/i;
/** Neural/online voices sound far more natural than the old offline ones. */
const quality = (v: SpeechSynthesisVoice) => (/natural|neural|online|google|premium|enhanced/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);

/**
 * The most natural Indian voice on this device for the language, never a US or UK one when an
 * Indian voice exists. Order: exact Indian locale (hi-IN, en-IN, te-IN), then any voice with an
 * Indian name, then (for English) a Hindi voice, which reads English with an Indian accent.
 */
export function pickIndianVoice(lang: VoiceLang, voices: SpeechSynthesisVoice[] = 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []): SpeechSynthesisVoice | null {
  const best = (list: SpeechSynthesisVoice[]) => list.sort((a, b) => quality(b) - quality(a))[0] ?? null;
  const locale = (l: string) => (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-') === l.toLowerCase();
  return (
    best(voices.filter(locale(LOCALE[lang]))) ??
    best(voices.filter((v) => v.lang.toLowerCase().startsWith(lang) && INDIAN_NAMES.test(v.name))) ??
    (lang === 'en' ? best(voices.filter(locale('hi-IN'))) : null) ??
    best(voices.filter((v) => v.lang.toLowerCase().startsWith(lang)))
  );
}

export function deviceHasVoice(lang: VoiceLang): boolean | null {
  if (!('speechSynthesis' in window)) return false;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null; // not loaded yet
  return voices.some((v) => v.lang.toLowerCase().startsWith(lang));
}

/**
 * Reads tutor replies aloud.
 * 1. Server voice (Sarvam) when configured — natural Telugu/Hindi. Audio is cached in IndexedDB,
 *    so replaying costs no data and works offline.
 * 2. Otherwise, or if the server call fails, the device's own speechSynthesis voice.
 */
export function useVoicePlayback() {
  const caps = useVoiceCapabilities();
  const [state, setState] = useState<PlaybackState>('idle');
  const [source, setSource] = useState<'server' | 'cache' | 'device' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const last = useRef<{ text: string; lang: VoiceLang } | null>(null);

  const cleanupAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };

  const stop = useCallback(() => {
    cleanupAudio();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setState('idle');
  }, []);

  useEffect(() => stop, [stop]);

  const playDevice = useCallback((text: string, lang: VoiceLang) => {
    if (!('speechSynthesis' in window)) {
      setState('error');
      setError('unsupported');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickIndianVoice(lang);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? LOCALE[lang];
    u.rate = 0.95;
    u.onend = () => setState('idle');
    u.onerror = () => setState('idle');
    setSource('device');
    setState('playing');
    window.speechSynthesis.speak(u);
  }, []);

  const playBlob = useCallback((blob: Blob, from: 'server' | 'cache') => {
    cleanupAudio();
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setState('idle');
    audio.onpause = () => audio.currentTime < audio.duration && setState((s) => (s === 'playing' ? 'paused' : s));
    audio.onplay = () => setState('playing');
    setSource(from);
    return audio.play();
  }, []);

  const play = useCallback(
    async (textRaw: string, lang: VoiceLang) => {
      const text = textRaw.replace(/[*#_`>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
      if (!text) return;
      stop();
      last.current = { text, lang };
      setError(null);
      if (!caps.data?.serverSpeech) {
        playDevice(text, lang);
        return;
      }
      setState('loading');
      try {
        const key = await audioCacheKey(text, `${lang}|${caps.data.ttsProvider}`);
        const cached = await offlineDb.getTts(key).catch(() => undefined);
        if (cached) {
          await playBlob(cached.blob, 'cache');
          return;
        }
        const blob = await apiBlob('/voice/speak', { text, language: lang });
        void offlineDb.putTts(key, blob).catch(() => undefined);
        if (last.current?.text !== text) return; // user moved on while loading
        await playBlob(blob, 'server');
      } catch {
        // Network or provider problem: fall back to the device voice rather than staying silent
        setError('server');
        playDevice(text, lang);
      }
    },
    [caps.data, playBlob, playDevice, stop],
  );

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    else if ('speechSynthesis' in window) window.speechSynthesis.pause();
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) void audioRef.current.play();
    else if ('speechSynthesis' in window) window.speechSynthesis.resume();
    setState('playing');
  }, []);

  const replay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play();
    } else if (last.current) {
      void play(last.current.text, last.current.lang);
    }
  }, [play]);

  return { play, pause, resume, stop, replay, state, source, error, serverSpeech: !!caps.data?.serverSpeech, supported: !!caps.data?.serverSpeech || 'speechSynthesis' in window };
}
