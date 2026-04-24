import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getProperties, getCashflowEntry, setCashflowEntry, netCashflow, lastNMonths } from '../../utils/portalStorage';

const CASH_FLOW_HISTORY = [
  { month: 'May 25', income: 5800, expenses: 4100, net: 1700 },
  { month: 'Jun 25', income: 6100, expenses: 4200, net: 1900 },
  { month: 'Jul 25', income: 6100, expenses: 4350, net: 1750 },
  { month: 'Aug 25', income: 6100, expenses: 4250, net: 1850 },
  { month: 'Sep 25', income: 6100, expenses: 4100, net: 2000 },
  { month: 'Oct 25', income: 6350, expenses: 4200, net: 2150 },
  { month: 'Nov 25', income: 6350, expenses: 4300, net: 2050 },
  { month: 'Dec 25', income: 6350, expenses: 4500, net: 1850 },
  { month: 'Jan 26', income: 6350, expenses: 4250, net: 2100 },
  { month: 'Feb 26', income: 6350, expenses: 4200, net: 2150 },
  { month: 'Mar 26', income: 6350, expenses: 4300, net: 2050 },
  { month: 'Apr 26', income: 6350, expenses: 4150, net: 2200 },
];

const EXPENSE_FIELDS = [
  { key: 'rent',        label: 'Rent',        color: '#34D399' },
  { key: 'mortgage',    label: 'Mortgage',    color: '#F87171' },
  { key: 'tax',         label: 'Tax',         color: '#FCD34D' },
  { key: 'insurance',   label: 'Insurance',   color: '#F59E0B' },
  { key: 'maintenance', label: 'Maintenance', color: '#EF4444' },
  { key: 'management',  label: 'Mgmt Fee',    color: '#A78BFA' },
  { key: 'other',       label: 'Other',       color: '#6B7280' },
];

const fmt$ = (n) => `$${Math.abs(n).toLocaleString()}`;

export default function PortalCashflow() {
  const months = lastNMonths(12);
  const [selectedMonth, setSelectedMonth] = useState(months[months.length - 1]);
  const [properties, setProperties] = useState([]);
  const [data, setData] = useState({}); // { propId: { key: value } }
  const [editingCell, setEditingCell] = useState(null); // { propId, key }
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const props = getProperties();
    setProperties(props);
    const d = {};
    props.forEach((p) => {
      const entry = getCashflowEntry(p.id, selectedMonth);
      // Auto-populate from property defaults when no data exists for the selected month
      if (entry.rent === 0 && p.monthlyRent > 0) entry.rent = p.monthlyRent;
      if (entry.mortgage === 0 && p.monthlyMortgage > 0) entry.mortgage = p.monthlyMortgage;
      if (entry.tax === 0 && p.currentValue > 0) entry.tax = Math.round(p.currentValue * 0.012 / 12);
      if (entry.insurance === 0) entry.insurance = 150;
      if (entry.maintenance === 0) entry.maintenance = 100;
      d[p.id] = entry;
    });
    setData(d);
  }, [selectedMonth]);

  const startEdit = (propId, key, currentVal) => {
    setEditingCell({ propId, key });
    setEditValue(String(currentVal || ''));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { propId, key } = editingCell;
    const newData = { ...data };
    newData[propId] = { ...newData[propId], [key]: parseFloat(editValue) || 0 };
    setData(newData);
    setCashflowEntry(propId, selectedMonth, newData[propId]);
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingCell(null);
  };

  // Column totals
  const colTotals = {};
  EXPENSE_FIELDS.forEach(({ key }) => {
    colTotals[key] = properties.reduce((s, p) => s + (data[p.id]?.[key] || 0), 0);
  });
  const totalNet = properties.reduce((s, p) => s + netCashflow(data[p.id] || {}), 0);

  // 12-month trend data — static historical data for chart
  const trendData = CASH_FLOW_HISTORY;

  const handleExportCSV = () => {
    const rows = [
      ['Property', ...EXPENSE_FIELDS.map((f) => f.label), 'Net Cash Flow'],
      ...properties.map((p) => {
        const e = data[p.id] || {};
        return [
          p.address,
          ...EXPENSE_FIELDS.map(({ key }) => e[key] || 0),
          netCashflow(e),
        ];
      }),
      ['TOTAL', ...EXPENSE_FIELDS.map(({ key }) => colTotals[key] || 0), totalNet],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const thStyle = { padding: '0.75rem 0.875rem', textAlign: 'left', fontSize: '0.63rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.12em', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };
  const tdBase  = { padding: '0.75rem 0.875rem', fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#9CA3AF', whiteSpace: 'nowrap' };
  const tooltipStyle = { background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#E8ECF4', fontSize: '0.82rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.6rem', fontWeight: 700, color: '#E8ECF4', marginBottom: '0.25rem' }}>Cash Flow</h1>
          <p style={{ color: '#4A5568', fontSize: '0.82rem' }}>Click any cell to edit · Changes save automatically</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '0.5rem 0.875rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', color: '#E8ECF4', fontSize: '0.82rem', cursor: 'pointer' }}
          >
            {months.map((m) => (
              <option key={m} value={m} style={{ background: '#0D1220' }}>{m}</option>
            ))}
          </select>
          <button onClick={handleExportCSV} style={{ padding: '0.5rem 1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', color: '#34D399', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Total Income',   value: fmt$(colTotals.rent || 0),    color: '#34D399' },
          { label: 'Total Expenses', value: fmt$((colTotals.mortgage || 0) + (colTotals.tax || 0) + (colTotals.insurance || 0) + (colTotals.maintenance || 0) + (colTotals.management || 0) + (colTotals.other || 0)), color: '#F87171' },
          { label: 'Net Cash Flow',  value: `${totalNet >= 0 ? '+' : '-'}${fmt$(totalNet)}`, color: totalNet >= 0 ? '#C9A84C' : '#EF4444' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#374151', marginBottom: '0.35rem' }}>{label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color, fontFamily: '"Playfair Display", serif' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Editable table */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, minWidth: '200px' }}>Property</th>
                {EXPENSE_FIELDS.map(({ label, color }) => (
                  <th key={label} style={{ ...thStyle, color }}>
                    {label}
                  </th>
                ))}
                <th style={{ ...thStyle, color: '#C9A84C' }}>Net Flow</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => {
                const e = data[p.id] || {};
                const net = netCashflow(e);
                return (
                  <tr key={p.id}
                    onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
                    style={{ transition: 'background 0.15s' }}
                  >
                    <td style={{ ...tdBase, color: '#E8ECF4', fontWeight: 500 }}>
                      <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.address.split(',')[0]}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#374151', marginTop: '0.1rem' }}>{p.propertyType}</div>
                    </td>
                    {EXPENSE_FIELDS.map(({ key, color }) => {
                      const isEditing = editingCell?.propId === p.id && editingCell?.key === key;
                      const val = e[key] || 0;
                      return (
                        <td key={key} style={{ ...tdBase, cursor: 'pointer', minWidth: '88px' }}
                          onClick={() => startEdit(p.id, key, val)}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={(ev) => setEditValue(ev.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={handleKeyDown}
                              style={{ width: '72px', padding: '0.25rem 0.4rem', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: '6px', color: '#E8ECF4', fontSize: '0.82rem', outline: 'none' }}
                            />
                          ) : (
                            <span style={{ color: val > 0 ? color : '#374151' }}>
                              {val > 0 ? `$${val.toLocaleString()}` : '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ ...tdBase, fontWeight: 700, color: net >= 0 ? '#C9A84C' : '#F87171' }}>
                      {net >= 0 ? '+' : '-'}{fmt$(net)}
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <td style={{ ...tdBase, fontWeight: 700, color: '#E8ECF4', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}>TOTAL</td>
                {EXPENSE_FIELDS.map(({ key, color }) => (
                  <td key={key} style={{ ...tdBase, fontWeight: 600, color: colTotals[key] > 0 ? color : '#374151', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}>
                    {colTotals[key] > 0 ? `$${colTotals[key].toLocaleString()}` : '—'}
                  </td>
                ))}
                <td style={{ ...tdBase, fontWeight: 700, fontSize: '0.9rem', color: totalNet >= 0 ? '#C9A84C' : '#F87171', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}>
                  {totalNet >= 0 ? '+' : '-'}{fmt$(totalNet)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Trend chart */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.5rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A5568', marginBottom: '1.25rem' }}>
          12-Month Cash Flow Trend
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trendData} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
            <Tooltip formatter={(v) => fmt$(v)} contentStyle={tooltipStyle} />
            <Legend formatter={(v) => <span style={{ color: '#9CA3AF', fontSize: '0.78rem' }}>{v}</span>} />
            <Bar dataKey="income"   fill="rgba(52,211,153,0.6)" name="Income"   radius={[3,3,0,0]} />
            <Bar dataKey="expenses" fill="rgba(239,68,68,0.5)"  name="Expenses" radius={[3,3,0,0]} />
            <Bar dataKey="net"      fill="rgba(201,168,76,0.8)" name="Net"      radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
