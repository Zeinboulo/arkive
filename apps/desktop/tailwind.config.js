/**
 * Arkive — Nordic Jade & Ocean Slate Palette
 * Zero orange, zero purple/violet gradients.
 * Uses calm Jade-Emerald (#10b981) and Ocean-Teal (#0d9488) accents
 * on soft Nordic Slate surfaces.
 */
const withAlpha = (varName) => `rgb(var(${varName}) / <alpha-value>)`;

const jadeTeal = {
  50: '#ecfdf5',
  100: '#d1fae5',
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#10b981',
  600: '#059669',
  700: '#047857',
  800: '#065f46',
  900: '#064e3b',
  950: '#022c22',
};

const oceanSlate = {
  50: '#f0f9ff',
  100: '#e0f2fe',
  200: '#bae6fd',
  300: '#7dd3fc',
  400: '#38bdf8',
  500: '#0ea5e9',
  600: '#0284c7',
  700: '#0369a1',
  800: '#075985',
  900: '#0c4a6e',
  950: '#082f49',
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
      xl: '12px',
      '2xl': '16px',
      full: '9999px',
    },
    extend: {
      fontFamily: {
        sans: ['"Segoe UI Variable Display"', '"Segoe UI Variable Text"', '"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Cascadia Code"', '"Cascadia Mono"', 'Consolas', 'ui-monospace', 'monospace'],
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
        sky: jadeTeal,
        emerald: jadeTeal,
        indigo: oceanSlate,
        violet: oceanSlate,
        purple: oceanSlate,
        amber: oceanSlate,
      },
    },
  },
  plugins: [],
};
