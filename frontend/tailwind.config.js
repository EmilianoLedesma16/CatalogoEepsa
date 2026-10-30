/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50: '#EFF5F4',
          100: '#D7E7E4',
          200: '#B3D1CC',
          300: '#8BB7B0',
          500: '#2A7A71',
          600: '#1A5952',
          700: '#134540',
          800: '#0F3833',
        },
        brand: {
          gray: '#8A8C8B',
          ink: '#0F172A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
