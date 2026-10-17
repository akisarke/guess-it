/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        pill: '9999px',
      },
      colors: {
        hc: {
          pink: '#FF5C8A',
          peach: '#FF8A5C',
          yellow: '#FFD166',
          mint: '#06D6A0',
          violet: '#7C5CFF',
          blue: '#3D8BFF',
          ink: '#1C1B24',
          paper: '#FFF9F2',
        },
      },
      keyframes: {
        'blob-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(40px, -30px) scale(1.15)' },
          '66%': { transform: 'translate(-30px, 25px) scale(0.9)' },
        },
      },
      animation: {
        'blob-drift': 'blob-drift 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};


