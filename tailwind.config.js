/** @type {import('tailwindcss').Config} */
export default {
  // Only apply hover: styles on devices that actually hover (no "stuck" hovers after a tap)
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette taken from the igniteX logo: fire orange on warm near-black.
        // (Kept under the old "galaksi" name so existing class names still work.)
        //   50–300  warm off-whites / stone for text
        //   400–600 fire orange accent
        //   700–900 warm dark surfaces
        galaksi: {
          50:  '#FBF8F3',
          100: '#F5F1EA',
          200: '#E6DFD5',
          300: '#CFC6BA',
          400: '#FF7A2E',
          500: '#FF6B1A',
          600: '#E2560D',
          700: '#2A2724',
          800: '#1D1B19',
          900: '#141312',
        },
        ink: {
          DEFAULT: '#0C0B0A', // page background
          card:    '#151412',
          line:    '#2A2724',
        },
      },
      fontFamily: {
        display: ['"Archivo"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
