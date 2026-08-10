/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts,scss}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      colors: {
        accent: {
          DEFAULT: '#0ea5e9',
          hover: '#0284c7',
          muted: 'rgba(14,165,233,0.12)',
        },
        'accent-ai': '#a78bfa',
        sidebar: '#0f172a',
        topbar: '#0d1424',
        mmg: '#d97706',
        smsc: '#dc2626',
        smpps: '#2563eb',
        smppc: '#4f46e5',
        dmc: '#16a34a',
        severity: {
          critical: '#ef4444',
          high: '#f59e0b',
          medium: '#3b82f6',
          low: '#22c55e',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
        panel: '0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04)',
        glow: '0 0 0 3px rgba(14,165,233,.2)',
      },
      borderRadius: {
        card: '12px',
        xl2: '20px',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 250ms ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow': 'spin 2s linear infinite',
        'ping-slow': 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
        flow: 'flow 1.4s linear infinite',
        blink: 'blink 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        flow: {
          from: { strokeDashoffset: '0' },
          to: { strokeDashoffset: '-48' },
        },
        blink: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
      },
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
        '120': '30rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
    },
  },
  plugins: [],
};
