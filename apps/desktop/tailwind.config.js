/**
 * Arkive Hardware-Grade Theme Configuration
 * Warm Graphite ("Anodized Dusk") & Unbleached Stone ("Archival Paper")
 * with tactile Copper-Amber & Sage accents — zero neon/purple SaaS clichés.
 */
const withAlpha = (varName) => `rgb(var(${varName}) / <alpha-value>)`;

const accentPalette = {
  50: '#fdf7f2',
  100: '#faeadc',
  200: '#f3d1b5',
  300: '#eab285',
  400: '#df8e53',
  500: '#d47432',
  600: '#bd5d22',
  700: '#9c491d',
  800: '#7e3c1d',
  900: '#67331a',
  950: '#38180b',
};

const sagePalette = {
  50: '#f2fbf9',
  100: '#d5f4ec',
  200: '#ace8da',
  300: '#7ad5c2',
  400: '#4ebaa5',
  500: '#359e8b',
  600: '#287f70',
  700: '#23665b',
  800: '#20524a',
  900: '#1e443e',
  950: '#0c2724',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: {
      none: '0',
      sm: '2px',
      DEFAULT: '4px',
      md: '5px',
      lg: '6px',
      xl: '8px',
      '2xl': '10px',
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
        sky: accentPalette,
        indigo: accentPalette,
        violet: accentPalette,
        purple: accentPalette,
        emerald: sagePalette,
      },
    },
  },
  plugins: [],
};
