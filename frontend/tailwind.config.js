/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0A0A0A', // obsidian
          900: '#0A0A0A',
          850: '#101010',
          800: '#141414', // elevated
          750: '#181818',
          700: '#1C1C1C', // secondary
          600: '#232323',
          500: '#2C2C2C',
        },
        line: {
          DEFAULT: '#262626',
          soft: '#1F1F1F',
          strong: '#3A3A3A',
        },
        bone: {
          DEFAULT: '#F5F3EE',
          200: '#E9E6DE',
          300: '#D9D5CA',
        },
        mute: {
          DEFAULT: '#969696',
          600: '#7A7A7A',
          700: '#5E5E5E',
        },
        volt: {
          DEFAULT: '#C7F36B',
          600: '#B3DE57',
          900: '#2A3314',
        },
        signal: {
          warn: '#F2C14E',
          danger: '#F2695C',
          info: '#8AB4F8',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      fontSize: {
        'mega': ['clamp(2.5rem, 10.5vw, 11.5rem)', { lineHeight: '0.86', letterSpacing: '-0.055em' }],
        'giant': ['clamp(2.6rem, 6.4vw, 6.75rem)', { lineHeight: '0.92', letterSpacing: '-0.045em' }],
        'huge': ['clamp(2rem, 4.2vw, 4.25rem)', { lineHeight: '0.98', letterSpacing: '-0.035em' }],
      },
      letterSpacing: {
        tightest: '-0.06em',
        eyebrow: '0.16em',
      },
      borderRadius: {
        sm: '3px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-quart': 'cubic-bezier(0.76, 0, 0.24, 1)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
