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
        primary: {
          DEFAULT: '#060A16',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#1F3A7D',
          foreground: '#FFFFFF',
        },
        success: {
          DEFAULT: '#2FC695',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#FFAA00',
          foreground: '#1E293B',
        },
        destructive: {
          DEFAULT: '#FF5555',
          foreground: '#FFFFFF',
        },
        info: {
          DEFAULT: '#3B9FFF',
          foreground: '#FFFFFF',
        },
        background: '#F8FBFF',
        foreground: '#1E293B',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#1E293B',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#1E293B',
        },
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#64748B',
        },
        secondary: {
          DEFAULT: '#F1F5F9',
          foreground: '#1E293B',
        },
        border: '#E2E8F0',
        input: '#E2E8F0',
        ring: '#1F3A7D',
        chart: {
          1: '#1E293B',
          2: '#3B82F6',
          3: '#F97316',
          4: '#10B981',
          5: '#8B5CF6',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)',
        lg: '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)',
        card: '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.1)',
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
