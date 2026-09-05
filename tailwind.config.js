/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif'
        ],
        mono: [
          '"Geist Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace'
        ]
      },
      transitionTimingFunction: {
        'fluid': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'snappy': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      borderRadius: {
        'sm': '8px',
        'md': '14px',
        'lg': '18px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '40px',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'elevated': '0 20px 40px -15px rgba(0, 0, 0, 0.12)',
        'inner-highlight': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)',
        'inner-dark': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.06)',
      }
    },
  },
  plugins: [],
}

