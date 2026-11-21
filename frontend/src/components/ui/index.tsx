import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from 'lucide-react';

/* --------------------------------- Button --------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base = 'inline-flex items-center justify-center gap-2 rounded font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60 select-none';
const variants: Record<Variant, string> = {
  // Dark ink text on saffron keeps contrast above WCAG AA (≈7:1)
  primary: 'bg-saffron-400 text-ink-950 hover:bg-saffron-500 active:bg-saffron-500 border border-saffron-500/40',
  secondary: 'bg-white text-ink-900 border border-ink-200 hover:border-ink-400 hover:bg-ink-50',
  ghost: 'bg-transparent text-ink-800 hover:bg-ink-50 border border-transparent',
  danger: 'bg-white text-bad-700 border border-bad-600/40 hover:bg-bad-50',
};
const sizes: Record<Size, string> = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-[0.98rem]', lg: 'px-5 py-3 text-base' };

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
  info: 'border-ink-200 bg-ink-50 text-ink-900',
  success: 'border-good-600/30 bg-good-50 text-ink-900',
  error: 'border-bad-600/30 bg-bad-50 text-ink-900',
  warning: 'border-saffron-400/60 bg-saffron-50 text-ink-900',
};
const toneIcon = { info: Info, success: CheckCircle2, error: AlertCircle, warning: TriangleAlert };
const toneIconColor: Record<Tone, string> = { info: 'text-ink-600', success: 'text-good-600', error: 'text-bad-600', warning: 'text-saffron-600' };

export function Alert({ tone = 'info', title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  const Icon = toneIcon[tone];
  return (
    <div className={`flex gap-3 rounded border px-4 py-3 ${toneStyle[tone]}`} role={tone === 'error' ? 'alert' : undefined}>
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
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-[1.6rem] sm:text-[1.85rem]">{title}</h1>
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
          {title && <h2 className="text-lg">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'saffron' | 'good' | 'bad' }) {
  const t = {
    neutral: 'bg-ink-50 text-ink-700 border-ink-100',
    saffron: 'bg-saffron-50 text-saffron-700 border-saffron-200',
    good: 'bg-good-50 text-good-700 border-good-600/20',
    bad: 'bg-bad-50 text-bad-700 border-bad-600/20',
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

/** Mastery shown as a thin bar plus the exact percentage; no colour-only meaning. */
export function MasteryBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = pct >= 70 ? 'bg-good-600' : pct >= 40 ? 'bg-saffron-400' : pct > 0 ? 'bg-bad-600/80' : 'bg-ink-200';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-sm tabular-nums text-ink-700">{pct}%</span>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded border border-ink-200 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[4px] px-3 py-1.5 text-sm font-semibold transition-colors ${value === o.value ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-ink-50'}`}
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
      <p className="text-2xl font-semibold tabular-nums text-ink-900">{value}</p>
      {note && <p className="text-xs text-ink-500">{note}</p>}
    </div>
  );
}
