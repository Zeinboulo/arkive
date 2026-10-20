/**
 * Arkive Eye-Care Theme:
 * Uses CSS custom properties for surface and text tokens so the UI defaults to
 * a low-glare "Soft Dusk" (Nordic Slate + Calm Sage Teal) and supports an
 * instant "Warm Paper" (Alabaster Stone) light mode toggle.
 */
const withAlpha = (varName) => `rgb(var(${varName}) / <alpha-value>)`;

const sageTeal = {
  50: '#f0fdfa',
  100: '#ccfbf1',
  200: '#99f6e4',
  300: '#5eead4',
  400: '#38b2a6',
  500: '#2d9a8f',
  600: '#237e75',
  700: '#1d655f',
  800: '#19504c',
  900: '#16423f',
  950: '#0b2726',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: {
      none: '0',
      sm: '4px',
      DEFAULT: '6px',
      md: '8px',
      lg: '10px',
      xl: '14px',
      '2xl': '18px',
      full: '9999px',
    },
    extend: {
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Cascadia Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      colors: {
        slate: {
          50: withAlpha('--c-slate-50'),
          100: withAlpha('--c-slate-100'),
          200: withAlpha('--c-slate-200'),
          300: withAlpha('--c-slate-300'),
          400: withAlpha('--c-slate-400'),
          500: withAlpha('--c-slate-500'),
          600: withAlpha('--c-slate-600'),
          700: withAlpha('--c-slate-700'),
          750: withAlpha('--c-slate-750'),
          800: withAlpha('--c-slate-800'),
          850: withAlpha('--c-slate-850'),
          900: withAlpha('--c-slate-900'),
          950: withAlpha('--c-slate-950'),
        },
        sky: sageTeal,
        indigo: sageTeal,
        violet: sageTeal,
        purple: sageTeal,
        emerald: sageTeal,
      },
    },
  },
  plugins: [],
};
