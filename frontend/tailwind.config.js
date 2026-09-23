/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hud: {
          bg: '#0A0A1A',
          panel: '#0D1B2A',
          border: '#1B2A3A',
          text: '#E6F1FF',
          dim: '#8899AA',
          faint: '#445566',
          cyan: '#00BFFF',
          bull: '#00FF88',
          bear: '#FF4444',
          warn: '#FFB020',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        bull: '0 0 20px rgba(0,255,136,0.25)',
        bear: '0 0 20px rgba(255,68,68,0.25)',
        cyan: '0 0 20px rgba(0,191,255,0.25)',
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.35s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
