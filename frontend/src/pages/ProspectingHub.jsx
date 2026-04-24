import React, { useState, useEffect, useCallback } from 'react';
import { masterLeadsAPI, funnelAPI } from '../utils/api';

// ─── Constants ─────────────────────────────────────────────────────────────────
const FUNNEL_STAGES = [
  { id: 'new_lead',       label: 'New Lead',       color: '#C9A84C' },
  { id: 'contacted',      label: 'Contacted',      color: '#2D6A9F' },
  { id: 'appt_set',       label: 'Appt Set',       color: '#6B46C1' },
  { id: 'under_contract', label: 'Under Contract', color: '#0F766E' },
  { id: 'closed',         label: 'Closed',         color: '#15803D' },
];

const LEAD_TYPE_META = {
  expired:         { label: 'Expired',         color: '#C9A84C', bg: 'rgba(201,168,76,0.12)', border: 'rgba(201,168,76,0.3)'   },
  fsbo:            { label: 'FSBO',            color: '#6BA3FF', bg: 'rgba(58,125,255,0.1)',  border: 'rgba(58,125,255,0.25)' },
  pre_foreclosure: { label: 'Pre-Foreclosure', color: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)'  },
};

const TABS = [
  {
    id:          'expired',
    label:       'Expired Listings',
    accentColor: '#C9A84C',
    activeBg:    '#C9A84C',
    activeText:  '#0A0F1E',
    description: 'Properties whose MLS listing expired without selling. The seller is motivated but frustrated. Best approached with empathy and a strong pricing strategy argument.',
    emptyTitle:  'No expired leads in the pool yet.',
    emptyDesc:   'Check back later or contact admin to add leads.',
  },
  {
    id:          'fsbo',
    label:       'FSBO',
    accentColor: '#6BA3FF',
    activeBg:    '#2D6A9F',
    activeText:  '#FFFFFF',
    description: 'Homeowners trying to sell without an agent to avoid commission. They often struggle with pricing, marketing, and negotiation. Best approached by offering value first.',
    emptyTitle:  'No FSBO leads in the pool yet.',
    emptyDesc:   'Check back later or contact admin to add leads.',
  },
  {
    id:          'pre_foreclosure',
    label:       'Pre-Foreclosure',
    accentColor: '#F87171',
    activeBg:    '#DC2626',
    activeText:  '#FFFFFF',
    description: 'Homeowners who are behind on mortgage payments (NOD filed). They are under serious time pressure. Best approached with urgency, compassion, and a clear solution.',
    emptyTitle:  'No pre-foreclosure leads in the pool yet.',
    emptyDesc:   'Check back later or contact admin to add leads.',
  },
];

// ─── Scripts ───────────────────────────────────────────────────────────────────
const SCRIPTS = {
  expired: {
    title: 'EXPIRED LISTING SCRIPT',
    sections: [
      {
        label: 'Opening',
        text: `"Hi, is this [Name]? This is [Agent Name] with Joseph Esfandiari Real Estate.\nI'm calling because I noticed your home at [Address] recently came off the market,\nand I specialize in helping sellers who've had that experience get their home sold."`,
      },
      {
        label: 'Pain Point',
        text: `"I know it can be frustrating when a listing expires — you did everything right,\nand it still didn't sell. Usually there are 2–3 specific reasons that's happening\nin today's market, and I'd love to share what I'm seeing."`,
      },
      {
        label: 'Ask',
        text: `"Would you be open to a quick 10-minute conversation this week so I can show you\nwhat I'd do differently?"`,
      },
      {
        label: 'Objection — "I\'m taking a break from selling"',
        text: `"Completely understandable. Would it be okay if I followed up in a few weeks?\nThe market shifts fast and I'd hate for you to miss the right window."`,
      },
    ],
  },
  fsbo: {
    title: 'FSBO SCRIPT',
    sections: [
      {
        label: 'Opening',
        text: `"Hi [Name], my name is [Agent Name] with Joseph Esfandiari Real Estate.\nI'm calling about your home for sale on [Street]. Congratulations on taking\nthat step — are you still actively looking for a buyer?"`,
      },
      {
        label: 'Value Pitch',
        text: `"I work with a lot of buyers in this area and I wanted to reach out personally.\nI'm not calling to list your home — I just want to see if your property might\nbe a match for someone I'm already working with."`,
      },
      {
        label: 'Plant the Seed',
        text: `"Out of curiosity, have you had a lot of showings so far? ...\nA lot of FSBOs I talk to find that getting buyers through the door is the\nhardest part. I have some strategies that could help with that — would you\nbe open to hearing them?"`,
      },
      {
        label: 'Close',
        text: `"Could we meet for just 15 minutes? No pressure, no pitch — just want to\nshare what I'm seeing in the market right now."`,
      },
    ],
  },
  pre_foreclosure: {
    title: 'PRE-FORECLOSURE SCRIPT',
    sections: [
      {
        label: 'Opening',
        text: `"Hi, may I speak with [Name]? This is [Agent Name] with Joseph Esfandiari\nReal Estate. I'm reaching out because I work with homeowners in [City] who\nare facing some challenges with their mortgage, and I wanted to see if I\ncould help."`,
      },
      {
        label: 'Empathy First',
        text: `"I know this isn't an easy situation, and I want you to know I'm not here\nto pressure you — I just want to share some options that other homeowners\nin similar situations have used to protect their credit and equity."`,
      },
      {
        label: 'The Options',
        text: `"Depending on your timeline, there are a few paths — selling before the\nforeclosure is finalized, a short sale, or even a loan modification.\nThe most important thing is that you have options, and time matters."`,
      },
      {
        label: 'Ask',
        text: `"Would you be open to a quick call this week? Even 10 minutes could help\nclarify what your best move is right now."`,
      },
      {
        label: 'Objection — "I don\'t want to sell"',
        text: `"That's completely okay. There may be other options worth knowing about.\nCan I at least send you some information?"`,
      },
    ],
  },
};

// ─── Stat helpers ──────────────────────────────────────────────────────────────
function computeStats(tabId, funnelSubset, weekAgo) {
  const total             = funnelSubset.length;
  const contactedThisWeek = funnelSubset.filter(e =>
    (e.stage === 'contacted' || e.stage === 'appt_set') &&
    e.lastContactDate && new Date(e.lastContactDate) >= weekAgo
  ).length;
  const apptsSet = funnelSubset.filter(e => e.stage === 'appt_set').length;

  if (tabId === 'expired') {
    const totalDays = funnelSubset.reduce((sum, e) =>
      sum + Math.floor((Date.now() - new Date(e.addedAt || e.createdAt)) / 86400000), 0);
    const avgDays = total > 0 ? Math.round(totalDays / total) : 0;
    return [
      { label: 'In My Funnel',          value: total,                           color: '#C9A84C' },
      { label: 'Contacted This Week',   value: contactedThisWeek,               color: '#6BA3FF' },
      { label: 'Appointments Set',      value: apptsSet,                        color: '#A78BFA' },
      { label: 'Avg Days Since Added',  value: avgDays > 0 ? `${avgDays}d` : '—', color: '#F87171' },
    ];
  }
  if (tabId === 'fsbo') {
    return [
      { label: 'In My Funnel',        value: total,             color: '#6BA3FF' },
      { label: 'Contacted This Week', value: contactedThisWeek, color: '#C9A84C' },
      { label: 'Appointments Set',    value: apptsSet,          color: '#A78BFA' },
      { label: 'High Priority',       value: funnelSubset.filter(e => e.stage === 'new_lead').length, color: '#34D399' },
    ];
  }
  if (tabId === 'pre_foreclosure') {
    const highUrgency = funnelSubset.filter(e => !e.lastContactDate).length;
    return [
      { label: 'In My Funnel',        value: total,             color: '#F87171' },
      { label: 'Contacted This Week', value: contactedThisWeek, color: '#C9A84C' },
      { label: 'Appointments Set',    value: apptsSet,          color: '#A78BFA' },
      { label: 'High Urgency',        value: highUrgency,       color: '#EF4444' },
    ];
  }
  return [];
}

// ─── ScriptCard ────────────────────────────────────────────────────────────────
function ScriptCard({ script, color }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden', marginBottom: '1.5rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '1rem 1.375rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke={color} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <div style={{ color: '#E8ECF4', fontWeight: 600, fontSize: '0.875rem' }}>Calling Script</div>
            <div style={{ color: '#4A5568', fontSize: '0.72rem', marginTop: '0.1rem' }}>{open ? 'Click to collapse' : 'Click to expand'}</div>
          </div>
        </div>
        <svg width="16" height="16" fill="none" stroke="#6B7280" viewBox="0 0 24 24" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: '0 1.375rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: color, paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
            {script.title}
          </div>
          {script.sections.map((section, i) => (
            <div key={i} style={{ marginBottom: i < script.sections.length - 1 ? '1.25rem' : 0 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B7280', marginBottom: '0.45rem' }}>
                {section.label}
              </div>
              <div style={{ color: '#9CA3AF', fontSize: '0.825rem', lineHeight: 1.75, whiteSpace: 'pre-line', paddingLeft: '0.875rem', borderLeft: `2px solid ${color}30` }}>
                {section.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ masterLead, funnelEntry, onAddToFunnel, onMoveStage, onRemoveFromFunnel, adding }) {
  const [stageOpen, setStageOpen] = useState(false);
  const lt          = LEAD_TYPE_META[masterLead.leadType] || LEAD_TYPE_META.expired;
  const isInFunnel  = !!funnelEntry;
  const stage       = isInFunnel ? (FUNNEL_STAGES.find(s => s.id === funnelEntry.stage) || FUNNEL_STAGES[0]) : null;
  const highUrgency = masterLead.leadType === 'pre_foreclosure' && isInFunnel && !funnelEntry.lastContactDate;

  return (
    <div style={{ background: '#0D1929', border: `1px solid ${isInFunnel ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
      {highUrgency && (
        <div style={{ position: 'absolute', top: '0.875rem', right: '0.875rem' }}>
          <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.62rem', fontWeight: 700, color: '#FFF', background: '#DC2626', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            HIGH URGENCY
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', paddingRight: highUrgency ? '7rem' : '0' }}>
        <div>
          <div style={{ fontSize: '0.925rem', fontWeight: 600, color: '#E8ECF4', marginBottom: '0.2rem' }}>{masterLead.ownerName}</div>
          {masterLead.email && <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{masterLead.email}</div>}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
          {!highUrgency && (
            <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.67rem', fontWeight: 600, color: lt.color, background: lt.bg, border: `1px solid ${lt.border}` }}>
              {lt.label}
            </span>
          )}
          {isInFunnel && stage && (
            <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.67rem', fontWeight: 600, color: stage.color, background: `${stage.color}15`, border: `1px solid ${stage.color}40` }}>
              {stage.label}
            </span>
          )}
        </div>
      </div>

      {/* Address */}
      <div style={{ fontSize: '0.8rem', color: '#9CA3AF', display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
        <span style={{ color: '#4B5563', flexShrink: 0 }}>📍</span>
        {masterLead.propertyAddress}
      </div>

      {/* Phone + Last contact */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {masterLead.phone && (
          <div style={{ fontSize: '0.78rem' }}>
            <span style={{ color: '#4B5563', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.15rem' }}>Phone</span>
            <a href={`tel:${masterLead.phone}`} style={{ color: '#6BA3FF', textDecoration: 'none' }}>{masterLead.phone}</a>
          </div>
        )}
        {isInFunnel && funnelEntry.lastContactDate && (
          <div style={{ fontSize: '0.78rem' }}>
            <span style={{ color: '#4B5563', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.15rem' }}>Last Contact</span>
            <span style={{ color: '#9CA3AF' }}>{funnelEntry.lastContactDate}</span>
          </div>
        )}
      </div>

      {/* Notes preview (master notes, or funnel notes if present) */}
      {(isInFunnel ? funnelEntry.notes || masterLead.notes : masterLead.notes) && (
        <div style={{ fontSize: '0.78rem', color: '#4B5563', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
          {isInFunnel ? (funnelEntry.notes || masterLead.notes) : masterLead.notes}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.125rem' }}>
        {isInFunnel && masterLead.phone && (
          <a href={`tel:${masterLead.phone}`} style={{ padding: '0.35rem 0.75rem', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '8px', color: '#34D399', fontSize: '0.72rem', fontWeight: 500, textDecoration: 'none' }}>
            Call
          </a>
        )}
        {isInFunnel && masterLead.phone && (
          <a href={`sms:${masterLead.phone}`} style={{ padding: '0.35rem 0.75rem', background: 'rgba(107,163,255,0.08)', border: '1px solid rgba(107,163,255,0.2)', borderRadius: '8px', color: '#6BA3FF', fontSize: '0.72rem', fontWeight: 500, textDecoration: 'none' }}>
            Text
          </a>
        )}
        {isInFunnel && masterLead.email && (
          <a href={`mailto:${masterLead.email}`} style={{ padding: '0.35rem 0.75rem', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '8px', color: '#A78BFA', fontSize: '0.72rem', fontWeight: 500, textDecoration: 'none' }}>
            Email
          </a>
        )}

        {/* Add to Funnel / In Funnel */}
        {!isInFunnel ? (
          <button
            onClick={() => onAddToFunnel(masterLead.id)}
            disabled={adding === masterLead.id}
            style={{
              padding: '0.35rem 0.875rem',
              background: adding === masterLead.id ? 'rgba(201,168,76,0.08)' : 'linear-gradient(135deg, #C9A84C, #D9BD6A)',
              border: adding === masterLead.id ? '1px solid rgba(201,168,76,0.3)' : 'none',
              borderRadius: '8px',
              color: adding === masterLead.id ? '#C9A84C' : '#0A0F1E',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: adding === masterLead.id ? 'wait' : 'pointer',
            }}
          >
            {adding === masterLead.id ? 'Adding...' : '+ Add to My Funnel'}
          </button>
        ) : (
          <>
            {/* Move Stage */}
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <button
                onClick={() => setStageOpen(o => !o)}
                style={{ padding: '0.35rem 0.75rem', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '8px', color: '#C9A84C', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Move Stage →
              </button>
              {stageOpen && (
                <div
                  style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden', zIndex: 20, minWidth: '168px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                  onMouseLeave={() => setStageOpen(false)}
                >
                  {FUNNEL_STAGES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { onMoveStage(funnelEntry.id, s.id); setStageOpen(false); }}
                      style={{
                        display: 'block', width: '100%', padding: '0.6rem 1rem', textAlign: 'left',
                        background: funnelEntry.stage === s.id ? `${s.color}18` : 'transparent',
                        border: 'none',
                        color: funnelEntry.stage === s.id ? s.color : '#9CA3AF',
                        fontSize: '0.8rem', cursor: 'pointer',
                      }}
                      onMouseEnter={e => { if (funnelEntry.stage !== s.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (funnelEntry.stage !== s.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => onRemoveFromFunnel(funnelEntry.id)}
              style={{ padding: '0.35rem 0.5rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', color: '#F87171', fontSize: '0.72rem', cursor: 'pointer' }}
              title="Remove from funnel"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ProspectingHub() {
  const [activeTab, setActiveTab]       = useState('expired');
  const [masterLeads, setMasterLeads]   = useState([]);
  const [funnelEntries, setFunnelEntries] = useState([]);   // agent's funnel entries
  const [loading, setLoading]           = useState(true);
  const [adding, setAdding]             = useState(null);   // masterId being added

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [mlRes, funnelRes] = await Promise.all([
        masterLeadsAPI.getAll(),
        funnelAPI.getAll(),
      ]);
      setMasterLeads(mlRes.data.data?.leads || []);
      setFunnelEntries(funnelRes.data.data?.entries || []);
    } catch (err) {
      console.error('ProspectingHub load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // funnelByMasterId: { [masterId]: funnelEntry }
  const funnelByMasterId = {};
  funnelEntries.forEach(e => { funnelByMasterId[e.masterId] = e; });

  const handleAddToFunnel = async (masterId) => {
    setAdding(masterId);
    try {
      const res = await funnelAPI.addToFunnel(masterId);
      const newEntry = res.data.data?.entry;
      if (newEntry) {
        setFunnelEntries(prev => [newEntry, ...prev]);
        // Write to stage history so Dashboard Recent Activity picks it up
        const masterLead = masterLeads.find(m => m.id === masterId);
        if (masterLead) {
          const entry = {
            leadId: newEntry.id, ownerName: masterLead.ownerName,
            propertyAddress: masterLead.propertyAddress,
            fromStage: null, toStage: 'new_lead',
            timestamp: new Date().toISOString(),
          };
          const existing = JSON.parse(localStorage.getItem('je_stage_history') || '[]');
          localStorage.setItem('je_stage_history', JSON.stringify([entry, ...existing].slice(0, 50)));
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add to funnel';
      alert(msg);
    } finally {
      setAdding(null);
    }
  };

  const handleMoveStage = async (funnelId, newStage) => {
    const entry = funnelEntries.find(e => e.id === funnelId);
    if (!entry || entry.stage === newStage) return;

    const today = new Date().toISOString().slice(0, 10);
    const updatedEntries = funnelEntries.map(e =>
      e.id === funnelId
        ? { ...e, stage: newStage, lastContactDate: newStage !== 'new_lead' ? today : e.lastContactDate }
        : e
    );
    setFunnelEntries(updatedEntries);

    // Write to stage history
    const masterLead = masterLeads.find(m => m.id === entry.masterId);
    const histEntry = {
      leadId: funnelId,
      ownerName: masterLead?.ownerName || entry.ownerName,
      propertyAddress: masterLead?.propertyAddress || entry.propertyAddress,
      fromStage: entry.stage, toStage: newStage,
      timestamp: new Date().toISOString(),
    };
    const existing = JSON.parse(localStorage.getItem('je_stage_history') || '[]');
    localStorage.setItem('je_stage_history', JSON.stringify([histEntry, ...existing].slice(0, 50)));

    try {
      await funnelAPI.updateEntry(funnelId, { stage: newStage, lastContactDate: newStage !== 'new_lead' ? today : entry.lastContactDate });
    } catch {
      // Optimistic update stays
    }
  };

  const handleRemoveFromFunnel = async (funnelId) => {
    if (!confirm('Remove this lead from your funnel?')) return;
    setFunnelEntries(prev => prev.filter(e => e.id !== funnelId));
    try { await funnelAPI.removeEntry(funnelId); } catch {}
  };

  // ─── Derived ──────────────────────────────────────────────────────────────
  const now     = new Date();
  const weekAgo = new Date(now - 7 * 24 * 3600 * 1000);

  const tabLeads = masterLeads.filter(m => m.leadType === activeTab);

  // Funnel entries for each tab type (for stats and badge counts)
  const funnelByType = {};
  TABS.forEach(t => {
    funnelByType[t.id] = funnelEntries.filter(e => e.leadType === t.id);
  });

  const activeTabMeta  = TABS.find(t => t.id === activeTab);
  const stats          = computeStats(activeTab, funnelByType[activeTab], weekAgo);

  const pageStyle  = { minHeight: '100vh', background: '#07101E', fontFamily: '"Inter", sans-serif' };
  const wrapStyle  = { maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' };

  return (
    <div style={pageStyle}>
      <div style={wrapStyle}>

        {/* Page Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2rem', fontWeight: 700, color: '#E8ECF4', margin: '0 0 0.3rem' }}>
              Prospecting Hub
            </h1>
            <p style={{ color: '#4A5568', fontSize: '0.875rem', margin: 0 }}>
              Browse the shared lead pool. Add leads to your funnel to start working them.
              {loading && <span style={{ marginLeft: '0.5rem', color: '#374151', fontSize: '0.75rem' }}>Loading...</span>}
            </p>
          </div>

          {/* Tab Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {TABS.map(tab => {
              const isActive    = activeTab === tab.id;
              const inFunnelCount = funnelByType[tab.id].length;
              const totalCount    = masterLeads.filter(m => m.leadType === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '0.575rem 1.125rem',
                    borderRadius: '10px',
                    border: isActive ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    background: isActive ? tab.activeBg : 'rgba(255,255,255,0.03)',
                    color: isActive ? tab.activeText : '#6B7280',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.15s',
                    fontFamily: '"Inter", sans-serif',
                  }}
                >
                  {tab.label}
                  <span style={{
                    padding: '0.1rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: isActive ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.07)',
                    color: isActive ? tab.activeText : '#4A5568',
                  }}>
                    {inFunnelCount}/{totalCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div>

          {/* What is it? */}
          <div style={{ background: `${activeTabMeta.accentColor}08`, border: `1px solid ${activeTabMeta.accentColor}20`, borderRadius: '12px', padding: '0.875rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.83rem', color: '#9CA3AF', lineHeight: 1.65 }}>
            <span style={{ color: activeTabMeta.accentColor, fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.3rem' }}>
              About This Category
            </span>
            {activeTabMeta.description}
          </div>

          {/* Stats Bar — computed from funnel entries for this tab */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem', marginBottom: '1.5rem' }}>
            {stats.map(stat => (
              <div
                key={stat.label}
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1rem 1.25rem' }}
              >
                <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: '0.375rem' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color, fontFamily: '"Playfair Display", serif' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Script Card */}
          <ScriptCard script={SCRIPTS[activeTab]} color={activeTabMeta.accentColor} />

          {/* Lead List Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.1rem', color: '#E8ECF4', margin: '0 0 0.15rem' }}>
                {activeTabMeta.label} Pool
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#4A5568' }}>
                {tabLeads.length} {tabLeads.length === 1 ? 'lead' : 'leads'} available
                {funnelByType[activeTab].length > 0 && (
                  <span style={{ marginLeft: '0.5rem', color: '#C9A84C' }}>
                    · {funnelByType[activeTab].length} in your funnel
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Leads */}
          {loading ? (
            <div style={{ background: '#0D1929', border: `1px solid ${activeTabMeta.accentColor}18`, borderRadius: '12px', padding: '3.5rem', textAlign: 'center' }}>
              <div style={{ color: '#374151', fontSize: '0.875rem' }}>Loading leads...</div>
            </div>
          ) : tabLeads.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tabLeads.map(lead => (
                <LeadCard
                  key={lead.id}
                  masterLead={lead}
                  funnelEntry={funnelByMasterId[lead.id] || null}
                  onAddToFunnel={handleAddToFunnel}
                  onMoveStage={handleMoveStage}
                  onRemoveFromFunnel={handleRemoveFromFunnel}
                  adding={adding}
                />
              ))}
            </div>
          ) : (
            <div style={{ background: '#0D1929', border: `1px solid ${activeTabMeta.accentColor}18`, borderRadius: '12px', padding: '3.5rem', textAlign: 'center' }}>
              <div style={{ color: '#374151', fontSize: '1.5rem', marginBottom: '0.75rem' }}>—</div>
              <div style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '0.35rem', fontWeight: 500 }}>
                {activeTabMeta.emptyTitle}
              </div>
              <div style={{ color: '#374151', fontSize: '0.78rem' }}>
                {activeTabMeta.emptyDesc}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
