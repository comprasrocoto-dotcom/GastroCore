import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ambar: {
          DEFAULT: '#C2660E',
          50: '#FBF3EA',
          100: '#F5E1CC',
          200: '#EAC299',
          300: '#DFA366',
          400: '#D48433',
          500: '#C2660E',
          600: '#9B520B',
          700: '#743D08',
          800: '#4E2906',
          900: '#271403',
        },
        salvia: {
          DEFAULT: '#3F6B4F',
          50: '#EDF3EF',
          100: '#D3E1D8',
          200: '#A7C3B1',
          300: '#7BA58A',
          400: '#548269',
          500: '#3F6B4F',
          600: '#33563F',
          700: '#26402F',
          800: '#1A2B20',
          900: '#0D1510',
        },
        base: {
          light: '#F5F6F3',
          dark: '#1B1C19',
        },
      },
      fontFamily: {
        display: ['var(--font-zilla)', 'Zilla Slab', 'serif'],
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
