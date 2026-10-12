/**
 * Arkive theme: warm graphite surfaces with a single "ember" accent.
 * Legacy palette names (slate, sky, indigo, violet, purple) are remapped so the
 * whole UI shares one identity without per-component overrides.
 */
const ember = {
  50: '#fff4ec',
  100: '#ffe4d1',
  200: '#ffc6a0',
  300: '#ffa774',
  400: '#ff8e55',
  500: '#ff7a3d',
  600: '#e8601f',
  700: '#bf4b14',
  800: '#8f3a12',
  900: '#6b2d10',
  950: '#3b1706',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: {
      none: '0',
      sm: '3px',
      DEFAULT: '4px',
      md: '5px',
      lg: '6px',
      xl: '8px',
      full: '9999px',
    },
    extend: {
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"Cascadia Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      colors: {
        slate: {
          50: '#f5f3ef',
          100: '#e9e5de',
          200: '#d3cdc2',
          300: '#b3ac9f',
          400: '#8d867a',
          500: '#6c665c',
          600: '#4d4942',
          700: '#36332e',
          800: '#272522',
          850: '#1f1d1b',
          900: '#181715',
          950: '#100f0e',
        },
        sky: ember,
        indigo: ember,
        violet: ember,
        purple: ember,
      },
    },
  },
  plugins: [],
};
