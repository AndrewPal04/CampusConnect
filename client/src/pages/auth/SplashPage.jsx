import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@utils/constants';

// ── Mock preview events shown on the splash screen ───────────────────────────
const PREVIEW_EVENTS = [
  {
    id: 1,
    emoji:    '🏢',
    title:    'Spring Career Fair',
    meta:     'Mar 14 · Student Union Hall',
    count:    '342 going',
    category: 'Professional',
    delay:    '0.3s',
  },
  {
    id: 2,
    emoji:    '🌮',
    title:    'Cultural Food Festival',
    meta:     'Mar 22 · Campus Quad',
    count:    '612 going',
    category: 'Cultural',
    delay:    '0.5s',
  },
  {
    id: 3,
    emoji:    '💻',
    title:    'Hackathon 2025',
    meta:     'Mar 20 · CS Building',
    count:    '256 going',
    category: 'Academic',
    delay:    '0.7s',
  },
];

// ── Animated background blob ─────────────────────────────────────────────────
function Blob({ style, delay = '0s' }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        filter: 'blur(70px)',
        opacity: 0.18,
        animation: `float 8s ease-in-out infinite`,
        animationDelay: delay,
        ...style,
      }}
    />
  );
}

// ── Individual preview event pill ────────────────────────────────────────────
function PreviewPill({ event }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.09)',
        border: '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(8px)',
        opacity: 0,
        animation: `slideUpFade 0.5s ease forwards`,
        animationDelay: event.delay,
      }}
    >
      {/* Emoji icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.12)' }}
      >
        {event.emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-white font-sans font-semibold text-sm leading-tight truncate">
          {event.title}
        </div>
        <div className="text-[0.68rem] mt-0.5 truncate" style={{ color: '#99AACC' }}>
          {event.meta}
        </div>
      </div>

      {/* Count badge */}
      <div
        className="text-[0.62rem] font-sans font-bold px-2.5 py-1 rounded-full flex-shrink-0"
        style={{ background: 'rgba(232,160,32,0.2)', color: '#E8A020' }}
      >
        {event.count}
      </div>
    </div>
  );
}

// ── Main SplashPage ───────────────────────────────────────────────────────────
export default function SplashPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger entrance animations after first paint
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <>
      {/* Keyframe definitions injected once */}
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50%       { transform: translateY(-18px) scale(1.04); }
        }
        @keyframes logoReveal {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes taglineReveal {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dividerGrow {
          from { width: 0; }
          to   { width: 48px; }
        }
        @keyframes btnReveal {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="relative flex flex-col min-h-screen overflow-hidden"
        style={{ background: 'linear-gradient(170deg, #0F1E40 0%, #1A3A6E 45%, #0F0E17 100%)' }}
      >

        {/* ── Ambient background blobs ── */}
        <Blob style={{ width: 320, height: 320, background: '#2F6BCC', top: '-80px', left: '-80px' }} delay="0s" />
        <Blob style={{ width: 220, height: 220, background: '#E8A020', bottom: '120px', right: '-60px' }} delay="3s" />
        <Blob style={{ width: 160, height: 160, background: '#4A1A8C', top: '40%', left: '15%' }} delay="1.5s" />

        {/* Subtle grain texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
            opacity: 0.4,
          }}
        />

        {/* ── Hero section ── */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8 text-center">

          {/* Logo mark */}
          <div
            className="mb-6"
            style={{
              opacity: mounted ? 1 : 0,
              animation: mounted ? 'logoReveal 0.6s ease forwards' : 'none',
            }}
          >
            {/* Wordmark */}
            <h1 className="font-display leading-none">
              <span
                className="block text-5xl font-black tracking-tight"
                style={{ color: '#E8A020' }}
              >
                Campus
              </span>
              <span
                className="block text-5xl font-black tracking-tight -mt-1"
                style={{ color: 'white' }}
              >
                Connect
              </span>
            </h1>

            {/* Animated amber underline */}
            <div className="flex justify-center mt-3">
              <div
                style={{
                  height: 3,
                  background: 'linear-gradient(90deg, #E8A020, #FFD080)',
                  borderRadius: 2,
                  animation: mounted ? 'dividerGrow 0.7s ease 0.3s forwards' : 'none',
                  width: 0,
                }}
              />
            </div>
          </div>

          {/* Tagline */}
          <p
            className="text-[0.88rem] leading-relaxed max-w-xs mb-10"
            style={{
              color: '#99AACC',
              opacity: mounted ? 1 : 0,
              animation: mounted ? 'taglineReveal 0.6s ease 0.4s forwards' : 'none',
            }}
          >
            Your campus, all in one place.{' '}
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>
              Events, friends, and experiences — centralised.
            </span>
          </p>

          {/* Preview event pills */}
          <div className="w-full max-w-sm flex flex-col gap-2.5">
            {PREVIEW_EVENTS.map((event) => (
              <PreviewPill key={event.id} event={event} />
            ))}
          </div>

          {/* Live campus indicator */}
          <div
            className="flex items-center gap-2 mt-6"
            style={{
              opacity: 0,
              animation: 'taglineReveal 0.4s ease 1.1s forwards',
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: '#2FA855',
                boxShadow: '0 0 6px #2FA855',
                animation: 'float 2s ease-in-out infinite',
              }}
            />
            <span className="text-[0.65rem] font-sans font-semibold tracking-wider uppercase"
                  style={{ color: '#66CC88' }}>
              Live events on your campus
            </span>
          </div>
        </div>

        {/* ── CTA Buttons ── */}
        <div
          className="relative z-10 px-6 pb-12 flex flex-col gap-3"
          style={{
            opacity: 0,
            animation: mounted ? 'btnReveal 0.5s ease 0.8s forwards' : 'none',
          }}
        >
          {/* Primary CTA */}
          <button
            onClick={() => navigate(ROUTES.REGISTER)}
            className="w-full py-4 rounded-2xl font-sans font-bold text-[0.95rem] tracking-wide
                       transition-all duration-150 active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #E8A020, #F0C060)',
              color: '#0F1E40',
              boxShadow: '0 6px 28px rgba(232,160,32,0.35)',
            }}
          >
            Get Started →
          </button>

          {/* Secondary CTA */}
          <button
            onClick={() => navigate(ROUTES.LOGIN)}
            className="w-full py-4 rounded-2xl font-sans font-semibold text-[0.88rem]
                       transition-all duration-150 active:scale-[0.97]"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1.5px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            I already have an account
          </button>

          {/* Organiser link */}
          <button
            onClick={() => navigate(ROUTES.REGISTER + '?type=organiser')}
            className="w-full py-3 font-sans font-medium text-[0.78rem]
                       transition-all duration-150"
            style={{ color: '#7A9ACC' }}
          >
            I'm an event organiser →
          </button>

          {/* Legal fine print */}
          <p className="text-center text-[0.62rem] leading-relaxed mt-1" style={{ color: '#4A5A7A' }}>
            By continuing you agree to our{' '}
            <span className="underline cursor-pointer" style={{ color: '#6A7A9A' }}>Terms</span>
            {' & '}
            <span className="underline cursor-pointer" style={{ color: '#6A7A9A' }}>Privacy Policy</span>
          </p>
        </div>

      </div>
    </>
  );
}
