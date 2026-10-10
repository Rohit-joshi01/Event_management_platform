import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded border bg-ink-850 px-3 text-[14px] text-bone placeholder:text-mute-700 transition-colors duration-150 hover:border-line-strong focus:border-volt/70 focus:outline-none focus:ring-2 focus:ring-volt/15 disabled:opacity-50';

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  id: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}

export function FieldShell({ label, hint, error, id, required, optional, children, className }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="flex items-baseline justify-between text-[13px] font-medium text-bone/90">
        <span>
          {label}
          {required ? <span className="ml-0.5 text-volt" aria-hidden>*</span> : null}
        </span>
        {optional ? <span className="text-[11px] font-normal text-mute-700">Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-[12.5px] text-[#ff9c92]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12.5px] leading-relaxed text-mute">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  wrapperClassName?: string;
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, optional, wrapperClassName, className, id, leading, required, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fid} required={required} optional={optional} className={wrapperClassName}>
      <div className="relative">
        {leading ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute">{leading}</span> : null}
        <input
          ref={ref}
          id={fid}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
          className={cn(control, 'h-11', leading && 'pl-9', error ? 'border-signal-danger/60' : 'border-line', className)}
          {...rest}
        />
      </div>
    </FieldShell>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, optional, wrapperClassName, className, id, required, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fid} required={required} optional={optional} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={fid}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        className={cn(control, 'min-h-[120px] py-2.5 leading-relaxed', error ? 'border-signal-danger/60' : 'border-line', className)}
        {...rest}
      />
    </FieldShell>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, optional, wrapperClassName, className, id, required, children, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fid} required={required} optional={optional} className={wrapperClassName}>
      <select
        ref={ref}
        id={fid}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(control, 'h-11 appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-9', error ? 'border-signal-danger/60' : 'border-line', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%23969696' stroke-width='1.5'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-bone">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[13px] leading-relaxed text-mute">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-50',
          checked ? 'border-volt bg-volt' : 'border-line-strong bg-ink-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all duration-300 ease-out-expo',
            checked ? 'left-[22px] bg-ink' : 'left-0.5 bg-mute',
          )}
        />
      </button>
    </div>
  );
}
