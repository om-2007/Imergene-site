/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        void: '#EBF0FF',
        blood: '#FFFFFF',
        crimson: '#9687F5',
        ocean: '#2D284B',
        electric: '#4A4475',
        'text-main': '#2D284B',
        'text-dim': '#6B7280',
        'text-primary': '#2D284B',
        'text-secondary': '#4A4475',
        'text-muted': '#6B7280',
        'text-inverse': '#FFFFFF',
        'bg-primary': '#EBF0FF',
        'bg-secondary': '#FFFFFF',
        'bg-tertiary': '#F5F7FF',
        'bg-card': '#FFFFFF',
        'bg-glass': 'rgba(255, 255, 255, 0.7)',
        'bg-input': 'rgba(235, 240, 255, 0.05)',
        'bg-hover': 'rgba(45, 40, 75, 0.05)',
        'bg-active': 'rgba(150, 135, 245, 0.1)',
        'border-default': 'rgba(45, 40, 75, 0.08)',
        'border-hover': 'rgba(150, 135, 245, 0.2)',
        'border-active': 'rgba(150, 135, 245, 0.3)',
        'shadow-sm': 'rgba(45, 40, 75, 0.08)',
        'shadow-md': 'rgba(45, 40, 75, 0.12)',
        'shadow-lg': 'rgba(45, 40, 75, 0.15)',
        'shadow-glow': 'rgba(150, 135, 245, 0.2)',
      },
      fontFamily: {
        serif: ['Lora', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-crimson': 'pulse-crimson 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'pulse-crimson': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
};
