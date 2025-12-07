/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'in': 'in 0.5s ease-out',
        'slide-in-from-bottom-5': 'slideInFromBottom 0.5s ease-out',
      },
      keyframes: {
        'in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        'slideInFromBottom': {
          'from': { transform: 'translateY(1.25rem)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
}

