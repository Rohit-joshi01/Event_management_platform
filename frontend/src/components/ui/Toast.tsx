import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

interface ToastApi {
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (tone: ToastTone, title: string, body?: string) => {
      const id = ++seq;
      setToasts((t) => [...t.slice(-3), { id, tone, title, body }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(
    () => ({
      success: (t, b) => push('success', t, b),
      error: (t, b) => push('error', t, b),
      info: (t, b) => push('info', t, b),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-md border bg-ink-800/95 p-4 shadow-2xl backdrop-blur',
                t.tone === 'success' && 'border-volt/30',
                t.tone === 'error' && 'border-signal-danger/40',
                t.tone === 'info' && 'border-line-strong',
              )}
              role={t.tone === 'error' ? 'alert' : 'status'}
            >
              {t.tone === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-volt" />
              ) : t.tone === 'error' ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal-danger" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-signal-info" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-bone">{t.title}</p>
                {t.body ? <p className="mt-0.5 text-[13px] leading-relaxed text-mute">{t.body}</p> : null}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-mute hover:text-bone" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
