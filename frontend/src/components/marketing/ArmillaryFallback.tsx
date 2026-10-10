/** Static vector rendering of the same composition for devices without WebGL or on low power. */
export function ArmillaryFallback({ compact }: { compact: boolean }) {
  return (
    <div className={compact ? 'absolute inset-x-0 top-[var(--nav-h)] flex h-[42svh] items-center justify-center' : 'absolute inset-0 flex items-center justify-end pr-[6vw]'} aria-hidden>
      <svg viewBox="-260 -260 520 520" className={compact ? 'h-full max-w-[440px] opacity-80' : 'w-[46vw] max-w-[640px]'}>
        <defs>
          <linearGradient id="chromeA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.35" stopColor="#7d7c78" />
            <stop offset="0.55" stopColor="#f2f0ea" />
            <stop offset="1" stopColor="#3a3a38" />
          </linearGradient>
          <linearGradient id="chromeB" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d8d6d0" />
            <stop offset="0.5" stopColor="#4a4a47" />
            <stop offset="1" stopColor="#f5f3ee" />
          </linearGradient>
          <radialGradient id="coreG">
            <stop offset="0" stopColor="#e6ffb0" />
            <stop offset="0.6" stopColor="#C7F36B" />
            <stop offset="1" stopColor="#7fa83a" />
          </radialGradient>
        </defs>
        <ellipse rx="230" ry="78" fill="none" stroke="url(#chromeA)" strokeWidth="9" transform="rotate(-18)" />
        <ellipse rx="70" ry="186" fill="none" stroke="url(#chromeB)" strokeWidth="14" transform="rotate(28)" />
        <ellipse rx="132" ry="96" fill="none" stroke="url(#chromeA)" strokeWidth="6" transform="rotate(64)" />
        <ellipse rx="84" ry="30" fill="none" stroke="url(#chromeB)" strokeWidth="3" transform="rotate(-50)" />
        <circle r="28" fill="url(#coreG)" />
      </svg>
    </div>
  );
}
