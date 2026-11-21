import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ImageUp, RotateCcw } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle, useHealth, useOnline } from '@/hooks';
import { api, ApiError } from '@/services/api';
import { compressImage, formatBytes, ImageError } from '@/utils/image';
import type { TutorMessage } from '@/types/api';
import { Alert, Button, PageHeader, Segmented, Textarea } from '@/components/ui';
import { DemoModeNotice } from '@/components/common';
import { TutorReply } from '@/features/tutor/TutorReply';
import { useAskTutor, type Intent } from '@/features/tutor/useTutor';

type Stage = 'pick' | 'reading' | 'edit';

export default function Photo() {
  const { tx, lang } = useLang();
  const toast = useToast();
  const online = useOnline();
  const health = useHealth();
  const ask = useAskTutor();
  useDocumentTitle(tx('फोटो से पूछें', 'Ask by photo'));
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [preview, setPreview] = useState<string | null>(null);
  const [sizeNote, setSizeNote] = useState('');
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent>('hint');
  const [reply, setReply] = useState<TutorMessage | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const demo = health.data?.ai.mode === 'demo';

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const reset = () => {
    setStage('pick');
    setPreview(null);
    setText('');
    setNotes('');
    setError(null);
    setReply(null);
    setConversationId(undefined);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setReply(null);
    let compressed: Awaited<ReturnType<typeof compressImage>>;
    try {
      compressed = await compressImage(file);
    } catch (e) {
      const code = e instanceof ImageError ? e.message : 'decode';
      setError(
        code === 'type'
          ? tx('केवल JPG, PNG या WebP फोटो चुनें।', 'Choose a JPG, PNG or WebP photo.')
          : code === 'size'
            ? tx('फोटो बहुत बड़ी है (15 MB से ज़्यादा)।', 'The photo is too large (over 15 MB).')
            : code === 'small'
              ? tx('फोटो बहुत छोटी है। सवाल के पास से फिर खींचें।', 'The photo is too small. Take it closer to the question.')
              : tx('यह फोटो खुल नहीं सकी।', 'This photo could not be opened.'),
      );
      return;
    }
    setPreview(URL.createObjectURL(compressed.blob));
    setSizeNote(tx(`${formatBytes(compressed.originalBytes)} से घटाकर ${formatBytes(compressed.blob.size)}`, `Reduced from ${formatBytes(compressed.originalBytes)} to ${formatBytes(compressed.blob.size)}`));

    if (demo || !online) {
      setStage('edit');
      return;
    }
    setStage('reading');
    try {
      const form = new FormData();
      form.append('image', compressed.blob, 'question.jpg');
      const res = await api<{ question: string; readable: boolean; notes: string }>('/vision/extract', { form });
      setText(res.question);
      setNotes(res.notes);
      if (!res.question || !res.readable) setError(tx('सवाल साफ़ नहीं पढ़ा जा सका। नीचे खुद लिखें या नई फोटो लें।', 'The question could not be read clearly. Type it below or take a new photo.'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tx('फोटो पढ़ी नहीं जा सकी।', 'Could not read the photo.'));
    } finally {
      setStage('edit');
    }
  };

  const submit = async () => {
    try {
      const res = await ask.mutateAsync({ conversationId, content: text.trim(), intent, mode: 'PHOTO', language: lang === 'hi' ? 'HI' : 'EN' });
      setConversationId(res.conversationId);
      setReply(res.assistantMessage);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : tx('भेजा नहीं जा सका', 'Could not send'), 'error');
    }
  };

  return (
    <>
      <PageHeader title={tx('फोटो से पूछें', 'Ask by photo')} subtitle={tx('किताब या कॉपी के एक सवाल की साफ़ फोटो लीजिए। पढ़ा गया सवाल भेजने से पहले आप उसे जाँच और सुधार सकते हैं।', 'Take a clear photo of one question from your book or notebook. You can check and fix the extracted text before sending.')} />
      <div className="mb-4 space-y-2">
        {demo && (
          <>
            <DemoModeNotice mode="demo" />
            <Alert tone="info">{tx('डेमो मोड में फोटो से सवाल नहीं पढ़ा जा सकता। फोटो देखकर सवाल खुद लिखिए।', 'In demo mode the photo cannot be read automatically. Look at the photo and type the question.')}</Alert>
          </>
        )}
        {!online && <Alert tone="warning">{tx('फोटो पढ़ने और ट्यूटर के लिए इंटरनेट चाहिए।', 'Reading photos and the tutor need internet.')}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

      {stage === 'pick' && (
        <div className="panel p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" onClick={() => cameraRef.current?.click()} icon={<Camera className="h-5 w-5" />}>
              {tx('कैमरा से फोटो लें', 'Take a photo')}
            </Button>
            <Button size="lg" variant="secondary" onClick={() => galleryRef.current?.click()} icon={<ImageUp className="h-5 w-5" />}>
              {tx('गैलरी से चुनें', 'Choose from gallery')}
            </Button>
          </div>
          <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-ink-700">
            <li>{tx('फ़ोन सीधा रखें और रोशनी अच्छी हो।', 'Hold the phone straight, in good light.')}</li>
            <li>{tx('एक फोटो में केवल एक सवाल।', 'One question per photo.')}</li>
            <li>{tx('फोटो में अपना नाम या चेहरा न आने दें।', 'Keep your name and face out of the photo.')}</li>
          </ul>
        </div>
      )}

      {stage !== 'pick' && (
        <div className="grid gap-5 md:grid-cols-[minmax(0,16rem)_1fr]">
          <div>
            {preview && <img src={preview} alt={tx('आपकी चुनी हुई फोटो', 'Your selected photo')} className="max-h-72 w-full rounded border border-line bg-white object-contain" />}
            <p className="mt-1 text-xs text-ink-600">{sizeNote}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={reset} icon={<RotateCcw className="h-4 w-4" />}>
              {tx('दूसरी फोटो', 'Another photo')}
            </Button>
          </div>
          <div className="panel p-4">
            {stage === 'reading' ? (
              <p className="py-8 text-center text-ink-700" role="status">
                {tx('फोटो से सवाल पढ़ा जा रहा है…', 'Reading the question from the photo…')}
              </p>
            ) : (
              <>
                <Textarea id="photo-text" label={tx('सवाल (जाँचें और सुधारें)', 'Question (check and correct it)')} rows={5} value={text} onChange={(e) => setText(e.target.value)} hint={notes || undefined} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <Segmented
                    label={tx('मुझे चाहिए', 'I want')}
                    value={intent}
                    onChange={setIntent}
                    options={[
                      { value: 'hint', label: tx('संकेत', 'Hint') },
                      { value: 'solution', label: tx('पूरा हल', 'Solution') },
                    ]}
                  />
                  <Button onClick={submit} loading={ask.isPending} disabled={!text.trim() || !online}>
                    {tx('ट्यूटर से पूछें', 'Ask the tutor')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {reply && (
        <section className="mt-6" aria-live="polite">
          <TutorReply message={reply} />
          {conversationId && (
            <p className="mt-2 text-sm">
              <Link to={`/app/tutor/${conversationId}`}>{tx('यह बातचीत ट्यूटर में जारी रखें', 'Continue this conversation in the tutor')}</Link>
            </p>
          )}
        </section>
      )}
    </>
  );
}
