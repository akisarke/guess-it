export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {

        sans: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        display: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },

      borderRadius: {
        sm: '3px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
        xl: '8px',
        '2xl': '8px',
        '3xl': '12px',
      },

      colors: {
        gray: {
          50: '#f5f3ec',
          100: '#e8e4dc',
          200: '#d5d0c6',
          300: '#b8b2a8',
          400: '#8d877e',
          500: '#6b655d',
          600: '#4a453f',
          700: '#322f2a',
          800: '#262420',
          900: '#191817',
        },

        ink: '#12110f',
        paper: '#e9e6de',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        brand: 'rgb(var(--brand-rgb) / <alpha-value>)',

        'accent-ink': '#1a1f2b',
      },
    },
  },
  plugins: [],
};
