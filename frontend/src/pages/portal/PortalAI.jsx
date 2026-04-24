import React, { useState, useRef, useEffect } from 'react';
import { getProperties, getCashflow, netCashflow, lastNMonths } from '../../utils/portalStorage';

const MODEL = 'claude-opus-4-6';

const SUGGESTED = [
  'What type of property should I buy next based on my portfolio?',
  'Am I over-leveraged given current market conditions?',
  'Which property has the best ROI and why?',
  'What Atlanta zip codes should I target for my next acquisition?',
  'How can I improve my monthly cash flow without selling?',
  'Give me a 2-year portfolio growth strategy.',
];

function buildPortfolioContext(properties, cashflow) {
  const months = lastNMonths(3);
  const currentMonth = months[months.length - 1];

  const props = properties.map((p) => {
    const equity   = (p.currentValue || 0) - (p.mortgageBalance || 0);
    const gain     = (p.currentValue || 0) - (p.purchasePrice || 0);
    const gainPct  = p.purchasePrice > 0 ? ((gain / p.purchasePrice) * 100).toFixed(1) : 0;
    const cf       = cashflow[p.id]?.[currentMonth];
    const monthly  = cf ? netCashflow(cf) : null;

    return {
      address:        p.address,
      purchaseDate:   p.purchaseDate,
      purchasePrice:  p.purchasePrice,
      currentValue:   p.currentValue,
      mortgageBalance: p.mortgageBalance,
      equity,
      unrealizedGain: gain,
      gainPercent:    gainPct + '%',
      propertyType:   p.propertyType,
      status:         p.status,
      monthlyNetCashFlow: monthly !== null ? `$${monthly}` : 'not entered',
      notes:          p.notes,
    };
  });

  const totalValue  = properties.reduce((s, p) => s + (p.currentValue || 0), 0);
  const totalEquity = properties.reduce((s, p) => s + Math.max(0, (p.currentValue || 0) - (p.mortgageBalance || 0)), 0);
  const totalDebt   = properties.reduce((s, p) => s + (p.mortgageBalance || 0), 0);
  const totalGain   = properties.reduce((s, p) => s + ((p.currentValue || 0) - (p.purchasePrice || 0)), 0);

  return {
    summary: {
      totalProperties: properties.length,
      totalPortfolioValue:  `$${totalValue.toLocaleString()}`,
      totalEquity:          `$${totalEquity.toLocaleString()}`,
      totalDebt:            `$${totalDebt.toLocaleString()}`,
      ltvRatio:             totalValue > 0 ? `${((totalDebt / totalValue) * 100).toFixed(1)}%` : '0%',
      totalUnrealizedGain:  `$${totalGain.toLocaleString()}`,
      market:               'Atlanta, Georgia metro',
    },
    properties: props,
  };
}

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: '1rem' }}>
      <div style={{
        maxWidth: '78%', padding: '0.875rem 1.125rem', borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? 'linear-gradient(135deg, rgba(201,168,76,0.18), rgba(201,168,76,0.1))' : 'rgba(255,255,255,0.04)',
        border: isUser ? '1px solid rgba(201,168,76,0.25)' : '1px solid rgba(255,255,255,0.07)',
        color: '#E8ECF4', fontSize: '0.875rem', lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
      <div style={{ fontSize: '0.68rem', color: '#374151', marginTop: '0.3rem', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
        {isUser ? 'You' : 'Portfolio AI'}
      </div>
    </div>
  );
}

export default function PortalAI() {
  const [properties]  = useState(() => getProperties());
  const [cashflow]    = useState(() => getCashflow());
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const bottomRef = useRef(null);

  const portfolioContext = buildPortfolioContext(properties, cashflow);

  const systemPrompt = `You are Portfolio AI, an expert real estate investment advisor embedded in Joseph Esfandiari Real Estate's private investor portal.

The investor's current portfolio:
${JSON.stringify(portfolioContext, null, 2)}

Provide specific, data-driven real estate investment advice. Reference their actual portfolio numbers when relevant. Be direct and sophisticated — this investor is experienced and data-oriented. Focus on the Atlanta, Georgia metro area. Format your responses with clear structure. Use dollar figures and percentages when making recommendations.`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const content = text || input.trim();
    if (!content || loading) return;

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setError('Set VITE_ANTHROPIC_API_KEY in your .env file to enable Portfolio AI.');
      return;
    }

    setInput('');
    setError('');
    const newMessages = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const reply = data.content?.[0]?.text || 'No response received.';
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(`Failed to reach Portfolio AI: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'calc(100vh - 120px)', minHeight: '500px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.6rem', fontWeight: 700, color: '#E8ECF4', marginBottom: '0.25rem' }}>Portfolio AI</h1>
          <p style={{ color: '#4A5568', fontSize: '0.82rem' }}>Your AI-powered portfolio advisor · Powered by Claude</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ padding: '0.25rem 0.6rem', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {MODEL}
          </span>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} style={{ padding: '0.25rem 0.6rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', color: '#6B7280', fontSize: '0.75rem', cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Context panel */}
        <div style={{ width: '260px', flexShrink: 0, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}
          className="portal-ai-context"
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#4A5568' }}>Portfolio Context</div>

          {Object.entries(portfolioContext.summary).map(([k, v]) => {
            const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
            return (
              <div key={k}>
                <div style={{ fontSize: '0.65rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.15rem' }}>{label}</div>
                <div style={{ fontSize: '0.875rem', color: '#C9A84C', fontWeight: 600 }}>{v}</div>
              </div>
            );
          })}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.875rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#4A5568', marginBottom: '0.5rem' }}>Properties</div>
            {portfolioContext.properties.map((p, i) => (
              <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.78rem', color: '#9CA3AF', lineHeight: 1.3 }}>{p.address.split(',')[0]}</div>
                <div style={{ fontSize: '0.72rem', color: '#4A5568', marginTop: '0.1rem' }}>
                  {p.currentValue ? `$${Number(p.currentValue).toLocaleString()}` : '—'} · {p.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px 14px 0 0', minHeight: 0 }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '2rem' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div style={{ color: '#E8ECF4', fontSize: '1rem', fontFamily: '"Playfair Display", serif', marginBottom: '0.4rem' }}>Portfolio AI is ready</div>
                <div style={{ color: '#4A5568', fontSize: '0.82rem', marginBottom: '1.5rem' }}>Your portfolio is loaded. Ask anything about your investments.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', maxWidth: '500px' }}>
                  {SUGGESTED.map((s) => (
                    <button key={s} onClick={() => sendMessage(s)} style={{ padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', color: '#6B7280', fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)'; e.currentTarget.style.color = '#C9A84C'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#6B7280'; }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4A5568', fontSize: '0.82rem', padding: '0.5rem 0' }}>
                <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>Portfolio AI is thinking</span>
                <span style={{ display: 'flex', gap: '3px' }}>
                  {[0, 0.2, 0.4].map((d) => (
                    <span key={d} style={{ width: 4, height: 4, borderRadius: '50%', background: '#C9A84C', display: 'inline-block', animation: `bounce 1s ${d}s ease-in-out infinite` }} />
                  ))}
                </span>
              </div>
            )}

            {error && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#F87171', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your portfolio, Atlanta market, deal analysis..."
                rows={2}
                style={{
                  flex: 1, padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                  color: '#E8ECF4', fontSize: '0.875rem', outline: 'none', resize: 'none', fontFamily: '"Inter", sans-serif', lineHeight: 1.5,
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                style={{
                  padding: '0.75rem 1.25rem', background: input.trim() && !loading ? 'linear-gradient(135deg, #C9A84C, #D9BD6A)' : 'rgba(255,255,255,0.05)',
                  border: 'none', borderRadius: '10px', color: input.trim() && !loading ? '#0A0F1E' : '#374151',
                  fontWeight: 700, fontSize: '0.875rem', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                Send
              </button>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#374151', marginTop: '0.5rem' }}>Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @media (max-width: 767px) { .portal-ai-context { display: none !important; } }
      `}</style>
    </div>
  );
}
