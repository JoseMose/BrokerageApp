import React, { useState } from 'react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Lead Scoring Engine',
    desc: 'Every inquiry scored 1–10 on readiness, intent, and deal quality. Stop chasing dead-end leads.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Smart Agent Matching',
    desc: 'Pair buyers and sellers with the right agent based on market expertise, availability, and track record.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Market Intelligence',
    desc: 'Real-time comps, deal velocity, and neighborhood-level data to price and position every property correctly.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    title: 'Automated Follow-Up',
    desc: 'AI-triggered nurture sequences that keep hot leads warm — without manual effort from your team.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Compliance Built In',
    desc: 'Fair distribution, verified credentials, and audit trails. Every deal handled with full transparency.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Instant Deployment',
    desc: 'Set up in minutes. No massive IT project, no training weeks. Plug it into your workflow and go.',
  },
];

export default function HomeMatchPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('agent');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div style={{ backgroundColor: '#0A0F1E', color: '#E8ECF4', fontFamily: '"Inter", sans-serif', minHeight: '100vh' }}>

      {/* Minimal navbar */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(10,15,30,0.95)', backdropFilter: 'blur(20px)' }}
        className="sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between py-4">
          <a href="/" className="flex items-center gap-3 group">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-transform group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', color: '#0A0F1E' }}
            >
              JE
            </div>
            <span className="font-semibold text-sm" style={{ color: '#9CA3AF' }}>← Back to site</span>
          </a>
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ border: '1px solid rgba(58,125,255,0.3)', background: 'rgba(58,125,255,0.08)', color: '#6BA3FF' }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            HomeMatch AI · Early Access
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute pointer-events-none"
          style={{
            top: '40%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '700px', height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(58,125,255,0.15) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative max-w-4xl mx-auto px-5 sm:px-8 pt-28 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8"
            style={{ border: '1px solid rgba(58,125,255,0.3)', background: 'rgba(58,125,255,0.08)', color: '#6BA3FF' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Now accepting early access applications
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-bold leading-tight mb-6"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: 'clamp(36px, 7vw, 72px)',
              color: '#E8ECF4',
            }}
          >
            Real estate intelligence,{' '}
            <span
              style={{
                background: 'linear-gradient(120deg, #3A7DFF 0%, #6BA3FF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              automated.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25 }}
            style={{ color: '#6B7280', fontSize: '1.15rem', maxWidth: '600px', margin: '0 auto 3rem', lineHeight: 1.75 }}
          >
            HomeMatch AI scores your leads, matches your clients, and surfaces deal intelligence — so you close more with less effort.
          </motion.p>

          {/* Waitlist form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            className="max-w-lg mx-auto"
          >
            {submitted ? (
              <div
                className="rounded-2xl p-10 text-center"
                style={{ border: '1px solid rgba(58,125,255,0.2)', background: 'rgba(58,125,255,0.05)' }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(58,125,255,0.15)', border: '1px solid rgba(58,125,255,0.3)' }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#6BA3FF' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="font-semibold text-lg mb-2" style={{ color: '#E8ECF4' }}>You're on the list.</div>
                <div style={{ color: '#6B7280', fontSize: '0.9rem' }}>
                  We'll reach out when early access opens. Expect something worth the wait.
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl p-6"
                style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full rounded-xl px-4 py-3 text-sm transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#E8ECF4',
                        outline: 'none',
                      }}
                      onFocus={(e) => { e.target.style.border = '1px solid rgba(58,125,255,0.5)'; }}
                      onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.1)'; }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>
                      I am a...
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'agent', label: 'Agent' },
                        { value: 'investor', label: 'Investor' },
                        { value: 'broker', label: 'Broker' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setRole(opt.value)}
                          className="py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                          style={{
                            border: role === opt.value ? '1px solid rgba(58,125,255,0.5)' : '1px solid rgba(255,255,255,0.08)',
                            background: role === opt.value ? 'rgba(58,125,255,0.12)' : 'rgba(255,255,255,0.02)',
                            color: role === opt.value ? '#6BA3FF' : '#6B7280',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full font-bold py-4 rounded-xl text-sm transition-all duration-300 hover:-translate-y-0.5"
                    style={{ background: '#3A7DFF', color: '#fff' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#2A6DEF'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(58,125,255,0.4)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#3A7DFF'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    Request Early Access
                  </button>
                  <p style={{ color: '#4A5568', fontSize: '0.78rem', textAlign: 'center' }}>
                    No credit card required · Launching 2025
                  </p>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-24" style={{ background: '#0D1424', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-16">
            <div style={{ color: '#3A7DFF', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Platform Features
            </div>
            <h2
              className="font-bold"
              style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(28px, 4vw, 44px)', color: '#E8ECF4' }}
            >
              Everything you need to close smarter.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1"
                style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.025)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(58,125,255,0.1)', border: '1px solid rgba(58,125,255,0.2)', color: '#6BA3FF' }}
                >
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-2" style={{ color: '#E8ECF4', fontSize: '0.95rem' }}>{f.title}</h3>
                <p style={{ color: '#6B7280', fontSize: '0.85rem', lineHeight: 1.7 }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24" style={{ background: '#0A0F1E' }}>
        <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
          <h2
            className="font-bold mb-4"
            style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(26px, 4vw, 42px)', color: '#E8ECF4' }}
          >
            The future of real estate is data-driven.
          </h2>
          <p style={{ color: '#6B7280', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.7 }}>
            Be among the first agents and brokers to gain an unfair advantage with HomeMatch AI.
          </p>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="inline-flex items-center gap-2 font-semibold text-sm px-8 py-4 rounded-xl transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: '#3A7DFF', color: '#fff' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 40px rgba(58,125,255,0.4)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            Join the Waitlist
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#070B16', borderTop: '1px solid rgba(255,255,255,0.04)', padding: '2rem 0' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p style={{ color: '#374151', fontSize: '0.78rem' }}>
            © {new Date().getFullYear()} Joseph Esfandiari Real Estate · HomeMatch AI
          </p>
          <a href="/" style={{ color: '#4A5568', fontSize: '0.78rem' }} className="hover:text-white transition-colors">
            ← Back to main site
          </a>
        </div>
      </footer>
    </div>
  );
}
