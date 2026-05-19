/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        manrope: ['Manrope', 'sans-serif'],
      },
      colors: {
        surface: '#FFFFFF',
        'surface-2': '#F9F9F9',
        'border-col': '#E5E5E5',
        muted: '#666666',
        'muted-2': '#999999',
      },
      boxShadow: {
        card: '0 4px 20px rgba(0,0,0,0.03)',
        modal: '0 20px 60px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}

