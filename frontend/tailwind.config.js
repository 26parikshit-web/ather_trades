/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hud: {
          bg: '#EAF7F0',       // mint page background
          panel: '#FFFFFF',    // cards
          border: '#DCEDE4',   // hairline borders
          text: '#0C1F17',     // near-black headings/body
          dim: '#476156',      // secondary text
          faint: '#94ACA1',    // muted/placeholder
          cyan: '#00B865',     // primary emerald (legacy class name kept)
          bull: '#00A860',     // up / gains
          bear: '#E5484D',     // down / losses
          warn: '#F59E0B',     // alerts / watch
          ink: '#0A1F17',      // dark hero cards
          mint: '#DCF5E8',     // tinted chips / active nav
        },
      },
      fontFamily: {
        mono: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(12,31,23,0.05), 0 10px 28px -18px rgba(12,31,23,0.25)',
        bull: '0 8px 20px -10px rgba(0,168,96,0.55)',
        bear: '0 8px 20px -10px rgba(229,72,77,0.5)',
        cyan: '0 8px 20px -10px rgba(0,184,101,0.55)',
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
