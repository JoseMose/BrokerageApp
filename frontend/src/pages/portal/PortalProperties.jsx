import React, { useState, useEffect } from 'react';
import { getProperties, addProperty, updateProperty, deleteProperty } from '../../utils/portalStorage';

const STATUS_COLORS = {
  Holding: { bg: 'rgba(201,168,76,0.1)',  border: 'rgba(201,168,76,0.25)',  text: '#C9A84C'  },
  Listed:  { bg: 'rgba(58,125,255,0.1)',  border: 'rgba(58,125,255,0.25)',  text: '#6BA3FF'  },
  Sold:    { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  text: '#34D399'  },
};

const PROPERTY_TYPES = ['SFR', 'Multi-family', 'Condo', 'Townhouse', 'Commercial', 'Land'];
const STATUSES = ['Holding', 'Listed', 'Sold'];

const EMPTY_FORM = {
  address: '', purchaseDate: '', purchasePrice: '', currentValue: '',
  mortgageBalance: '', monthlyRent: '', monthlyMortgage: '',
  propertyType: 'SFR', status: 'Holding', notes: '',
};

const fmt = (n) => (n ? `$${Number(n).toLocaleString()}` : '—');
const equity = (p) => (p.currentValue || 0) - (p.mortgageBalance || 0);
const gain   = (p) => (p.currentValue || 0) - (p.purchasePrice || 0);
const gainPct = (p) => p.purchasePrice > 0 ? ((gain(p) / p.purchasePrice) * 100).toFixed(1) + '%' : '—';

function Badge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Holding;
  return (
    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

function PropertyModal({ property, onClose, onSave }) {
  const [form, setForm] = useState(property || EMPTY_FORM);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.address || !form.purchasePrice) return;
    onSave({
      ...form,
      purchasePrice:   parseFloat(form.purchasePrice)   || 0,
      currentValue:    parseFloat(form.currentValue)    || 0,
      mortgageBalance: parseFloat(form.mortgageBalance) || 0,
      monthlyRent:     parseFloat(form.monthlyRent)     || 0,
      monthlyMortgage: parseFloat(form.monthlyMortgage) || 0,
    });
    onClose();
  };

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.875rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#E8ECF4', fontSize: '0.875rem', outline: 'none',
    fontFamily: '"Inter", sans-serif',
  };
  const labelStyle = { display: 'block', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: '0.35rem' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '2rem', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.2rem', color: '#E8ECF4', marginBottom: '1.5rem' }}>
          {property ? 'Edit Property' : 'Add Property'}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Address *</label>
            <input style={fieldStyle} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Main St, Atlanta, GA 30301" />
          </div>

          <div>
            <label style={labelStyle}>Purchase Date</label>
            <input style={fieldStyle} type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Property Type</label>
            <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t} style={{ background: '#0D1220' }}>{t}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Purchase Price *</label>
            <input style={fieldStyle} type="number" value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} placeholder="285000" />
          </div>
          <div>
            <label style={labelStyle}>Current Value</label>
            <input style={fieldStyle} type="number" value={form.currentValue} onChange={(e) => set('currentValue', e.target.value)} placeholder="310000" />
          </div>

          <div>
            <label style={labelStyle}>Mortgage Balance</label>
            <input style={fieldStyle} type="number" value={form.mortgageBalance} onChange={(e) => set('mortgageBalance', e.target.value)} placeholder="245000" />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s} style={{ background: '#0D1220' }}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Monthly Rent</label>
            <input style={fieldStyle} type="number" value={form.monthlyRent} onChange={(e) => set('monthlyRent', e.target.value)} placeholder="2400" />
          </div>
          <div>
            <label style={labelStyle}>Monthly Mortgage Pmt</label>
            <input style={fieldStyle} type="number" value={form.monthlyMortgage} onChange={(e) => set('monthlyMortgage', e.target.value)} placeholder="1640" />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...fieldStyle, resize: 'vertical', minHeight: '72px' }} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Tenant details, strategy, observations..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.85rem' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!form.address || !form.purchasePrice} style={{ padding: '0.625rem 1.5rem', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '10px', color: '#0A0F1E', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: (!form.address || !form.purchasePrice) ? 0.5 : 1 }}>
            {property ? 'Save Changes' : 'Add Property'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortalProperties() {
  const [properties, setProperties] = useState([]);
  const [view, setView] = useState('cards'); // 'cards' | 'table'
  const [modal, setModal] = useState(null); // null | 'add' | property obj
  const [sortBy, setSortBy] = useState('equity');

  const reload = () => setProperties(getProperties());

  useEffect(() => { reload(); }, []);

  const handleSave = (data) => {
    if (data.id) {
      updateProperty(data.id, data);
    } else {
      addProperty(data);
    }
    reload();
  };

  const handleDelete = (id) => {
    if (!confirm('Remove this property from your portfolio?')) return;
    deleteProperty(id);
    reload();
  };

  const sorted = [...properties].sort((a, b) => {
    if (sortBy === 'equity')  return equity(b) - equity(a);
    if (sortBy === 'value')   return (b.currentValue || 0) - (a.currentValue || 0);
    if (sortBy === 'gain')    return gain(b) - gain(a);
    if (sortBy === 'date')    return new Date(b.purchaseDate) - new Date(a.purchaseDate);
    return 0;
  });

  const totalValue  = properties.reduce((s, p) => s + (p.currentValue || 0), 0);
  const totalEquity = properties.reduce((s, p) => s + equity(p), 0);
  const totalGain   = properties.reduce((s, p) => s + gain(p), 0);

  const btnSm = (active) => ({
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
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.6rem', fontWeight: 700, color: '#E8ECF4', marginBottom: '0.25rem' }}>Properties</h1>
          <p style={{ color: '#4A5568', fontSize: '0.82rem' }}>
            {properties.length} {properties.length === 1 ? 'property' : 'properties'} · {fmt(totalValue)} total value · {fmt(totalEquity)} equity
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Sort */}
          <select
            value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: '0.35rem 0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', color: '#9CA3AF', fontSize: '0.78rem', cursor: 'pointer' }}
          >
            <option value="equity" style={{ background: '#0D1220' }}>Sort: Equity</option>
            <option value="value"  style={{ background: '#0D1220' }}>Sort: Value</option>
            <option value="gain"   style={{ background: '#0D1220' }}>Sort: Gain</option>
            <option value="date"   style={{ background: '#0D1220' }}>Sort: Purchase Date</option>
          </select>
          {/* View toggle */}
          <button style={btnSm(view === 'cards')} onClick={() => setView('cards')}>Cards</button>
          <button style={btnSm(view === 'table')} onClick={() => setView('table')}>Table</button>
          {/* Add */}
          <button onClick={() => setModal('add')} style={{ padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '9px', color: '#0A0F1E', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
            + Add Property
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Total Gain', value: fmt(totalGain), color: totalGain >= 0 ? '#34D399' : '#F87171' },
          { label: 'Total Equity', value: fmt(totalEquity), color: '#C9A84C' },
          { label: 'LTV Ratio', value: properties.length ? `${((totalValue - totalEquity) / totalValue * 100).toFixed(0)}%` : '—', color: '#6BA3FF' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.875rem 1rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#374151', marginBottom: '0.3rem' }}>{label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color, fontFamily: '"Playfair Display", serif' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Cards view */}
      {view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {sorted.map((p) => (
            <div key={p.id} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#E8ECF4', lineHeight: 1.35 }}>{p.address}</div>
                <Badge status={p.status} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {[
                  { label: 'Current Value', value: fmt(p.currentValue), bold: true },
                  { label: 'Equity', value: fmt(equity(p)), color: '#C9A84C' },
                  { label: 'Purchase Price', value: fmt(p.purchasePrice) },
                  { label: 'Gain', value: `${fmt(gain(p))} (${gainPct(p)})`, color: gain(p) >= 0 ? '#34D399' : '#F87171' },
                  { label: 'Mortgage', value: fmt(p.mortgageBalance) },
                  { label: 'Type', value: p.propertyType },
                ].map(({ label, value, bold, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: '0.65rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.1rem' }}>{label}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: bold ? 600 : 400, color: color || '#9CA3AF' }}>{value}</div>
                  </div>
                ))}
              </div>

              {p.notes && (
                <div style={{ fontSize: '0.78rem', color: '#4A5568', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.75rem', lineHeight: 1.5 }}>
                  {p.notes}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <button onClick={() => setModal(p)} style={{ flex: 1, padding: '0.45rem', background: 'rgba(58,125,255,0.08)', border: '1px solid rgba(58,125,255,0.2)', borderRadius: '8px', color: '#6BA3FF', fontSize: '0.78rem', cursor: 'pointer' }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(p.id)} style={{ padding: '0.45rem 0.75rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', color: '#F87171', fontSize: '0.78rem', cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table view */}
      {view === 'table' && (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Address', 'Type', 'Status', 'Purchase', 'Current Value', 'Mortgage', 'Equity', 'Gain', ''].map((h) => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.12em', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    style={{ transition: 'background 0.15s' }}
                  >
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', color: '#E8ECF4', borderBottom: '1px solid rgba(255,255,255,0.04)', maxWidth: '220px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</div>
                      {p.purchaseDate && <div style={{ fontSize: '0.72rem', color: '#374151', marginTop: '0.1rem' }}>{p.purchaseDate}</div>}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', color: '#6B7280', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{p.propertyType}</td>
                    <td style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}><Badge status={p.status} /></td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', color: '#9CA3AF', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{fmt(p.purchasePrice)}</td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: '#E8ECF4', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{fmt(p.currentValue)}</td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', color: '#9CA3AF', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{fmt(p.mortgageBalance)}</td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: '#C9A84C', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{fmt(equity(p))}</td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', color: gain(p) >= 0 ? '#34D399' : '#F87171', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>
                      +{fmt(gain(p))} <span style={{ opacity: 0.7 }}>({gainPct(p)})</span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setModal(p)} style={{ fontSize: '0.75rem', color: '#6BA3FF', background: 'rgba(58,125,255,0.08)', border: '1px solid rgba(58,125,255,0.2)', borderRadius: '6px', padding: '0.25rem 0.6rem', cursor: 'pointer', marginRight: '0.4rem' }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {properties.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#4A5568', fontSize: '0.875rem' }}>
          No properties yet. Add your first property to get started.
        </div>
      )}

      {modal && (
        <PropertyModal
          property={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
