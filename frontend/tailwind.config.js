/** @type {import('tailwindcss').Config} */
// Light "ocean" theme. The components were written for a dark UI, so the palette is remapped
// here instead of in every className: `white` is the ink color (headings, hairline borders,
// subtle fills via white/[.03]), `slate` runs dark→light, `abyss` is the light surfaces, and the
// pale accent shades (…-200/300) are deepened so they stay readable on white.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      colors: {
        white: '#0f2a3d',
        paper: '#ffffff',
        slate: {
          50: '#0f172a', 100: '#1e293b', 200: '#334155', 300: '#475569', 400: '#5b6b7d',
          500: '#7a8899', 600: '#a3afbc', 700: '#cbd5e1', 800: '#e2e8f0', 900: '#f1f5f9',
        },
        abyss: { 950: '#eaf3f8', 900: '#ffffff', 850: '#f3f8fb', 800: '#e6eff5', 700: '#d6e5ee', 600: '#c3d7e4' },
        lagoon: { 300: '#0e7490', 400: '#0891b2', 500: '#0e7fa0', 600: '#0b6782' },
        emerald: { 200: '#065f46', 300: '#047857', 950: '#ecfdf5' },
        amber: { 200: '#92400e', 300: '#b45309' },
        rose: { 200: '#9f1239', 300: '#be123c', 950: '#fff1f2' },
        risk: { low: '#10b981', mod: '#f59e0b', high: '#e11d48' },
      },
      keyframes: {
        pulsering: { '0%': { transform: 'scale(.6)', opacity: '.9' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        slidein: { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'none', opacity: 1 } },
      },
      animation: { pulsering: 'pulsering 1.6s ease-out infinite', slidein: 'slidein .35s ease-out both' },
    },
  },
  plugins: [],
}
