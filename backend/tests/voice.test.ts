/**
 * Voice providers: request formats are checked against a mocked fetch (no live keys needed),
 * plus provider selection and the voice API in demo mode.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { env } from '../src/config/env';
import { SarvamSttProvider } from '../src/services/speech/sarvamStt';
import { SarvamTtsProvider, chunkText } from '../src/services/speech/sarvamTts';
import { buildWav, concatWav, parseWav } from '../src/services/speech/wav';
import { GeminiProvider } from '../src/services/llm/geminiProvider';
import { getSttProvider, getTtsProvider, getLlmProvider, resetVoiceProvidersForTests } from '../src/services/voice/registry';
import { createApp } from '../src/app';
import { deleteUsersWithPrefix } from './helpers';

function wav(samples: number[]) {
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0); // PCM
  fmt.writeUInt16LE(1, 2); // mono
  fmt.writeUInt32LE(22050, 4);
  fmt.writeUInt32LE(44100, 8);
  fmt.writeUInt16LE(2, 12);
  fmt.writeUInt16LE(16, 14);
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  return buildWav(fmt, data);
}

function mockFetch(handler: (url: string, init: RequestInit) => unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const body = handler(url, init);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WAV helpers', () => {
  it('joins clips and keeps a valid header', () => {
    const joined = concatWav([wav([1, 2]), wav([3])]);
    const parsed = parseWav(joined);
    expect(parsed.data.length).toBe(6);
    expect(joined.readUInt32LE(4)).toBe(joined.length - 8);
  });
  it('rejects non-WAV data', () => {
    expect(() => parseWav(Buffer.from('hello world!'))).toThrow();
  });
});

describe('text chunking for TTS', () => {
  it('splits at sentence ends and respects the limit', () => {
    const text = 'పాఠం ఒకటి. '.repeat(80);
    const chunks = chunkText(text, 100);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text.trim().replace(/\s+/g, ' '));
  });
  it('splits a very long sentence', () => {
    expect(chunkText('a'.repeat(250), 100)).toHaveLength(3);
  });
});

describe('Sarvam speech-to-text', () => {
  it('sends the documented multipart request for Telugu', async () => {
    const calls = mockFetch(() => ({ transcript: ' x విలువ ఎంత? ', language_code: 'te-IN' }));
    const stt = new SarvamSttProvider({ apiKey: 'k-test', baseUrl: 'https://api.sarvam.ai/', model: 'saarika:v2.5', timeoutMs: 5000 });
    const r = await stt.transcribe({ buffer: Buffer.from('RIFF'), filename: 'q.wav', mimeType: 'audio/wav' }, 'te');
    expect(r.text).toBe('x విలువ ఎంత?');
    expect(calls[0].url).toBe('https://api.sarvam.ai/speech-to-text');
    expect((calls[0].init.headers as Record<string, string>)['api-subscription-key']).toBe('k-test');
    const form = calls[0].init.body as FormData;
    expect(form.get('language_code')).toBe('te-IN');
    expect(form.get('model')).toBe('saarika:v2.5');
    expect(form.get('file')).toBeInstanceOf(Blob);
  });

  it('maps HTTP errors without leaking the key', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 403 }));
    const stt = new SarvamSttProvider({ apiKey: 'secret-key', baseUrl: 'https://api.sarvam.ai', model: 'm', timeoutMs: 5000 });
    await expect(stt.transcribe({ buffer: Buffer.from(''), filename: 'a.wav', mimeType: 'audio/wav' }, 'hi')).rejects.toThrow(/403.*Invalid API key/);
    await expect(stt.transcribe({ buffer: Buffer.from(''), filename: 'a.wav', mimeType: 'audio/wav' }, 'hi')).rejects.not.toThrow(/secret-key/);
  });
});

describe('Sarvam text-to-speech', () => {
  it('sends JSON per chunk and returns one WAV', async () => {
    const calls = mockFetch(() => ({ audios: [wav([5, 6]).toString('base64')] }));
    const tts = new SarvamTtsProvider({ apiKey: 'k', baseUrl: 'https://api.sarvam.ai', model: 'bulbul:v2', speaker: 'anushka', timeoutMs: 5000 });
    const long = 'మొదటి దశ. '.repeat(60); // > 450 chars, so at least two requests
    const r = await tts.synthesize(long, 'te');
    expect(calls.length).toBeGreaterThan(1);
    const body = JSON.parse(calls[0].init.body as string);
    expect(body).toMatchObject({ target_language_code: 'te-IN', speaker: 'anushka', model: 'bulbul:v2' });
    expect(typeof body.text).toBe('string');
    expect(calls[0].url).toBe('https://api.sarvam.ai/text-to-speech');
    expect(r.mimeType).toBe('audio/wav');
    expect(parseWav(r.audio).data.length).toBe(4 * calls.length);
  });

  it('fails clearly when no audio comes back', async () => {
    mockFetch(() => ({ audios: [] }));
    const tts = new SarvamTtsProvider({ apiKey: 'k', baseUrl: 'https://api.sarvam.ai', model: 'm', speaker: 's', timeoutMs: 5000 });
    await expect(tts.synthesize('నమస్తే', 'te')).rejects.toThrow(/no audio/);
  });
});

describe('Gemini provider', () => {
  it('calls the OpenAI-compatible endpoint with a Bearer key', async () => {
    const calls = mockFetch(() => ({ model: 'gemini-2.5-flash', choices: [{ message: { content: '{"reply":"సరే"}' } }] }));
    const g = new GeminiProvider({ apiKey: 'g-key', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', timeoutMs: 5000 });
    const r = await g.chat([{ role: 'user', content: 'hi' }], { json: true });
    expect(r.text).toContain('సరే');
    expect(r.provider).toBe('gemini');
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer g-key');
    expect(JSON.parse(calls[0].init.body as string).response_format).toBeUndefined();
  });
});

describe('provider selection', () => {
  const saved = { ...env };
  afterAll(() => {
    Object.assign(env, saved);
    resetVoiceProvidersForTests();
  });

  it('auto picks Sarvam when its key is set', () => {
    Object.assign(env, { STT_PROVIDER: 'auto', TTS_PROVIDER: 'auto', SARVAM_API_KEY: 'x', sarvamEnabled: true });
    resetVoiceProvidersForTests();
    expect(getSttProvider().name).toBe('sarvam');
    expect(getTtsProvider()?.name).toBe('sarvam');
  });

  it('falls back to browser voice and no server STT without keys', () => {
    Object.assign(env, { STT_PROVIDER: 'auto', TTS_PROVIDER: 'auto', SARVAM_API_KEY: '', sarvamEnabled: false, AI_API_KEY: '', aiEnabled: false });
    resetVoiceProvidersForTests();
    expect(getSttProvider().live).toBe(false);
    expect(getTtsProvider()).toBeNull();
  });

  it('LLM auto prefers Groq, then Gemini, then demo', () => {
    Object.assign(env, { LLM_PROVIDER: 'auto', aiEnabled: false, AI_API_KEY: '', geminiEnabled: true, GEMINI_API_KEY: 'g' });
    resetVoiceProvidersForTests();
    expect(getLlmProvider().name).toBe('gemini');
    Object.assign(env, { aiEnabled: true, AI_API_KEY: 'a' });
    resetVoiceProvidersForTests();
    expect(getLlmProvider().name).toBe('groq');
    Object.assign(env, { aiEnabled: false, AI_API_KEY: '', geminiEnabled: false, GEMINI_API_KEY: '' });
    resetVoiceProvidersForTests();
    expect(getLlmProvider().live).toBe(false);
  });
});

describe('voice API (no keys configured)', () => {
  const app = createApp();
  const prefix = `v${Date.now().toString(36)}`;
  let token = '';

  beforeAll(async () => {
    Object.assign(env, { SARVAM_API_KEY: '', sarvamEnabled: false, AI_API_KEY: '', aiEnabled: false, GEMINI_API_KEY: '', geminiEnabled: false });
    resetVoiceProvidersForTests();
    const res = await request(app).post('/api/auth/register').send({ role: 'STUDENT', username: `${prefix}_s`, displayName: 'Voice Test', password: 'Test@12345', acceptTerms: true, guardianConsent: true });
    token = res.body.accessToken;
  });
  afterAll(async () => {
    await deleteUsersWithPrefix(prefix);
  });

  it('reports capabilities including Telugu', async () => {
    const res = await request(app).get('/api/voice/capabilities');
    expect(res.status).toBe(200);
    expect(res.body.languages).toEqual(['hi', 'en', 'te']);
    expect(res.body.serverSpeech).toBe(false);
    expect(res.body.ttsProvider).toBe('browser');
  });

  it('speak is protected, validated, and 503 without a TTS key', async () => {
    expect((await request(app).post('/api/voice/speak').send({ text: 'x' })).status).toBe(401);
    const auth = { Authorization: `Bearer ${token}` };
    expect((await request(app).post('/api/voice/speak').set(auth).send({ text: '' })).status).toBe(400);
    expect((await request(app).post('/api/voice/speak').set(auth).send({ text: 'నమస్తే', language: 'ta' })).status).toBe(400);
    expect((await request(app).post('/api/voice/speak').set(auth).send({ text: 'నమస్తే', language: 'te' })).status).toBe(503);
  });

  it('answers a Telugu question in Telugu in demo mode', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const conv = await request(app).post('/api/tutor/conversations').set(auth).send({ mode: 'VOICE' });
    const res = await request(app).post(`/api/tutor/conversations/${conv.body.id}/messages`).set(auth).send({ content: '2x + 6 = 10 సాధించండి', intent: 'solution', language: 'TE' });
    expect(res.status).toBe(200);
    const s = res.body.assistantMessage.structured;
    expect(s.language).toBe('TE');
    expect(s.demo).toBe(true);
    expect(s.reply).toMatch(/డెమో మోడ్/);
    expect(s.computed).toBe(2);
  });
});
