import React, { useState, useRef, useEffect } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useInView,
} from 'framer-motion';
import LeadForm from '../components/LeadForm';

// ─── Video sources — drop MP4s into frontend/public/videos/ ──────────────────
const HERO_VIDEOS = [
  '/videos/hero-1.mp4',
  '/videos/hero-2.mp4',
  '/videos/hero-3.mp4',
  '/videos/hero-4.mp4',
];

// ─── Pinned strengths data ────────────────────────────────────────────────────
const STRENGTHS = [
  {
    num: '01',
    label: 'Intelligence',
    headline: ['Every deal,', 'scored.'],
    body: 'Our AI engine evaluates pricing, timing, and neighborhood velocity so you act with conviction, not guesswork. No more blind offers.',
    video: '/videos/hero-1.mp4',
  },
  {
    num: '02',
    label: 'Access',
    headline: ['Off-market,', 'before it lists.'],
    body: "Deep relationships with Atlanta's most active sellers mean we surface deals your competition never sees — days or weeks before the MLS.",
    video: '/videos/hero-2.mp4',
  },
  {
    num: '03',
    label: 'Velocity',
    headline: ['Offer to close,', 'frictionless.'],
    body: 'Digital contracts, streamlined due diligence, and a process built for speed. We move at the pace your portfolio demands.',
    video: '/videos/hero-3.mp4',
  },
  {
    num: '04',
    label: 'Partnership',
    headline: ['Your ROI is', 'our strategy.'],
    body: "Every transaction is the foundation of a long-term relationship. We don't close and disappear — we scale alongside your ambitions.",
    video: '/videos/hero-4.mp4',
  },
];

// ─── Scroll reveal ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 24 }}
      transition={{ duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Apple-style pinned scroll strengths ─────────────────────────────────────
function StrengthsSection() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Panel opacity + y — each panel occupies 0.25 of scroll range
  // Panel 0: visible from 0 → 0.25 (already full, fades out 0.20–0.25)
  const op0 = useTransform(scrollYProgress, [0, 0.20, 0.25], [1, 1, 0]);
  const y0  = useTransform(scrollYProgress, [0, 0.20, 0.25], [0, 0, -24]);

  // Panel 1: fades in 0.20–0.25, fades out 0.45–0.50
  const op1 = useTransform(scrollYProgress, [0.20, 0.25, 0.45, 0.50], [0, 1, 1, 0]);
  const y1  = useTransform(scrollYProgress, [0.20, 0.25, 0.45, 0.50], [24, 0, 0, -24]);

  // Panel 2: fades in 0.45–0.50, fades out 0.70–0.75
  const op2 = useTransform(scrollYProgress, [0.45, 0.50, 0.70, 0.75], [0, 1, 1, 0]);
  const y2  = useTransform(scrollYProgress, [0.45, 0.50, 0.70, 0.75], [24, 0, 0, -24]);

  // Panel 3: fades in 0.70–0.75, stays visible to end
  const op3 = useTransform(scrollYProgress, [0.70, 0.75, 1], [0, 1, 1]);
  const y3  = useTransform(scrollYProgress, [0.70, 0.75], [24, 0]);

  const opacities = [op0, op1, op2, op3];
  const ys = [y0, y1, y2, y3];

  // Video background opacities (slightly ahead of text)
  const vop0 = useTransform(scrollYProgress, [0, 0.22, 0.25], [1, 1, 0]);
  const vop1 = useTransform(scrollYProgress, [0.22, 0.25, 0.47, 0.50], [0, 1, 1, 0]);
  const vop2 = useTransform(scrollYProgress, [0.47, 0.50, 0.72, 0.75], [0, 1, 1, 0]);
  const vop3 = useTransform(scrollYProgress, [0.72, 0.75, 1], [0, 1, 1]);
  const videoOpacities = [vop0, vop1, vop2, vop3];

  // Active panel for progress indicator
  const [activePanel, setActivePanel] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (v < 0.25) setActivePanel(0);
    else if (v < 0.50) setActivePanel(1);
    else if (v < 0.75) setActivePanel(2);
    else setActivePanel(3);
  });

  return (
    <section ref={containerRef} style={{ height: '300vh', position: 'relative' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>

        {/* Video layers */}
        {STRENGTHS.map((s, i) => (
          <motion.video
            key={i}
            autoPlay
            muted
            loop
            playsInline
            style={{ opacity: videoOpacities[i] }}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          >
            <source src={s.video} type="video/mp4" />
          </motion.video>
        ))}

        {/* Directional overlay — darker left for text legibility, lighter right to show video */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, rgba(5,8,18,0.94) 0%, rgba(5,8,18,0.78) 40%, rgba(5,8,18,0.40) 100%)',
          }}
        />
        {/* Bottom fade into next section */}
        <div
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #0A0F1E, transparent)' }}
        />

        {/* Section eyebrow — top left */}
        <div
          className="absolute top-10 left-8 md:left-16 hidden md:block"
          style={{ color: '#374151', fontSize: '0.68rem', letterSpacing: '0.22em', textTransform: 'uppercase' }}
        >
          Our Approach
        </div>

        {/* Text panels */}
        {STRENGTHS.map((s, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 flex items-center pointer-events-none"
            style={{ opacity: opacities[i] }}
          >
            <div className="max-w-7xl mx-auto px-8 md:px-16 w-full">
              <motion.div style={{ y: ys[i] }} className="max-w-xl">

                {/* Number + label */}
                <div className="flex items-center gap-4 mb-8">
                  <span
                    style={{
                      fontFamily: '"Playfair Display", serif',
                      fontSize: '0.8rem',
                      color: '#C9A84C',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {s.num}
                  </span>
                  <div style={{ width: '32px', height: '1px', background: '#C9A84C', opacity: 0.5 }} />
                  <span
                    style={{
                      color: '#C9A84C',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.label}
                  </span>
                </div>

                {/* Headline */}
                <h2
                  style={{
                    fontFamily: '"Playfair Display", serif',
                    fontSize: 'clamp(48px, 6.5vw, 80px)',
                    fontWeight: 700,
                    color: '#F0F4FC',
                    lineHeight: 1.05,
                    letterSpacing: '-0.02em',
                    marginBottom: '1.75rem',
                  }}
                >
                  {s.headline[0]}
                  <br />
                  {s.headline[1]}
                </h2>

                {/* Body */}
                <p
                  style={{
                    color: '#8892A4',
                    fontSize: 'clamp(15px, 1.1vw, 18px)',
                    lineHeight: 1.75,
                    maxWidth: '420px',
                  }}
                >
                  {s.body}
                </p>
              </motion.div>
            </div>
          </motion.div>
        ))}

        {/* Progress indicator — right edge */}
        <div
          className="absolute right-8 md:right-12 top-1/2 -translate-y-1/2 flex flex-col gap-3"
        >
          {STRENGTHS.map((_, i) => (
            <div
              key={i}
              style={{
                width: '2px',
                height: i === activePanel ? '36px' : '14px',
                background:
                  i === activePanel
                    ? 'linear-gradient(to bottom, #C9A84C, #D9BD6A)'
                    : 'rgba(255,255,255,0.12)',
                borderRadius: '2px',
                transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          ))}
        </div>

        {/* Panel count — bottom left */}
        <div
          className="absolute bottom-12 left-8 md:left-16"
          style={{ color: '#374151', fontSize: '0.72rem', letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums' }}
        >
          {String(activePanel + 1).padStart(2, '0')} / {String(STRENGTHS.length).padStart(2, '0')}
        </div>

        {/* Scroll hint — bottom center (fades as user scrolls) */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ opacity: useTransform(scrollYProgress, [0, 0.1], [1, 0]) }}
        >
          <span style={{ color: '#374151', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          >
            <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
              <rect x="1" y="1" width="12" height="18" rx="6" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
              <motion.rect
                x="5.5" y="4" width="3" height="5" rx="1.5"
                fill="rgba(255,255,255,0.35)"
                animate={{ y: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              />
            </svg>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}

// ─── Contact form ─────────────────────────────────────────────────────────────
function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-10">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.06)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#C9A84C' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="font-semibold text-lg mb-2" style={{ color: '#E8ECF4' }}>Message received.</div>
        <div style={{ color: '#6B7280', fontSize: '0.88rem' }}>Joseph will follow up within 24 hours.</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label
            className="block mb-2"
            style={{ color: '#4A5568', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase' }}
          >
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
            className="w-full rounded-xl px-4 py-3 text-sm transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#E8ECF4',
              outline: 'none',
            }}
            onFocus={(e) => { e.target.style.border = '1px solid rgba(201,168,76,0.4)'; }}
            onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; }}
          />
        </div>
        <div>
          <label
            className="block mb-2"
            style={{ color: '#4A5568', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase' }}
          >
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
            className="w-full rounded-xl px-4 py-3 text-sm transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#E8ECF4',
              outline: 'none',
            }}
            onFocus={(e) => { e.target.style.border = '1px solid rgba(201,168,76,0.4)'; }}
            onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; }}
          />
        </div>
      </div>
      <div>
        <label
          className="block mb-2"
          style={{ color: '#4A5568', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase' }}
        >
          What are you working toward?
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          placeholder="Buying, selling, portfolio growth, off-market deals — tell me where you want to go."
          className="w-full rounded-xl px-4 py-3 text-sm transition-all resize-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#E8ECF4',
            outline: 'none',
          }}
          onFocus={(e) => { e.target.style.border = '1px solid rgba(201,168,76,0.4)'; }}
          onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; }}
        />
      </div>
      <button
        type="submit"
        className="w-full font-semibold py-4 rounded-xl text-sm tracking-wide transition-all duration-300 hover:-translate-y-0.5"
        style={{ background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', color: '#0A0F1E' }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 40px rgba(201,168,76,0.28)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        Send Message
      </button>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const LandingPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [leadType, setLeadType] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Hero video crossfade
  const [videoIndex, setVideoIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const currentVideoRef = useRef(null);
  const nextVideoRef = useRef(null);

  const handleVideoEnd = () => {
    setIsCrossfading(true);
    setTimeout(() => {
      setVideoIndex(nextIndex);
      setNextIndex((nextIndex + 1) % HERO_VIDEOS.length);
      setIsCrossfading(false);
    }, 800);
  };

  useEffect(() => {
    if (nextVideoRef.current) nextVideoRef.current.load();
  }, [nextIndex]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (showForm && leadType) {
    return <LeadForm initialLeadType={leadType} />;
  }

  return (
    <div style={{ backgroundColor: '#0A0F1E', color: '#E8ECF4', fontFamily: '"Inter", sans-serif' }}>

      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={
          scrolled
            ? { background: 'rgba(8,12,22,0.90)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }
            : {}
        }
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <div className="flex items-center justify-between py-5">

            <a href="/" className="flex items-center gap-3 group">
             <svg id="logoB" viewBox="0 0 268 48" width="268" height="48" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="8" width="3.5" height="30" fill="#C9A84C"/>
              <rect x="6" y="8" width="28" height="3.5" fill="#C9A84C"/>
              <rect x="30.5" y="8" width="3.5" height="30" fill="#C9A84C"/>
              <path d="M6,36 Q6,44 14,44 Q20,44 20,36" fill="none" stroke="#C9A84C" stroke-width="3.5" stroke-linecap="round"/>
              <rect x="30.5" y="22" width="11" height="3" fill="#C9A84C"/>
              <rect x="30.5" y="35" width="15" height="3.5" fill="#C9A84C"/>
              <line x1="52" y1="10" x2="52" y2="38" stroke="#C9A84C" stroke-width="0.6" opacity="0.35"/>
              <text x="64" y="27" font-family="Georgia,'Times New Roman',serif" font-size="15" fill="#FFFFFF" letter-spacing="1.5">Joseph Esfandiari</text>
              <text x="64" y="41" font-family="Georgia,'Times New Roman',serif" font-size="8.5" fill="#C9A84C" letter-spacing="4">REAL ESTATE</text>
            </svg>
            </a>

            <div className="hidden md:flex items-center gap-8">
              {[
                { label: 'Services', href: '#services' },
                { label: 'About', href: '#about' },
                { label: 'HomeMatch AI', href: '/homematch' },
                { label: 'Contact', href: '#contact' },
              ].map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="transition-colors text-sm"
                  style={{ color: '#6B7280' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#E8ECF4'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#6B7280'; }}
                >
                  {l.label}
                </a>
              ))}
              <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)' }} />
              <a
                href="#contact"
                className="text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', color: '#0A0F1E' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(201,168,76,0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                Book a Call
              </a>
              <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)' }} />
              {/* Crest — top right */}
              <a href="/portal" title="Investor Portal" style={{ opacity: 0.7, transition: 'opacity 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
              >
                <svg viewBox="0 0 120 120" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="60,5 115,60 60,115 5,60" fill="none" stroke="#C9A84C" strokeWidth="1.2"/>
                  <polygon points="60,17 103,60 60,103 17,60" fill="none" stroke="#C9A84C" strokeWidth="0.5" opacity="0.3"/>
                  <text x="60" y="66" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontSize="28" fill="#C9A84C" letterSpacing="4">JE</text>
                  <text x="60" y="79" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontSize="6" fill="#C9A84C" letterSpacing="2.5" opacity="0.6">ATLANTA · GEORGIA</text>
                </svg>
              </a>
            </div>

            <button
              className="md:hidden p-1 transition-colors"
              style={{ color: '#6B7280' }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>

          {mobileOpen && (
            <div className="md:hidden pb-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="flex flex-col gap-1 pt-4">
                {[
                  { label: 'Services', href: '#services' },
                  { label: 'About', href: '#about' },
                  { label: 'HomeMatch AI', href: '/homematch' },
                  { label: 'Contact', href: '#contact' },
                  { label: 'Agent Login', href: '/realtor-login' },
                ].map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="py-3 px-2 text-sm rounded-lg transition-colors"
                    style={{ color: '#6B7280' }}
                  >
                    {l.label}
                  </a>
                ))}
                <a
                  href="#contact"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 text-center font-semibold py-3 rounded-xl text-sm"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', color: '#0A0F1E' }}
                >
                  Book a Strategy Call
                </a>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

        {/* Crossfading video background */}
        <div className="absolute inset-0" style={{ background: '#050810' }}>
          <video
            ref={currentVideoRef}
            key={videoIndex}
            autoPlay muted playsInline
            onEnded={handleVideoEnd}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: isCrossfading ? 0 : 1, transition: 'opacity 0.8s ease-in-out' }}
          >
            <source src={HERO_VIDEOS[videoIndex]} type="video/mp4" />
          </video>
          <video
            ref={nextVideoRef}
            key={`n-${nextIndex}`}
            autoPlay={isCrossfading}
            muted playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: isCrossfading ? 1 : 0, transition: 'opacity 0.8s ease-in-out' }}
          >
            <source src={HERO_VIDEOS[nextIndex]} type="video/mp4" />
          </video>

          {/* Cinematic overlay */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(5,8,16,0.55) 0%, rgba(5,8,16,0.45) 50%, rgba(5,8,16,0.80) 100%)' }}
          />
          {/* Bottom bleed */}
          <div
            className="absolute bottom-0 left-0 right-0 h-56"
            style={{ background: 'linear-gradient(to top, #0A0F1E, transparent)' }}
          />
        </div>

        {/* Hero text */}
        <div className="relative max-w-5xl mx-auto px-6 sm:px-10 pt-40 pb-36 text-center">

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full mb-12"
            style={{
              border: '1px solid rgba(201,168,76,0.22)',
              background: 'rgba(201,168,76,0.07)',
              color: '#C9A84C',
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: '#C9A84C', animation: 'pulse 2s infinite' }}
            />
            Atlanta Metro · Licensed GA Realtor
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: 'clamp(52px, 9vw, 110px)',
              fontWeight: 700,
              lineHeight: 1.0,
              letterSpacing: '-0.025em',
              color: '#F0F4FC',
              marginBottom: '1.75rem',
            }}
          >
            Invest Smarter.
            <br />
            <span
              style={{
                background: 'linear-gradient(120deg, #C9A84C 10%, #F0D080 50%, #C9A84C 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Close Faster.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.5 }}
            style={{ color: 'rgba(232,236,244,0.65)', fontSize: 'clamp(16px, 1.3vw, 20px)', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto 3rem' }}
          >
            Atlanta's most sophisticated brokerage — built for investors, powered by AI, and relentlessly focused on your returns.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a
              href="#contact"
              className="group inline-flex items-center justify-center gap-2 font-semibold text-sm px-8 py-4 rounded-xl transition-all duration-300 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', color: '#0A0F1E' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 10px 44px rgba(201,168,76,0.38)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              Book a Strategy Call
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a
              href="#services"
              className="inline-flex items-center justify-center font-medium text-sm px-8 py-4 rounded-xl transition-all duration-300 hover:-translate-y-0.5"
              style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#E8ECF4', background: 'rgba(255,255,255,0.04)' }}
            >
              View Services
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────────────── */}
      <section style={{ background: '#0D1220', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '50+', label: 'Deals Closed' },
              { value: '10+', label: 'Years in Markets' },
              { value: '$25M+', label: 'Transaction Volume' },
              { value: '100%', label: 'Client-Focused' },
            ].map((s) => (
              <Reveal key={s.label}>
                <div
                  style={{
                    fontFamily: '"Playfair Display", serif',
                    fontSize: 'clamp(26px, 3.5vw, 40px)',
                    fontWeight: 700,
                    color: '#E8ECF4',
                    lineHeight: 1.1,
                    marginBottom: '0.4rem',
                  }}
                >
                  {s.value}
                </div>
                <div style={{ color: '#374151', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {s.label}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PINNED SCROLL STRENGTHS ────────────────────────────────────────── */}
      <StrengthsSection />

      {/* ── SERVICES ──────────────────────────────────────────────────────── */}
      <section id="services" style={{ background: '#0A0F1E', padding: '8rem 0' }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10">

          <Reveal>
            <div style={{ color: '#C9A84C', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Services
            </div>
            <h2
              style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 700, color: '#E8ECF4', marginBottom: '5rem', lineHeight: 1.1 }}
            >
              Every angle<br />of the deal.
            </h2>
          </Reveal>

          <div>
            {[
              {
                num: '01',
                title: 'Buy with Confidence',
                tag: 'Buyers',
                desc: 'From single-family to multi-unit, we help you move fast on the right properties. AI-scored deals, off-market access, and negotiation built around your ROI.',
                type: 'buyer',
              },
              {
                num: '02',
                title: 'Sell for Maximum Value',
                tag: 'Sellers',
                desc: 'Precision pricing backed by real market data. We position your property to attract serious buyers and close at full value — no guesswork, no lowballs.',
                type: 'seller',
              },
              {
                num: '03',
                title: 'Build Your Portfolio',
                tag: 'Investors',
                desc: 'Deal flow analysis, cap rate modeling, and investor-grade due diligence. Whether you are at deal one or deal twenty, we scale alongside your ambitions.',
                type: 'buyer',
              },
            ].map((svc, i) => (
              <Reveal key={svc.num} delay={i * 0.06}>
                <div
                  className="group"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '2.5rem 0', cursor: 'pointer' }}
                  onClick={() => { setLeadType(svc.type); setShowForm(true); }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderTopColor = 'rgba(201,168,76,0.2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.06)'; }}
                >
                  <div className="grid md:grid-cols-12 gap-6 items-start">
                    <div className="md:col-span-1">
                      <span style={{ color: '#2D3748', fontFamily: '"Playfair Display", serif', fontSize: '0.82rem', letterSpacing: '0.04em' }}>{svc.num}</span>
                    </div>
                    <div className="md:col-span-4">
                      <div className="flex items-center gap-3">
                        <span
                          style={{
                            fontFamily: '"Playfair Display", serif',
                            fontSize: 'clamp(20px, 2.2vw, 28px)',
                            fontWeight: 700,
                            color: '#E8ECF4',
                            lineHeight: 1.2,
                            transition: 'color 0.2s',
                          }}
                          className="group-hover:text-white"
                        >
                          {svc.title}
                        </span>
                      </div>
                    </div>
                    <div className="md:col-span-5">
                      <p style={{ color: '#6B7280', fontSize: '0.9rem', lineHeight: 1.75 }}>{svc.desc}</p>
                    </div>
                    <div className="md:col-span-2 flex items-start justify-end">
                      <span
                        className="flex items-center gap-1.5 text-sm font-medium transition-all duration-200 group-hover:gap-2.5"
                        style={{ color: '#C9A84C' }}
                      >
                        Get Started
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
          </div>
        </div>
      </section>

      {/* ── HOMEMATCH AI ──────────────────────────────────────────────────── */}
      <section style={{ background: '#060A14', padding: '8rem 0', position: 'relative', overflow: 'hidden' }}>
        {/* Blue glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '700px', height: '400px',
            background: 'radial-gradient(ellipse, rgba(58,125,255,0.1) 0%, transparent 70%)',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 sm:px-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            <Reveal>
              <div style={{ color: '#3A7DFF', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                HomeMatch AI
              </div>
              <h2
                style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 700, color: '#E8ECF4', lineHeight: 1.1, marginBottom: '1.5rem' }}
              >
                The intelligence layer behind every deal.
              </h2>
              <p style={{ color: '#6B7280', fontSize: '1rem', lineHeight: 1.8, marginBottom: '2.5rem' }}>
                HomeMatch AI is our proprietary platform that scores leads, analyzes deal quality, and matches clients with the right agents — automatically. It is what separates this brokerage from every other firm in Atlanta.
              </p>
              <a
                href="/homematch"
                className="group inline-flex items-center gap-2 font-semibold text-sm px-7 py-4 rounded-xl transition-all duration-300 hover:-translate-y-0.5"
                style={{ background: '#3A7DFF', color: '#fff' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 36px rgba(58,125,255,0.38)'; e.currentTarget.style.background = '#2A6DEF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#3A7DFF'; }}
              >
                Join the Waitlist
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { title: 'Lead Scoring Engine', desc: 'Every inquiry scored 1–10 on readiness, intent, and deal quality. Stop chasing dead-end leads.' },
                  { title: 'Smart Agent Matching', desc: 'Pairs clients with the right agent based on market expertise, availability, and performance history.' },
                  { title: 'Deal Intelligence', desc: 'Real-time comps, velocity data, and AI-powered pricing guidance — all in one dashboard.' },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="p-5 rounded-xl"
                    style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div style={{ color: '#6BA3FF', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      {item.title}
                    </div>
                    <div style={{ color: '#6B7280', fontSize: '0.87rem', lineHeight: 1.7 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── ABOUT ─────────────────────────────────────────────────────────── */}
      <section id="about" style={{ background: '#0A0F1E', padding: '8rem 0' }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">

            <Reveal>
              <div style={{ color: '#C9A84C', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                About
              </div>
              <h2
                style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 700, color: '#E8ECF4', lineHeight: 1.1, marginBottom: '1.75rem' }}
              >
                Not your average agent.
              </h2>
              <p style={{ color: '#6B7280', fontSize: '0.97rem', lineHeight: 1.85, marginBottom: '1.2rem' }}>
                Joseph Esfandiari is a Georgia-licensed real estate agent, software developer, and entrepreneur with over a decade of experience in financial markets. He approaches real estate the way sophisticated investors approach any asset class: with data, discipline, and a relentless focus on returns.
              </p>
              <p style={{ color: '#6B7280', fontSize: '0.97rem', lineHeight: 1.85 }}>
                Building toward the 2026 launch of his own brokerage, Joseph combines deep market knowledge with the technical edge most firms simply don't have. If you want an agent who understands cap rates as well as closing costs, this is the team.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Licensed', value: 'Georgia' },
                  { label: 'Market Focus', value: 'Atlanta Metro' },
                  { label: 'Investing Since', value: '2013' },
                  { label: 'Background', value: 'Tech & Finance' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-5 rounded-xl"
                    style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div style={{ color: '#4A5568', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      {item.label}
                    </div>
                    <div style={{ color: '#E8ECF4', fontSize: '0.97rem', fontWeight: 500 }}>{item.value}</div>
                  </div>
                ))}

                {/* Status card spans full width */}
                <div
                  className="col-span-2 p-5 rounded-xl flex items-center gap-4"
                  style={{ border: '1px solid rgba(16,185,129,0.15)', background: 'rgba(16,185,129,0.04)' }}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.6)', animation: 'pulse 2s infinite' }}
                  />
                  <div>
                    <div style={{ color: '#34D399', fontSize: '0.78rem', fontWeight: 600 }}>Currently accepting new clients</div>
                    <div style={{ color: '#4A5568', fontSize: '0.78rem' }}>Woodstock, GA — Atlanta metro coverage</div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CONTACT ───────────────────────────────────────────────────────── */}
      <section id="contact" style={{ background: '#070B14', padding: '8rem 0', position: 'relative', overflow: 'hidden' }}>
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: 0, left: '50%',
            transform: 'translateX(-50%)',
            width: '500px', height: '250px',
            background: 'radial-gradient(ellipse, rgba(201,168,76,0.06) 0%, transparent 70%)',
          }}
        />
        <div className="relative max-w-3xl mx-auto px-6 sm:px-10 text-center">
          <Reveal>
            <div style={{ color: '#C9A84C', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Get in Touch
            </div>
            <h2
              style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(28px, 4.5vw, 52px)', fontWeight: 700, color: '#E8ECF4', lineHeight: 1.1, marginBottom: '1.25rem' }}
            >
              Ready to make<br />your move?
            </h2>
            <p style={{ color: '#6B7280', fontSize: '1rem', marginBottom: '3rem', lineHeight: 1.7 }}>
              Whether you are buying, selling, or building a portfolio — let us talk strategy.
            </p>
            <div
              className="rounded-2xl p-8 text-left"
              style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
            >
              <ContactForm />
            </div>
            <p style={{ color: '#2D3748', fontSize: '0.78rem', marginTop: '2rem' }}>
              Woodstock, GA · Atlanta metro · By appointment
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ background: '#040711', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-14">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', color: '#0A0F1E', fontFamily: '"Playfair Display", serif' }}
                >
                  JE
                </div>
                <div>
                  <div style={{ color: '#E8ECF4', fontWeight: 600, fontSize: '0.9rem' }}>Joseph Esfandiari</div>
                  <div style={{ color: '#C9A84C', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Real Estate</div>
                </div>
              </div>
              <p style={{ color: '#374151', fontSize: '0.85rem', lineHeight: 1.7, maxWidth: '260px' }}>
                Atlanta's most sophisticated real estate brokerage. Built for investors, powered by AI.
              </p>
            </div>

            <div>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>Company</div>
              <ul className="space-y-3">
                {[
                  { label: 'About Joseph', href: '#about' },
                  { label: 'Services', href: '#services' },
                  { label: 'HomeMatch AI', href: '/homematch' },
                  { label: 'Contact', href: '#contact' },
                ].map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      style={{ color: '#374151', fontSize: '0.87rem', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#374151'; }}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>Platform</div>
              <ul className="space-y-3">
                {[
                  { label: 'Agent Login', href: '/realtor-login' },
                  { label: 'Join Our Network', href: '/realtor-signup' },
                  { label: 'Privacy Policy', href: '/privacy-policy' },
                  { label: 'Terms of Service', href: '/terms-of-service' },
                ].map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      style={{ color: '#374151', fontSize: '0.87rem', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#374151'; }}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div
            className="flex flex-col md:flex-row justify-between items-center pt-8 gap-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <p style={{ color: '#1F2937', fontSize: '0.76rem' }}>
              © {new Date().getFullYear()} Joseph Esfandiari Real Estate · GA License #[LICENSE]
            </p>
            <p style={{ color: '#1F2937', fontSize: '0.76rem' }}>
              Powered by HomeMatch AI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
