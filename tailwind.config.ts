import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui'],
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        // Navy/Gold Design System
        primary: {
          DEFAULT: '#001321',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#B19365',
          foreground: '#FFFFFF',
        },
        'accent-light': '#C9AD82',
        'accent-lighter': '#E8D9C2',
        'accent-lightest': '#F5EDE1',
        success: {
          DEFAULT: '#2E7D32',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#F57C00',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#C62828',
          foreground: '#FFFFFF',
        },
        info: {
          DEFAULT: '#1565C0',
          foreground: '#FFFFFF',
        },
        background: '#F8F9FA',
        foreground: '#001321',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#001321',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#001321',
        },
        muted: {
          DEFAULT: '#F1F3F5',
          foreground: '#6B7280',
        },
        secondary: {
          DEFAULT: '#F1F3F5',
          foreground: '#001321',
        },
        border: '#E9ECEF',
        input: '#E9ECEF',
        ring: '#B19365',
        chart: {
          1: '#001321',
          2: '#B19365',
          3: '#F57C00',
          4: '#2E7D32',
          5: '#1565C0',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,19,33,0.08)',
        md: '0 4px 12px rgba(0,19,33,0.10)',
        lg: '0 8px 30px rgba(0,19,33,0.12)',
        xl: '0 16px 50px rgba(0,19,33,0.16)',
        card: '0 2px 8px rgba(0,19,33,0.06), 0 0 1px rgba(0,19,33,0.1)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        skeleton: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.3s ease-out',
        shake: 'shake 0.3s ease-in-out',
        skeleton: 'skeleton 2s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
