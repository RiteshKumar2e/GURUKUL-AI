import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: Kind;
  message: string;
}

const Ctx = createContext<{ toast: (message: string, kind?: Kind) => void } | null>(null);

const STYLE: Record<Kind, string> = {
  success: 'border-good-600 bg-white text-ink-900',
  error: 'border-bad-600 bg-white text-ink-900',
  info: 'border-ink-600 bg-white text-ink-900',
};
const ICON = { success: CheckCircle2, error: AlertCircle, info: Info };
const ICON_COLOR: Record<Kind, string> = { success: 'text-good-600', error: 'text-bad-600', info: 'text-ink-600' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const toast = useCallback((message: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div key={t.id} className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded border-l-4 px-4 py-3 shadow-md ${STYLE[t.kind]}`}>
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_COLOR[t.kind]}`} aria-hidden />
              <p className="flex-1 text-[0.95rem]">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-ink-500 hover:text-ink-900" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.toast;
}
