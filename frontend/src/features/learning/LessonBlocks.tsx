import { Lightbulb, PenLine, Sigma } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import type { LessonBlock } from '@/types/api';

export function LessonBlocks({ blocks }: { blocks: LessonBlock[] }) {
  const { bi, tx } = useLang();
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        const text = bi(b);
        if (b.kind === 'formula') {
          return (
            <div key={i} className="rounded-md border-2 border-ink-950 bg-ink-50 px-4 py-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-600">
                <Sigma className="h-4 w-4" aria-hidden />
                {tx('सूत्र', 'Formula')}
              </p>
              <p className="whitespace-pre-line font-semibold leading-8 text-ink-900">{text}</p>
            </div>
          );
        }
        if (b.kind === 'example') {
          return (
            <div key={i} className="border-l-4 border-saffron-400 bg-white py-1 pl-4">
              <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-saffron-700">
                <PenLine className="h-4 w-4" aria-hidden />
                {tx('उदाहरण', 'Example')}
              </p>
              <p className="text-ink-900">{text}</p>
            </div>
          );
        }
        if (b.kind === 'note') {
          return (
            <p key={i} className="flex gap-2 rounded bg-saffron-50 px-4 py-3 text-ink-900">
              <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-saffron-600" aria-hidden />
              <span>{text}</span>
            </p>
          );
        }
        return (
          <p key={i} className="text-[1.05rem] leading-8 text-ink-900">
            {text}
          </p>
        );
      })}
    </div>
  );
}
