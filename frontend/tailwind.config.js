/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: {
          DEFAULT: '#4338CA',
          dk: '#312E81',
          lt: '#EEF2FF',
          mid: '#C7D2FE',
        },
        text: {
          DEFAULT: '#0F172A',
          2: '#475569',
          3: '#94A3B8',
        },
        surface: '#F8FAFC',
        border: {
          DEFAULT: '#E2E8F0',
          dk: '#CBD5E1',
        },
        success: {
          DEFAULT: '#059669',
          lt: '#D1FAE5',
        },
        warning: {
          DEFAULT: '#D97706',
          lt: '#FEF3C7',
        },
        danger: {
          DEFAULT: '#DC2626',
          lt: '#FEE2E2',
        },
        purple: {
          DEFAULT: '#7C3AED',
          lt: '#F5F3FF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'ui-serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '9px',
        input: '8px',
        pill: '100px',
      },
    },
  },
  plugins: [],
}
