/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0a0a0f',
          1: '#111118',
          2: '#18181f',
          3: '#1f1f28',
          4: '#26262f',
        },
        accent: {
          green: '#00d4aa',
          red: '#ff4d6d',
          blue: '#4d9fff',
          yellow: '#ffd166',
          purple: '#9b5de5',
        },
        border: {
          DEFAULT: '#2a2a35',
          subtle: '#1e1e28',
        },
      },
      backgroundImage: {
        'gradient-mesh':
          'radial-gradient(at 40% 20%, hsla(168,100%,41%,0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(220,100%,66%,0.06) 0px, transparent 50%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
