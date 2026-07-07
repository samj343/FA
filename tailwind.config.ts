import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0c1220',
          900: '#111a2e',
          800: '#1a2540',
        },
      },
    },
  },
  plugins: [],
};

export default config;
