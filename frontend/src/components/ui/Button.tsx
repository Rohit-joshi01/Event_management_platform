import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'light' | 'outline-light';
type Size = 'sm' | 'md' | 'lg';

const base =
  'group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-out-expo active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45';

const variants: Record<Variant, string> = {
  primary: 'bg-volt text-ink hover:bg-[#d4fa82] shadow-[inset_0_-1px_0_rgba(0,0,0,0.18)]',
  secondary: 'border border-line-strong bg-ink-800 text-bone hover:border-mute-700 hover:bg-ink-700',
  ghost: 'text-bone/80 hover:bg-white/[0.06] hover:text-bone',
  danger: 'border border-signal-danger/40 bg-signal-danger/10 text-[#ff9c92] hover:bg-signal-danger/20',
  light: 'bg-ink text-bone hover:bg-ink-700',
  'outline-light': 'border border-ink/25 text-ink hover:border-ink hover:bg-ink hover:text-bone',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 rounded px-3 text-[13px]',
  md: 'h-10 rounded px-4 text-sm',
  lg: 'h-[52px] rounded-md px-6 text-[15px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight && !loading ? (
        <span className="transition-transform duration-300 ease-out-expo group-hover/btn:translate-x-0.5">{iconRight}</span>
      ) : null}
    </button>
  );
});

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function ButtonLink({ variant = 'primary', size = 'md', icon, iconRight, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
      {iconRight ? (
        <span className="transition-transform duration-300 ease-out-expo group-hover/btn:translate-x-0.5">{iconRight}</span>
      ) : null}
    </Link>
  );
}
