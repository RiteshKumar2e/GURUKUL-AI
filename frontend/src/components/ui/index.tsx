import { forwardRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Loader2, TriangleAlert } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';

/* --------------------------------- Button --------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded border-2 font-extrabold no-underline select-none transition-[transform,box-shadow,background-color] duration-100 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none';
// Raised buttons lift on hover and press flat on click, like a physical key
const press = 'shadow-brut-sm hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_#111111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none';
const variants: Record<Variant, string> = {
  primary: `border-ink-950 bg-red-600 text-white hover:bg-red-600 ${press}`,
  secondary: `border-ink-950 bg-white text-ink-950 hover:bg-saffron-400 ${press}`,
  ghost: 'border-transparent bg-transparent text-ink-950 underline decoration-2 underline-offset-4 hover:bg-lemon-100',
  danger: 'border-bad-700 bg-white text-bad-700 hover:bg-bad-50',
};
const sizes: Record<Size, string> = { sm: '!min-h-[36px] px-3 py-1 text-sm', md: 'px-4 py-2 text-[0.98rem]', lg: 'min-h-[50px] px-6 py-3 text-base' };

export const btnClass = (variant: Variant = 'primary', size: Size = 'md', extra = '') => `${base} ${variants[variant]} ${sizes[size]} ${extra}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', loading, icon, className = '', children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} className={btnClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = 'primary', size = 'md', className = '', ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={btnClass(variant, size, className)} {...rest} />;
}

/* ---------------------------------- Fields --------------------------------- */

interface FieldWrapProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FieldWrap({ id, label, error, hint, children }: FieldWrapProps) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-sm text-bad-700" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; id: string };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, id, className = '', ...rest }, ref) {
  return (
    <FieldWrap id={id} label={label} error={error} hint={hint}>
      <input ref={ref} id={id} className={`field ${error ? 'field-error' : ''} ${className}`} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...rest} />
    </FieldWrap>
  );
});

/** Password field with a show/hide (eye) button. The button sits inside the input box, so a hint
 *  or error below the field never shifts it. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(function PasswordInput({ label, error, hint, id, className = '', ...rest }, ref) {
  const { tx } = useLang();
  const [show, setShow] = useState(false);
  return (
    <FieldWrap id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={show ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`field pr-12 ${error ? 'field-error' : ''} ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...rest}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r text-ink-600 hover:text-ink-900"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? tx('पासवर्ड छिपाएँ', 'Hide password') : tx('पासवर्ड दिखाएँ', 'Show password')}
          aria-pressed={show}
          aria-controls={id}
        >
          {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>
    </FieldWrap>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string; id: string };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, error, hint, id, className = '', children, ...rest }, ref) {
  return (
    <FieldWrap id={id} label={label} error={error} hint={hint}>
      <select ref={ref} id={id} className={`field ${error ? 'field-error' : ''} ${className}`} aria-invalid={!!error} {...rest}>
        {children}
      </select>
    </FieldWrap>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string; id: string };
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, hint, id, className = '', ...rest }, ref) {
  return (
    <FieldWrap id={id} label={label} error={error} hint={hint}>
      <textarea ref={ref} id={id} className={`field ${error ? 'field-error' : ''} ${className}`} aria-invalid={!!error} {...rest} />
    </FieldWrap>
  );
});

/* --------------------------------- Feedback -------------------------------- */

type Tone = 'info' | 'success' | 'error' | 'warning';
const toneStyle: Record<Tone, string> = {
  info: 'border-ink-950 bg-sky text-ink-950',
  success: 'border-good-700 bg-good-50 text-ink-950',
  error: 'border-bad-700 bg-bad-50 text-ink-950',
  warning: 'border-ink-950 bg-saffron-100 text-ink-950',
};
const toneIcon = { info: Info, success: CheckCircle2, error: AlertCircle, warning: TriangleAlert };
const toneIconColor: Record<Tone, string> = { info: 'text-ink-600', success: 'text-good-600', error: 'text-bad-600', warning: 'text-saffron-600' };

export function Alert({ tone = 'info', title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  const Icon = toneIcon[tone];
  return (
    <div className={`flex gap-3 rounded-md border-2 px-4 py-3 ${toneStyle[tone]}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${toneIconColor[tone]}`} aria-hidden />
      <div className="min-w-0 flex-1 text-[0.97rem]">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 text-ink-800' : ''}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-ink-600" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label ?? 'Loading…'}</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-ink-100 ${className}`} aria-hidden />;
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-start gap-2 px-5 py-8 sm:items-center sm:text-center">
      {icon && <div className="text-ink-400">{icon}</div>}
      <p className="text-lg font-semibold text-ink-900">{title}</p>
      {children && <div className="max-w-md text-ink-700">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------------------------------- Layout --------------------------------- */

export function PageHeader({ title, subtitle, eyebrow, actions }: { title: string; subtitle?: ReactNode; eyebrow?: string; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-col gap-3 border-b-2 border-ink-950 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-[1.75rem] sm:text-[2.2rem]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-prose text-ink-700">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Section({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-8 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="flex items-center gap-2 text-xl"><span className="h-3 w-3 shrink-0 rounded-sm bg-saffron-400 outline outline-2 outline-ink-950" aria-hidden />{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'saffron' | 'good' | 'bad' }) {
  const t = {
    neutral: 'bg-white text-ink-950 border-ink-950',
    saffron: 'bg-lemon-300 text-ink-950 border-ink-950',
    good: 'bg-good-50 text-good-700 border-good-700 before:bg-good-700',
    bad: 'bg-bad-50 text-bad-700 border-bad-700 before:bg-bad-700',
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] px-2.5 py-0.5 text-xs font-bold ${t} ${tone === 'good' || tone === 'bad' ? "before:h-1.5 before:w-1.5 before:rounded-full before:content-['']" : ''}`}>{children}</span>;
}

/** Mastery shown as a thin bar plus the exact percentage; no colour-only meaning. */
export function MasteryBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = pct >= 70 ? 'bg-good-600' : pct >= 40 ? 'bg-saffron-400' : pct > 0 ? 'bg-bad-600/80' : 'bg-ink-200';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full border-[1.5px] border-ink-950 bg-white" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-sm tabular-nums text-ink-700">{pct}%</span>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap overflow-hidden rounded-md border-2 border-ink-950 bg-white">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[40px] border-r-2 border-ink-950 px-3 py-1.5 text-sm font-bold last:border-r-0 ${value === o.value ? 'bg-ink-900 text-white' : 'text-ink-950 hover:bg-saffron-100'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-ink-600">{label}</p>
      <p className="text-3xl font-extrabold tabular-nums text-ink-950">{value}</p>
      {note && <p className="text-xs text-ink-500">{note}</p>}
    </div>
  );
}
