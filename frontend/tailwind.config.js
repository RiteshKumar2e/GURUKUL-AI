/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Blue scale from the chosen palette (reference values kept at 900/800/600/400)
        ink: {
          950: '#0B1F33',
          900: '#102A43',
          800: '#243B53',
          700: '#334E68',
          600: '#486581',
          500: '#627D98',
          400: '#829AB1',
          300: '#9FB3C8',
          200: '#BCCCDC',
          100: '#D9E2EC',
          50: '#F0F4F8',
        },
        // Orange: 400/500 are the palette references; 700 is darkened for AA text on white
        saffron: {
          50: '#FEF6EA',
          100: '#FDEBCF',
          200: '#FAD49E',
          400: '#F0A23B',
          500: '#E97819',
          600: '#C9620F',
          700: '#A04D0B',
        },
        paper: '#FAF8F4',
        line: '#E3E6EA',
        good: { 50: '#EDF7F0', 600: '#2F7D4F', 700: '#226140' },
        bad: { 50: '#FDF0EE', 600: '#B42318', 700: '#912018' },
      },
      fontFamily: {
        sans: ['Mukta', 'Noto Sans Telugu', 'Nirmala UI', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Slightly larger base for Devanagari legibility on small screens
        base: ['1.0625rem', { lineHeight: '1.65' }],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};
