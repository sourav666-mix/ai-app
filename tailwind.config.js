/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0b0e14',
          1: '#10141d',
          2: '#161b26',
          3: '#1e2431',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        /* ── Design System 2.0 ── */
        aurora: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)', opacity: '0.7' },
          '33%': { transform: 'translate3d(4%,-5%,0) scale(1.12) rotate(2deg)', opacity: '1' },
          '66%': { transform: 'translate3d(-4%,4%,0) scale(0.94) rotate(-2deg)', opacity: '0.75' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(.75) translateY(10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        'glow-pulse': {
          '0%,100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .25s ease-out both',
        'scale-in': 'scale-in .18s ease-out both',
        'slide-up': 'slide-up .3s ease-out both',
        /* ── Design System 2.0 ── */
        aurora: 'aurora 22s ease-in-out infinite',
        shimmer: 'shimmer 2.2s infinite',
        'pop-in': 'pop-in .4s cubic-bezier(.34,1.56,.64,1) both',
        float: 'float 5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2.6s ease-in-out infinite',
        'spin-slow': 'spin-slow 7s linear infinite',
      },
      boxShadow: {
        glow: '0 0 24px rgba(139,92,246,.25)',
        'glow-sm': '0 0 12px rgba(139,92,246,.2)',
        'glow-lg': '0 8px 40px rgba(139,92,246,.3), 0 2px 12px rgba(0,0,0,.4)',
      },
    },
  },
  plugins: [],
};