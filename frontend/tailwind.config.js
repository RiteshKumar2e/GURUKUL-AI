/** @type {import('tailwindcss').Config} */
// Visual language: print-style neo-brutalism. White paper, 2px ink outlines with hard offset
// shadows on the main components only, light rules inside them, red for actions and yellow
// for highlights.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette taken from the reference design: ink black on white paper, red for actions,
        // yellow for highlights. The scale names (ink/saffron) are kept so every page updates at once.
        ink: {
          950: '#111111',
          900: '#111111',
          800: '#333333',
          700: '#333333',
          600: '#5A5A5A',
          500: '#6B6B66',
          400: '#8A8A84',
          300: '#B5B5AD',
          200: '#DCDCD4',
          100: '#EBEBE5',
          50: '#F1F1EC',
        },
        // Yellow highlight scale (was saffron). 700 is the dark amber used for text.
        saffron: {
          50: '#FFF6C4',
          100: '#FFF6C4',
          200: '#FFE766',
          400: '#FFD60A',
          500: '#F5C400',
          600: '#8A4B00',
          700: '#8A4B00',
        },
        red: { 50: '#FFE8E8', 600: '#E1001A', 700: '#AD0014' },
        lemon: { 100: '#FFF6C4', 300: '#FFD60A' },
        sky: '#E4EEF7',
        slate: '#2F5577',
        paper: '#FFFFFF',
        sunk: '#F1F1EC',
        line: '#DCDCD4',
        good: { 50: '#E2F3E7', 600: '#1D6B3B', 700: '#1D6B3B' },
        bad: { 50: '#FFE8E8', 600: '#E1001A', 700: '#AD0014' },
      },
      fontFamily: {
        // Latin from Archivo; Devanagari falls through to Mukta, Telugu to Noto Sans Telugu
        sans: ['"Archivo Variable"', 'Mukta', 'Noto Sans Telugu', 'Nirmala UI', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['"Archivo Variable"', 'Mukta', 'Noto Sans Telugu', 'Nirmala UI', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'Cascadia Mono', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      fontSize: {
        // Slightly larger base for Devanagari legibility on small screens
        base: ['1.0625rem', { lineHeight: '1.65' }],
      },
      borderRadius: {
        none: '0',
        sm: '3px',
        DEFAULT: '4px',
        md: '4px',
        lg: '6px',
        xl: '6px',
        '2xl': '8px',
        full: '9999px',
      },
      boxShadow: {
        'brut-sm': '2px 2px 0 0 #111111',
        brut: '4px 4px 0 0 #111111',
        'brut-lg': '8px 8px 0 0 #111111',
        'brut-saffron': '4px 4px 0 0 #FFD60A',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};
