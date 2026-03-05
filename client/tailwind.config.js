/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // ── Brand Colours ────────────────────────────────────────────────────
      colors: {
        navy: {
          DEFAULT: '#1A3A6E',
          dark:    '#0F2347',
          mid:     '#2F6BCC',
          light:   '#DDEEFF',
        },
        amber: {
          DEFAULT: '#E8A020',
          dark:    '#B87A10',
          light:   '#FDF3DD',
        },
        cream: {
          DEFAULT: '#FFFCF5',
          dark:    '#F5F0E8',
        },
        ink: '#0F0E17',
        // Status
        success: '#2FA855',
        'success-light': '#E0F7EA',
        danger:  '#CC2222',
        'danger-light':  '#FFF0F0',
        purple:  '#4A1A8C',
        'purple-light':  '#F0E8FF',
      },
      // ── Typography ────────────────────────────────────────────────────────
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:    ['Syne', 'system-ui', 'sans-serif'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      // ── Spacing / Layout ─────────────────────────────────────────────────
      maxWidth: {
        app: '430px',   // Mobile phone frame max width
      },
      borderRadius: {
        card: '20px',
        pill: '9999px',
      },
      boxShadow: {
        card:  '0 8px 40px rgba(15, 14, 23, 0.13)',
        phone: '0 0 0 2px #2a2a2a, 0 0 0 5px #111',
        float: '0 4px 24px rgba(26, 58, 110, 0.25)',
      },
      // ── Animations ────────────────────────────────────────────────────────
      keyframes: {
        fadeSlide: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        stagger: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scanLine: {
          '0%':   { top: '0', opacity: '0' },
          '10%':  { opacity: '1' },
          '90%':  { opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
      },
      animation: {
        'fade-slide': 'fadeSlide 0.3s ease forwards',
        'stagger':    'stagger 0.4s ease forwards',
        'scan-line':  'scanLine 1.8s linear infinite',
      },
    },
  },
  plugins: [],
};
