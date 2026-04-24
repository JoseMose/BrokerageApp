import React, { useState, useEffect } from 'react';
import { getAlerts, addAlert, updateAlert, deleteAlert, getProperties } from '../../utils/portalStorage';

const ALERT_TYPES = [
  { value: 'equity_milestone', label: 'Equity Milestone',   color: '#C9A84C', desc: 'Notify when a property hits a target equity %' },
  { value: 'cashflow_drop',    label: 'Cash Flow Drop',     color: '#F87171', desc: 'Notify when monthly net cash flow drops below threshold' },
  { value: 'rate_alert',       label: 'Rate Watch',         color: '#6BA3FF', desc: 'Notify when 30-yr fixed rate crosses a threshold' },
  { value: 'price_drop',       label: 'Market Price Drop',  color: '#FCD34D', desc: 'Notify when a zip code median drops by X%' },
  { value: 'new_listing',      label: 'New Listing Alert',  color: '#34D399', desc: 'Notify when properties matching criteria hit market' },
];

const STATUS_COLORS = {
  Active: { bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  text: '#34D399' },
  Paused: { bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)', text: '#6B7280' },
};

const EMPTY_FORM = { type: 'equity_milestone', label: '', description: '', threshold: '', status: 'Active' };

function AddAlertModal({ onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const selectedType = ALERT_TYPES.find((t) => t.value === form.type);

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.875rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#E8ECF4', fontSize: '0.875rem', outline: 'none',
    fontFamily: '"Inter", sans-serif',
  };
  const labelStyle = { display: 'block', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: '0.35rem' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.2rem', color: '#E8ECF4', marginBottom: '1.5rem' }}>Create Alert</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Alert Type</label>
            <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.type} onChange={(e) => set('type', e.target.value)}>
              {ALERT_TYPES.map((t) => <option key={t.value} value={t.value} style={{ background: '#0D1220' }}>{t.label}</option>)}
            </select>
            {selectedType && <p style={{ fontSize: '0.72rem', color: '#374151', marginTop: '0.35rem' }}>{selectedType.desc}</p>}
          </div>
          <div>
            <label style={labelStyle}>Alert Name</label>
            <input style={fieldStyle} value={form.label} onChange={(e) => set('label', e.target.value)} placeholder={selectedType?.label} />
          </div>
          <div>
            <label style={labelStyle}>Description / Criteria</label>
            <input style={fieldStyle} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g., 2847 Peachtree Rd — alert when equity reaches 50%" />
          </div>
          <div>
            <label style={labelStyle}>Threshold Value</label>
            <input style={fieldStyle} value={form.threshold} onChange={(e) => set('threshold', e.target.value)} placeholder="e.g., 50 (for 50%) or 6.0 (for rate)" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
          <button
            onClick={() => { if (form.label) { onSave({ ...form, label: form.label || selectedType?.label }); onClose(); } }}
            disabled={!form.label}
            style={{ padding: '0.625rem 1.5rem', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '10px', color: '#0A0F1E', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: !form.label ? 0.5 : 1 }}
          >
            Create Alert
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortalAlerts() {
  const [alerts, setAlerts]         = useState([]);
  const [properties, setProperties] = useState([]);
  const [showModal, setShowModal]   = useState(false);
  const [filter, setFilter]         = useState('All');

  const reload = () => { setAlerts(getAlerts()); setProperties(getProperties()); };
  useEffect(() => { reload(); }, []);

  const filtered = filter === 'All' ? alerts : alerts.filter((a) => a.status === filter);

  const toggleStatus = (id, current) => {
    updateAlert(id, { status: current === 'Active' ? 'Paused' : 'Active' });
    reload();
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this alert?')) return;
    deleteAlert(id);
    reload();
  };

  const activeCount = alerts.filter((a) => a.status === 'Active').length;

  const btnStyle = (active) => ({
    padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 500, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
    background: active ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
    color: active ? '#C9A84C' : '#6B7280',
    border: `1px solid ${active ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.07)'}`,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.6rem', fontWeight: 700, color: '#E8ECF4', marginBottom: '0.25rem' }}>Market Alerts</h1>
          <p style={{ color: '#4A5568', fontSize: '0.82rem' }}>{activeCount} active · {alerts.length} total</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '9px', color: '#0A0F1E', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
          + Create Alert
        </button>
      </div>

      {/* Alert type legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
        {ALERT_TYPES.map(({ value, label, color, desc }) => {
          const count = alerts.filter((a) => a.type === value).length;
          return (
            <div key={value} style={{ padding: '0.875rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${color}`, borderRadius: '12px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color, marginBottom: '0.2rem' }}>{label}</div>
              <div style={{ fontSize: '0.7rem', color: '#374151', lineHeight: 1.4 }}>{desc}</div>
              <div style={{ fontSize: '0.68rem', color: '#4A5568', marginTop: '0.35rem' }}>{count} configured</div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button style={btnStyle(filter === 'All')}    onClick={() => setFilter('All')}>All ({alerts.length})</button>
        <button style={btnStyle(filter === 'Active')} onClick={() => setFilter('Active')}>Active ({activeCount})</button>
        <button style={btnStyle(filter === 'Paused')} onClick={() => setFilter('Paused')}>Paused ({alerts.length - activeCount})</button>
      </div>

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', color: '#374151', fontSize: '0.875rem' }}>
            {alerts.length === 0 ? 'No alerts configured. Create your first alert to start monitoring.' : 'No alerts in this filter.'}
          </div>
        ) : (
          filtered.map((alert) => {
            const typeInfo  = ALERT_TYPES.find((t) => t.value === alert.type);
            const statusC   = STATUS_COLORS[alert.status] || STATUS_COLORS.Active;
            const typeColor = typeInfo?.color || '#6B7280';

            return (
              <div key={alert.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem',
                background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                borderLeft: `3px solid ${typeColor}`,
                borderRadius: '14px', transition: 'all 0.15s',
              }}>
                {/* Icon */}
                <div style={{ width: 38, height: 38, borderRadius: '10px', background: `rgba(${typeColor === '#C9A84C' ? '201,168,76' : typeColor === '#F87171' ? '239,68,68' : typeColor === '#6BA3FF' ? '58,125,255' : typeColor === '#FCD34D' ? '245,158,11' : '16,185,129'},0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={typeColor} strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#E8ECF4', fontSize: '0.9rem', fontWeight: 600 }}>{alert.label}</span>
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700, background: statusC.bg, color: statusC.text, border: `1px solid ${statusC.border}` }}>
                      {alert.status}
                    </span>
                    {typeInfo && (
                      <span style={{ fontSize: '0.7rem', color: typeColor, opacity: 0.8 }}>{typeInfo.label}</span>
                    )}
                  </div>
                  {alert.description && <div style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: '0.2rem' }}>{alert.description}</div>}
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: '#374151' }}>
                    {alert.threshold && <span>Threshold: <span style={{ color: '#9CA3AF' }}>{alert.threshold}</span></span>}
                    {alert.createdAt && <span>Created: {alert.createdAt}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                    onClick={() => toggleStatus(alert.id, alert.status)}
                    style={{
                      padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 500, borderRadius: '7px', cursor: 'pointer', transition: 'all 0.15s',
                      background: alert.status === 'Active' ? 'rgba(107,114,128,0.08)' : 'rgba(52,211,153,0.08)',
                      color:      alert.status === 'Active' ? '#6B7280' : '#34D399',
                      border:     `1px solid ${alert.status === 'Active' ? 'rgba(107,114,128,0.15)' : 'rgba(52,211,153,0.2)'}`,
                    }}
                  >
                    {alert.status === 'Active' ? 'Pause' : 'Activate'}
                  </button>
                  <button onClick={() => handleDelete(alert.id)} style={{ padding: '0.35rem 0.6rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '7px', color: '#F87171', fontSize: '0.72rem', cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <AddAlertModal
          onClose={() => setShowModal(false)}
          onSave={(alert) => { addAlert(alert); reload(); }}
        />
      )}
    </div>
  );
}
