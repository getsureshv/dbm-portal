import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // DBM brand palette (from NotebookLM blueprint)
        navy: {
          DEFAULT: '#1E2761',
          light: '#2A3578',
          dark: '#151C4A',
        },
        gold: {
          DEFAULT: '#FFD700',
          dark: '#E6C200',
          light: '#FFE44D',
        },
        dbm: {
          bg: '#F8FAFC',
          border: '#E2E8F0',
          text: '#1E293B',
          muted: '#64748B',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
