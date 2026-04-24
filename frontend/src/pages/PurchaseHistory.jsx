import React, { useState, useEffect } from 'react';
import { agentAPI, adminAPI, funnelAPI } from '../utils/api';

// ─── Mappers ───────────────────────────────────────────────────────────────────
// Map an agent_funnel entry to the local lead shape
function mapFunnelEntry(entry) {
  return {
    id:              entry.id,
    masterId:        entry.masterId,
    ownerName:       entry.ownerName,
    propertyAddress: entry.propertyAddress,
    leadType:        entry.leadType,
    phone:           entry.phone || '',
    email:           entry.email || '',
    stage:           entry.stage || 'new_lead',
    notes:           entry.notes || '',
    lastContactDate: entry.lastContactDate || null,
    createdAt:       entry.addedAt,
    _source:         'funnel',
  };
}

// Map a self-created lead (from agentAPI.getProfile) to the local lead shape
const PROSPECTING_TYPES = ['expired', 'fsbo', 'pre_foreclosure'];
function mapSelfCreatedLead(lead) {
  return {
    id:              lead.leadId,
    ownerName:       lead.contact?.name       || '',
    propertyAddress: lead.location?.address   || '',
    leadType:        lead.leadType,
    phone:           lead.contact?.phone      || '',
    email:           lead.contact?.email      || '',
    stage:           lead.funnelStage         || 'new_lead',
    notes:           lead.notes               || '',
    lastContactDate: lead.updatedAt?.slice(0, 10) || null,
    createdAt:       lead.createdAt,
    _source:         'self_created',
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const FUNNEL_STAGES = [
  { id: 'new_lead',       label: 'New Lead',       color: '#C9A84C' },
  { id: 'contacted',      label: 'Contacted',      color: '#2D6A9F' },
  { id: 'appt_set',       label: 'Appt Set',       color: '#6B46C1' },
  { id: 'under_contract', label: 'Under Contract', color: '#0F766E' },
  { id: 'closed',         label: 'Closed',         color: '#15803D' },
];

const LEAD_TYPE_META = {
  expired:         { label: 'Expired',        color: '#D97706', bg: 'rgba(217,119,6,0.12)',  border: 'rgba(217,119,6,0.3)'   },
  fsbo:            { label: 'FSBO',           color: '#6BA3FF', bg: 'rgba(58,125,255,0.1)',  border: 'rgba(58,125,255,0.25)' },
  pre_foreclosure: { label: 'Pre-Foreclosure',color: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)'  },
};

// ─── Add Lead Modal ────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  ownerName: '', propertyAddress: '', leadType: 'expired',
  phone: '', email: '', stage: 'new_lead', notes: '',
};

function AddLeadModal({ onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.ownerName || !form.propertyAddress) return;
    onSave({ ...form, id: `lead_${Date.now()}`, lastContactDate: null, createdAt: new Date().toISOString() });
    onClose();
  };

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.875rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#E8ECF4', fontSize: '0.875rem', outline: 'none',
    fontFamily: '"Inter", sans-serif',
  };
  const labelStyle = {
    display: 'block', fontSize: '0.68rem', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: '0.35rem',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: '#0D1220', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '18px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.25rem', color: '#E8ECF4', margin: 0 }}>Add Lead</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Owner Name *</label>
            <input style={fieldStyle} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="Robert Chambers" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Property Address *</label>
            <input style={fieldStyle} value={form.propertyAddress} onChange={e => set('propertyAddress', e.target.value)} placeholder="842 Roswell Rd NE, Marietta, GA 30062" />
          </div>
          <div>
            <label style={labelStyle}>Lead Type</label>
            <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.leadType} onChange={e => set('leadType', e.target.value)}>
              <option value="expired" style={{ background: '#0D1220' }}>Expired Listing</option>
              <option value="fsbo" style={{ background: '#0D1220' }}>FSBO</option>
              <option value="pre_foreclosure" style={{ background: '#0D1220' }}>Pre-Foreclosure</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Stage</label>
            <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.stage} onChange={e => set('stage', e.target.value)}>
              {FUNNEL_STAGES.map(s => (
                <option key={s.id} value={s.id} style={{ background: '#0D1220' }}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={fieldStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(770) 555-0182" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={fieldStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="owner@email.com" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...fieldStyle, resize: 'vertical', minHeight: '80px' }}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Motivation, property condition, best time to call..."
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.85rem' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.ownerName || !form.propertyAddress}
            style={{ padding: '0.625rem 1.5rem', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '10px', color: '#0A0F1E', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: (!form.ownerName || !form.propertyAddress) ? 0.5 : 1 }}
          >
            Add Lead
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign Agent Modal ────────────────────────────────────────────────────────
function AssignAgentModal({ lead, onClose, onAssigned }) {
  const [agents, setAgents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [assigning, setAssigning] = useState(null); // agentId being assigned
  const [error, setError]       = useState('');

  useEffect(() => {
    adminAPI.getAgents().then(res => {
      setAgents(res.data.data?.agents || []);
    }).catch(() => {
      setError('Could not load agents. Admin access required.');
    }).finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter(a =>
    !search ||
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async (agent) => {
    setAssigning(agent.agentId);
    setError('');
    try {
      await adminAPI.reassignLead(lead.id, agent.agentId);
      onAssigned(lead.id);
      onClose();
    } catch {
      setError('Failed to assign. Make sure you have admin privileges.');
      setAssigning(null);
    }
  };

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.875rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#E8ECF4', fontSize: '0.875rem', outline: 'none',
    fontFamily: '"Inter", sans-serif',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: '#0D1220', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '18px', padding: '2rem', width: '100%', maxWidth: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.15rem', color: '#E8ECF4', margin: '0 0 0.25rem' }}>Assign Lead</h3>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '340px' }}>
              {lead.ownerName} — {lead.propertyAddress.split(',')[0]}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, flexShrink: 0, marginLeft: '0.5rem' }}>✕</button>
        </div>

        {/* Search */}
        <input
          style={{ ...fieldStyle, marginBottom: '0.875rem' }}
          placeholder="Search agents by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />

        {/* Error */}
        {error && (
          <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.875rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#F87171', fontSize: '0.8rem' }}>
            {error}
          </div>
        )}

        {/* Agent list */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#4A5568', fontSize: '0.875rem' }}>Loading agents...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#4A5568', fontSize: '0.875rem' }}>No agents found.</div>
          )}
          {filtered.map(agent => (
            <div
              key={agent.agentId}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', gap: '0.75rem' }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#E8ECF4', marginBottom: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.name || agent.email}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.email}
                  {agent.licenseId && <span style={{ marginLeft: '0.5rem', color: '#374151' }}>· #{agent.licenseId}</span>}
                </div>
              </div>
              <button
                onClick={() => handleAssign(agent)}
                disabled={!!assigning}
                style={{
                  padding: '0.4rem 1rem', background: assigning === agent.agentId ? 'rgba(201,168,76,0.2)' : 'linear-gradient(135deg, #C9A84C, #D9BD6A)',
                  border: 'none', borderRadius: '8px', color: '#0A0F1E', fontWeight: 700,
                  cursor: assigning ? 'wait' : 'pointer', fontSize: '0.78rem', flexShrink: 0,
                  opacity: assigning && assigning !== agent.agentId ? 0.5 : 1,
                }}
              >
                {assigning === agent.agentId ? '...' : 'Assign'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Trapezoid Funnel ──────────────────────────────────────────────────────────
// Target widths per stage (% of container). Each stage element is centered and
// clip-path'd so its bottom edge matches the next stage's top edge exactly.
const STAGE_WIDTHS = [100, 82, 64, 46, 28];

function FunnelViz({ stages, counts, total, selectedStage, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 0 }}>
      {stages.map((stage, i) => {
        const count     = counts[stage.id] || 0;
        const pct       = total > 0 ? Math.round((count / total) * 100) : 0;
        const prevCount = i > 0 ? (counts[stages[i - 1].id] || 0) : null;
        const dropped   = prevCount !== null ? Math.max(0, prevCount - count) : null;
        const isActive  = selectedStage === stage.id;

        const w     = STAGE_WIDTHS[i];
        const nextW = STAGE_WIDTHS[i + 1] ?? (w * 0.7); // last stage tapers slightly
        // Bottom inset as % of this element's own width
        const botInsetPct = ((w - nextW) / (2 * w)) * 100;
        const clip = `polygon(0% 0%, 100% 0%, ${(100 - botInsetPct).toFixed(2)}% 100%, ${botInsetPct.toFixed(2)}% 100%)`;

        return (
          <React.Fragment key={stage.id}>
            {/* Drop indicator */}
            {dropped !== null && (
              <div style={{ width: '100%', textAlign: 'center', fontSize: '0.65rem', color: '#374151', padding: '5px 0', userSelect: 'none', letterSpacing: '0.04em' }}>
                ↓ {dropped > 0 ? `${dropped} dropped` : '—'}
              </div>
            )}

            {/* Trapezoid button */}
            <button
              onClick={() => onSelect(isActive ? null : stage.id)}
              style={{
                width: `${w}%`,
                height: '68px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                padding: 0,
                background: isActive ? `${stage.color}38` : `${stage.color}18`,
                border: `1px solid ${isActive ? stage.color + 'CC' : stage.color + '50'}`,
                boxShadow: isActive ? `0 0 24px ${stage.color}30` : 'none',
                clipPath: clip,
                cursor: 'pointer',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'background 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = `${stage.color}28`; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = `${stage.color}18`; }}
            >
              <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isActive ? stage.color : '#9CA3AF', whiteSpace: 'nowrap' }}>
                {stage.label}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#6B7280', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isActive ? stage.color : '#E8ECF4' }}>{count}</span>
                {' '}· {pct}%
              </span>
            </button>
          </React.Fragment>
        );
      })}

      {selectedStage && (
        <button
          onClick={() => onSelect(null)}
          style={{ marginTop: '1rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#6B7280', fontSize: '0.72rem', padding: '0.35rem 0.875rem', cursor: 'pointer' }}
        >
          Clear filter ×
        </button>
      )}
    </div>
  );
}

// ─── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, onMoveStage, onDelete }) {
  const [stageOpen, setStageOpen] = useState(false);
  const lt = LEAD_TYPE_META[lead.leadType] || LEAD_TYPE_META.expired;
  const stage = FUNNEL_STAGES.find(s => s.id === lead.stage) || FUNNEL_STAGES[0];

  return (
    <div style={{ background: '#0D1929', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '12px', padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.925rem', fontWeight: 600, color: '#E8ECF4', marginBottom: '0.2rem' }}>{lead.ownerName}</div>
          {lead.email && <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{lead.email}</div>}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.67rem', fontWeight: 600, color: lt.color, background: lt.bg, border: `1px solid ${lt.border}` }}>
            {lt.label}
          </span>
          <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.67rem', fontWeight: 600, color: stage.color, background: `${stage.color}15`, border: `1px solid ${stage.color}40` }}>
            {stage.label}
          </span>
        </div>
      </div>

      {/* Address */}
      <div style={{ fontSize: '0.8rem', color: '#9CA3AF', display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
        <span style={{ color: '#4B5563', flexShrink: 0 }}>📍</span>
        {lead.propertyAddress}
      </div>

      {/* Phone + Last contact */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {lead.phone && (
          <div style={{ fontSize: '0.78rem' }}>
            <span style={{ color: '#4B5563', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.15rem' }}>Phone</span>
            <a href={`tel:${lead.phone}`} style={{ color: '#6BA3FF', textDecoration: 'none' }}>{lead.phone}</a>
          </div>
        )}
        {lead.lastContactDate && (
          <div style={{ fontSize: '0.78rem' }}>
            <span style={{ color: '#4B5563', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.15rem' }}>Last Contact</span>
            <span style={{ color: '#9CA3AF' }}>{lead.lastContactDate}</span>
          </div>
        )}
      </div>

      {/* Notes preview */}
      {lead.notes && (
        <div style={{ fontSize: '0.78rem', color: '#4B5563', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
          {lead.notes}
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.125rem' }}>
        {lead.phone && (
          <a href={`tel:${lead.phone}`} style={{ padding: '0.35rem 0.75rem', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '8px', color: '#34D399', fontSize: '0.72rem', fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>
            Call
          </a>
        )}
        {lead.phone && (
          <a href={`sms:${lead.phone}`} style={{ padding: '0.35rem 0.75rem', background: 'rgba(107,163,255,0.08)', border: '1px solid rgba(107,163,255,0.2)', borderRadius: '8px', color: '#6BA3FF', fontSize: '0.72rem', fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>
            Text
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} style={{ padding: '0.35rem 0.75rem', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '8px', color: '#A78BFA', fontSize: '0.72rem', fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>
            Email
          </a>
        )}

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
                  onClick={() => { onMoveStage(lead.id, s.id); setStageOpen(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '0.6rem 1rem', textAlign: 'left',
                    background: lead.stage === s.id ? `${s.color}18` : 'transparent',
                    border: 'none',
                    color: lead.stage === s.id ? s.color : '#9CA3AF',
                    fontSize: '0.8rem', cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (lead.stage !== s.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (lead.stage !== s.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onDelete(lead.id)}
          style={{ padding: '0.35rem 0.5rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', color: '#F87171', fontSize: '0.72rem', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function PurchaseHistory() {
  const [leads, setLeads]                     = useState([]);
  const [selectedStage, setSelectedStage]     = useState(null);
  const [showAddModal, setShowAddModal]        = useState(false);
  const [assignModalLead, setAssignModalLead] = useState(null);
  const [syncing, setSyncing]                 = useState(true);

  // Load from both funnel API (master lead copies) and self-created leads
  useEffect(() => {
    (async () => {
      try {
        setSyncing(true);
        const [funnelRes, profileRes] = await Promise.allSettled([
          funnelAPI.getAll(),
          agentAPI.getProfile(),
        ]);

        const funnelLeads = funnelRes.status === 'fulfilled'
          ? (funnelRes.value.data.data?.entries || []).map(mapFunnelEntry)
          : [];

        const selfCreated = profileRes.status === 'fulfilled'
          ? (profileRes.value.data.data?.purchasedLeads || [])
              .filter(({ lead }) => lead && PROSPECTING_TYPES.includes(lead.leadType))
              .map(({ lead }) => mapSelfCreatedLead(lead))
          : [];

        // Merge: funnel entries take priority; avoid duplicates by id
        const funnelIds = new Set(funnelLeads.map(l => l.id));
        const merged = [...funnelLeads, ...selfCreated.filter(l => !funnelIds.has(l.id))];
        setLeads(merged);
      } finally {
        setSyncing(false);
      }
    })();
  }, []);

  const handleAddLead = async (formData) => {
    const optimistic = { ...formData, _source: 'self_created', _synced: false };
    setLeads(prev => [...prev, optimistic]);

    try {
      const res = await agentAPI.createProspectingLead(formData);
      const saved = res.data.data?.lead;
      setLeads(prev => prev.map(l =>
        l.id === optimistic.id
          ? { ...optimistic, id: saved?.leadId || optimistic.id, _synced: true }
          : l
      ));
    } catch {
      // Keep optimistic entry
    }
  };

  const handleMoveStage = async (id, newStage) => {
    const lead  = leads.find(l => l.id === id);
    if (!lead || lead.stage === newStage) return;
    const today = new Date().toISOString().slice(0, 10);

    setLeads(prev => prev.map(l =>
      l.id === id
        ? { ...l, stage: newStage, lastContactDate: newStage !== 'new_lead' ? today : l.lastContactDate }
        : l
    ));

    // Write to stage history so Dashboard Recent Activity auto-populates
    const histEntry = {
      leadId: id, ownerName: lead.ownerName, propertyAddress: lead.propertyAddress,
      fromStage: lead.stage, toStage: newStage, timestamp: new Date().toISOString(),
    };
    const existing = JSON.parse(localStorage.getItem('je_stage_history') || '[]');
    localStorage.setItem('je_stage_history', JSON.stringify([histEntry, ...existing].slice(0, 50)));

    try {
      if (lead._source === 'funnel') {
        await funnelAPI.updateEntry(id, { stage: newStage, lastContactDate: newStage !== 'new_lead' ? today : lead.lastContactDate });
      } else {
        await agentAPI.updateLeadStage(id, newStage);
      }
    } catch {
      // Optimistic update stays
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this lead from your funnel?')) return;
    const lead = leads.find(l => l.id === id);
    setLeads(prev => prev.filter(l => l.id !== id));

    try {
      if (lead?._source === 'funnel') {
        await funnelAPI.removeEntry(id);
      } else {
        await agentAPI.deleteLead(id);
      }
    } catch {}
  };

  const handleAssigned = (id) => {
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  // Computed counts
  const counts = {};
  FUNNEL_STAGES.forEach(s => { counts[s.id] = leads.filter(l => l.stage === s.id).length; });

  // Metric cards
  const now       = new Date();
  const weekAgo   = new Date(now - 7 * 24 * 3600 * 1000);
  const contactedThisWeek = leads.filter(l =>
    l.stage === 'contacted' && l.lastContactDate && new Date(l.lastContactDate) >= weekAgo
  ).length;
  const apptCount    = counts['appt_set'] || 0;
  const closedCount  = counts['closed']   || 0;
  const convRate     = leads.length > 0 ? Math.round((closedCount / leads.length) * 100) : 0;

  const displayedLeads = selectedStage
    ? leads.filter(l => l.stage === selectedStage)
    : leads;

  const selectedStageMeta = FUNNEL_STAGES.find(s => s.id === selectedStage);

  const metricCards = [
    { label: 'Total Leads',          value: leads.length,          color: '#C9A84C' },
    { label: 'Contacted This Week',  value: contactedThisWeek,     color: '#6BA3FF' },
    { label: 'Appointments Set',     value: apptCount,             color: '#A78BFA' },
    { label: 'Conversion Rate',      value: `${convRate}%`,        color: '#34D399' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#07101E', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
          <div>
            <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2rem', fontWeight: 700, color: '#E8ECF4', marginBottom: '0.35rem' }}>
              My Lead Funnel
            </h1>
            <p style={{ color: '#4A5568', fontSize: '0.875rem', margin: 0 }}>
              Track your Expired, FSBO, and Pre-Foreclosure leads from first contact to closed deal.
              {syncing && <span style={{ marginLeft: '0.5rem', color: '#374151', fontSize: '0.75rem' }}>Syncing...</span>}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '0.65rem 1.5rem', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '10px', color: '#0A0F1E', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', flexShrink: 0 }}
          >
            + Add Lead
          </button>
        </div>

        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem', marginBottom: '2rem' }}>
          {metricCards.map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: '0.375rem' }}>{label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color, fontFamily: '"Playfair Display", serif' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '45% 55%', gap: '1.5rem', alignItems: 'start' }}>

          {/* LEFT — Funnel */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '2rem 1.75rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: '1rem' }}>
              Pipeline Stages
            </div>
            <FunnelViz
              stages={FUNNEL_STAGES}
              counts={counts}
              total={leads.length}
              selectedStage={selectedStage}
              onSelect={setSelectedStage}
            />
          </div>

          {/* RIGHT — Lead List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* List header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.1rem', color: '#E8ECF4', margin: '0 0 0.15rem' }}>
                  {selectedStageMeta
                    ? <span style={{ color: selectedStageMeta.color }}>{selectedStageMeta.label}</span>
                    : 'All Leads'}
                </h2>
                <div style={{ fontSize: '0.75rem', color: '#4A5568' }}>
                  {displayedLeads.length} {displayedLeads.length === 1 ? 'lead' : 'leads'}
                </div>
              </div>
            </div>

            {/* Lead cards */}
            {displayedLeads.length > 0
              ? displayedLeads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onMoveStage={handleMoveStage}
                    onDelete={handleDelete}
                  />
                ))
              : (
                <div style={{ background: '#0D1929', border: '1px solid rgba(201,168,76,0.12)', borderRadius: '12px', padding: '3rem', textAlign: 'center' }}>
                  <div style={{ color: '#374151', fontSize: '1.5rem', marginBottom: '0.75rem' }}>—</div>
                  <div style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                    {selectedStageMeta ? `No leads in ${selectedStageMeta.label} yet.` : 'No leads yet.'}
                  </div>
                  <div style={{ color: '#374151', fontSize: '0.78rem' }}>Add a lead to get started.</div>
                </div>
              )
            }
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddLead}
        />
      )}

      {assignModalLead && (
        <AssignAgentModal
          lead={assignModalLead}
          onClose={() => setAssignModalLead(null)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  );
}
