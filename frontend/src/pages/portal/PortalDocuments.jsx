import React, { useState, useEffect } from 'react';
import { getDocuments, addDocument, deleteDocument, getProperties } from '../../utils/portalStorage';

const CATEGORIES = [
  'Closing Documents',
  'Leases & Rental Agreements',
  'Inspection Reports',
  'Insurance Policies',
  'Tax Documents',
  'Mortgage Statements',
  'Appraisals',
  'HOA Documents',
  'Miscellaneous',
];

const CAT_ICONS = {
  'Closing Documents':         '📋',
  'Leases & Rental Agreements':'📄',
  'Inspection Reports':        '🔍',
  'Insurance Policies':        '🛡',
  'Tax Documents':             '🏛',
  'Mortgage Statements':       '🏦',
  'Appraisals':                '📊',
  'HOA Documents':             '🏘',
  'Miscellaneous':             '📁',
};

const EMPTY_FORM = { name: '', category: CATEGORIES[0], propertyId: '', notes: '', fileRef: '' };

function AddDocModal({ properties, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
        <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.2rem', color: '#E8ECF4', marginBottom: '1.5rem' }}>Add Document</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Document Name *</label>
            <input style={fieldStyle} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Closing Docs — 2847 Peachtree.pdf" />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c} style={{ background: '#0D1220' }}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Property (optional)</label>
            <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)}>
              <option value="" style={{ background: '#0D1220' }}>— Portfolio-wide —</option>
              {properties.map((p) => <option key={p.id} value={p.id} style={{ background: '#0D1220' }}>{p.address.split(',')[0]}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>File Reference / Path</label>
            <input style={fieldStyle} value={form.fileRef} onChange={(e) => set('fileRef', e.target.value)} placeholder="/documents/closings/2847-peachtree.pdf" />
            <p style={{ fontSize: '0.72rem', color: '#374151', marginTop: '0.35rem' }}>Place files in <code style={{ color: '#C9A84C', fontSize: '0.7rem' }}>frontend/public/documents/</code> for portal access.</p>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...fieldStyle, resize: 'vertical', minHeight: '60px' }} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Additional context..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
          <button onClick={() => { if (form.name) { onSave(form); onClose(); } }} disabled={!form.name} style={{ padding: '0.625rem 1.5rem', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '10px', color: '#0A0F1E', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: !form.name ? 0.5 : 1 }}>
            Add Document
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortalDocuments() {
  const [documents, setDocuments]   = useState([]);
  const [properties, setProperties] = useState([]);
  const [filterCat, setFilterCat]   = useState('All');
  const [filterProp, setFilterProp] = useState('');
  const [search, setSearch]         = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [toast, setToast]           = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const reload = () => {
    setDocuments(getDocuments());
    setProperties(getProperties());
  };

  useEffect(() => { reload(); }, []);

  const filtered = documents.filter((d) => {
    if (filterCat !== 'All' && d.category !== filterCat) return false;
    if (filterProp && d.propertyId !== filterProp) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getPropName = (id) => {
    if (!id) return 'Portfolio';
    const p = properties.find((p) => p.id === id);
    return p ? p.address.split(',')[0] : 'Unknown';
  };

  const catCounts = {};
  CATEGORIES.forEach((c) => {
    catCounts[c] = documents.filter((d) => d.category === c).length;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.6rem', fontWeight: 700, color: '#E8ECF4', marginBottom: '0.25rem' }}>Document Vault</h1>
          <p style={{ color: '#4A5568', fontSize: '0.82rem' }}>{documents.length} documents across {new Set(documents.map((d) => d.category)).size} categories</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '9px', color: '#0A0F1E', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
          + Add Document
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          style={{ padding: '0.45rem 0.875rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#E8ECF4', fontSize: '0.82rem', outline: 'none', width: '200px' }}
        />
        <select
          value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          style={{ padding: '0.45rem 0.875rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', color: '#9CA3AF', fontSize: '0.78rem', cursor: 'pointer' }}
        >
          <option value="All" style={{ background: '#0D1220' }}>All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c} style={{ background: '#0D1220' }}>{c} ({catCounts[c] || 0})</option>)}
        </select>
        <select
          value={filterProp} onChange={(e) => setFilterProp(e.target.value)}
          style={{ padding: '0.45rem 0.875rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', color: '#9CA3AF', fontSize: '0.78rem', cursor: 'pointer' }}
        >
          <option value="" style={{ background: '#0D1220' }}>All Properties</option>
          {properties.map((p) => <option key={p.id} value={p.id} style={{ background: '#0D1220' }}>{p.address.split(',')[0]}</option>)}
        </select>
      </div>

      {/* Category grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
        {CATEGORIES.map((c) => {
          const count = catCounts[c] || 0;
          const active = filterCat === c;
          return (
            <button key={c} onClick={() => setFilterCat(active ? 'All' : c)} style={{
              padding: '0.875rem 0.75rem', background: active ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${active ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>{CAT_ICONS[c]}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: active ? '#C9A84C' : '#9CA3AF', lineHeight: 1.3 }}>{c}</div>
              <div style={{ fontSize: '0.68rem', color: '#374151', marginTop: '0.15rem' }}>{count} {count === 1 ? 'file' : 'files'}</div>
            </button>
          );
        })}
      </div>

      {/* Document list */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#374151', fontSize: '0.875rem' }}>
            {documents.length === 0 ? 'No documents yet. Add your first document to get started.' : 'No documents match your filters.'}
          </div>
        ) : (
          filtered.map((doc, i) => (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
              borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              transition: 'background 0.15s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
                {CAT_ICONS[doc.category] || '📄'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#E8ECF4', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.15rem' }}>{doc.name}</div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: '#4A5568' }}>{doc.category}</span>
                  <span style={{ fontSize: '0.72rem', color: '#374151' }}>·</span>
                  <span style={{ fontSize: '0.72rem', color: '#4A5568' }}>{getPropName(doc.propertyId)}</span>
                  {doc.fileSize && (
                    <>
                      <span style={{ fontSize: '0.72rem', color: '#374151' }}>·</span>
                      <span style={{ fontSize: '0.72rem', color: '#374151' }}>{doc.fileType || 'PDF'} · {doc.fileSize}</span>
                    </>
                  )}
                  {doc.uploadedAt && (
                    <>
                      <span style={{ fontSize: '0.72rem', color: '#374151' }}>·</span>
                      <span style={{ fontSize: '0.72rem', color: '#374151' }}>{doc.uploadedAt.split('T')[0]}</span>
                    </>
                  )}
                </div>
                {doc.notes && <div style={{ fontSize: '0.75rem', color: '#374151', marginTop: '0.2rem' }}>{doc.notes}</div>}
              </div>
              <button
                onClick={() => showToast('Download feature coming soon')}
                style={{ padding: '0.35rem 0.75rem', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '7px', color: '#C9A84C', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}
              >
                Download
              </button>
              <button onClick={() => { if (confirm('Remove this document?')) { deleteDocument(doc.id); reload(); } }} style={{ padding: '0.35rem 0.6rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '7px', color: '#F87171', fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0 }}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <AddDocModal
          properties={properties}
          onClose={() => setShowModal(false)}
          onSave={(doc) => { addDocument(doc); reload(); }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1A2335', border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: '10px', padding: '0.75rem 1.5rem',
          color: '#E8ECF4', fontSize: '0.875rem', zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
