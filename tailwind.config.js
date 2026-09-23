/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ember: {
          50:  '#fff8f0',
          100: '#ffecda',
          200: '#ffd4a8',
          300: '#ffb470',
          400: '#ff8c35',
          500: '#ff6b00',
          600: '#e55a00',
          700: '#c04500',
          800: '#9a3500',
          900: '#7a2800',
        },
        flame: {
          400: '#ff4e2a',
          500: '#ff3011',
          600: '#e02000',
        },
        spark: {
          400: '#ffd166',
          500: '#ffbe00',
          600: '#e6a800',
        },
        obsidian: {
          900: '#08080f',
          800: '#0f0f1a',
          700: '#161625',
          600: '#1e1e30',
          500: '#26263c',
          400: '#32324d',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['"Inter"', 'sans-serif'],
      },
      animation: {
        'pulse-ember': 'pulseEmber 2s ease-in-out infinite',
        'flicker': 'flicker 3s ease-in-out infinite',
        'glow-ring': 'glowRing 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'scan-line': 'scanLine 4s linear infinite',
        'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        pulseEmber: {
          '0%, 100%': { boxShadow: '0 0 20px 4px rgba(255,107,0,0.3), 0 0 60px 10px rgba(255,107,0,0.1)' },
          '50%': { boxShadow: '0 0 40px 8px rgba(255,107,0,0.6), 0 0 100px 20px rgba(255,107,0,0.2)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '8%': { opacity: '0.85' },
          '16%': { opacity: '1' },
          '42%': { opacity: '0.9' },
          '58%': { opacity: '1' },
          '72%': { opacity: '0.88' },
          '84%': { opacity: '1' },
        },
        glowRing: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.1)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.05)' },
          '56%': { transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
      backgroundImage: {
        'ember-radial': 'radial-gradient(ellipse at center, rgba(255,107,0,0.15) 0%, transparent 70%)',
        'fire-gradient': 'linear-gradient(135deg, #ff6b00 0%, #ff3011 50%, #c04500 100%)',
        'dark-mesh': 'radial-gradient(at 20% 30%, rgba(255,107,0,0.08) 0px, transparent 50%), radial-gradient(at 80% 70%, rgba(255,48,17,0.06) 0px, transparent 50%)',
      },
      dropShadow: {
        'ember': '0 0 20px rgba(255,107,0,0.5)',
        'flame': '0 0 30px rgba(255,48,17,0.6)',
      },
    },
  },
  plugins: [],
}
