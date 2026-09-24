/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        galaksi: {
          50:  '#f8f6ff',
          100: '#eee8ff',
          200: '#dad0ff',
          300: '#c9bbf0',
          400: '#a695e3',
          500: '#9383cc',
          600: '#8174b8',
          700: '#695c9a',
          800: '#5b508c',
          900: '#4a4073',
        },
        space: {
          900: '#2a2442',
          800: '#352d53',
          700: '#403664',
          600: '#4c427c',
          500: '#5b508c',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['"Inter"', 'sans-serif'],
      },
      animation: {
        'pulse-galaksi': 'pulseGalaksi 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'bounce-slow': 'bounceSlow 3s ease-in-out infinite',
      },
      keyframes: {
        pulseGalaksi: {
          '0%, 100%': { boxShadow: '0 0 20px 4px rgba(166,149,227,0.3), 0 0 60px 10px rgba(166,149,227,0.1)' },
          '50%': { boxShadow: '0 0 40px 8px rgba(166,149,227,0.6), 0 0 100px 20px rgba(166,149,227,0.2)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        bounceSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-15px)' },
        }
      },
      backgroundImage: {
        'galaksi-radial': 'radial-gradient(ellipse at center, rgba(166,149,227,0.15) 0%, transparent 70%)',
        'galaksi-gradient': 'linear-gradient(135deg, #a695e3 0%, #8174b8 50%, #5b508c 100%)',
      },
      dropShadow: {
        'galaksi': '0 10px 20px rgba(74,64,115,0.6)',
      },
    },
  },
  plugins: [],
}
