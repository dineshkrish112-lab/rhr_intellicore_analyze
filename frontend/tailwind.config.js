/** @type {import('tailwindcss').Config} */
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{js,jsx}'] },
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5715' }],
      },
      colors: {
        // Cool, blue-tinted neutrals so white cards sit on a light-blue canvas.
        gray: {
          50: '#f5f9fd', 100: '#edf3fa', 200: '#e0e9f4', 300: '#c5d3e4', 400: '#93a4ba',
          500: '#64758c', 600: '#47566b', 700: '#334155', 750: '#24324a', 800: '#192438', 900: '#111a2b', 950: '#0a111e',
        },
        // Single azure accent used for navigation, primary actions and the first chart series.
        brand: {
          50: '#eef6ff', 100: '#dbeafe', 200: '#bfdcfe', 300: '#91c4fd', 400: '#5ca6fa', 500: '#3687f5',
          600: '#1f6ae6', 700: '#1856cf', 800: '#1a47a8', 900: '#1b3e85', 950: '#142751',
        },
        sky: {
          50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9',
        },
        ink: {
          600: '#243352', 700: '#1a2741', 800: '#121d33', 900: '#0d1628', 950: '#08101e',
        },
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(15 40 80 / 0.05)',
        card: '0 1px 2px rgb(15 40 80 / 0.04), 0 10px 28px -14px rgb(31 106 230 / 0.18)',
        lift: '0 2px 4px rgb(15 40 80 / 0.05), 0 18px 40px -16px rgb(31 106 230 / 0.28)',
      },
    },
  },
  plugins: [],
}
