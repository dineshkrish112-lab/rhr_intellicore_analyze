/** @type {import('tailwindcss').Config} */
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{js,jsx}'] },
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        inter: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5715' }],
      },
      colors: {
        gray: {
          50: '#f8fafc', 100: '#f1f4f9', 200: '#e5e7eb', 300: '#bfc4cd', 400: '#9ca3af',
          500: '#6b7280', 600: '#4b5563', 700: '#374151', 750: '#232d40', 800: '#172033', 900: '#0e1626', 950: '#090f1c',
        },
        brand: {
          50: '#ecfdfb', 100: '#cffaf4', 200: '#a0f3e9', 300: '#63e6da', 400: '#2dd0c4', 500: '#0fb5aa',
          600: '#09918b', 700: '#0c7470', 800: '#0f5c5a', 900: '#114c4a', 950: '#032d2d',
        },
        ink: {
          600: '#2a3754', 700: '#1c2740', 800: '#131c30', 900: '#0b1222', 950: '#070c17',
        },
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(16 24 40 / 0.04)',
        card: '0 1px 2px rgb(16 24 40 / 0.04), 0 4px 16px -4px rgb(16 24 40 / 0.06)',
        glow: '0 0 0 4px rgb(15 181 170 / 0.15)',
      },
    },
  },
  plugins: [],
}
