/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#07080B',
        base: '#0C0E13',
        panel: '#11141A',
        elevated: '#161B23',
        edge: '#232935',
        ink: '#F3F5F7',
        sub: '#9BA4B2',
        mute: '#5F6877',
        ok: '#35D07F',
        warn: '#F2B84B',
        crit: '#F05A67',
        high: '#FF8A5B',
        info: '#5DA9FF',
        accent: '#2DD4BF',
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: '10px' },
      boxShadow: {
        subtle: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
        glow: '0 0 40px -8px rgba(45,212,191,.4)',
      },
    },
  },
  plugins: [],
};
