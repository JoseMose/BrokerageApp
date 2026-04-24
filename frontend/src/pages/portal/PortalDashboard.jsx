import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getProperties, getCashflow, netCashflow, lastNMonths } from '../../utils/portalStorage';

// Fix 3 — realistic 12-month portfolio value trend
const PORTFOLIO_TREND = [
  { month: 'May 25', value: 880000 },
  { month: 'Jun 25', value: 892000 },
  { month: 'Jul 25', value: 898000 },
  { month: 'Aug 25', value: 905000 },
  { month: 'Sep 25', value: 912000 },
  { month: 'Oct 25', value: 918000 },
  { month: 'Nov 25', value: 928000 },
  { month: 'Dec 25', value: 935000 },
  { month: 'Jan 26', value: 942000 },
  { month: 'Feb 26', value: 950000 },
  { month: 'Mar 26', value: 958000 },
  { month: 'Apr 26', value: 965000 },
];

// Fix 4 — full 12-month cash flow history
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

const fmt = (n) => `$${Math.abs(n).toLocaleString()}`;
const pct = (a, b) => b === 0 ? '—' : `${((a / b) * 100).toFixed(1)}%`;

const CARD_COLORS = ['#C9A84C', '#10B981', '#3A7DFF', '#8B5CF6', '#F59E0B'];
const CHART_COLORS = ['#C9A84C', '#10B981', '#3A7DFF', '#EF4444'];

function StatCard({ label, value, sub, color = '#C9A84C', positive }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `3px solid ${color}`, borderRadius: '14px', padding: '1.25rem 1.5rem',
      transition: 'transform 0.2s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#4A5568', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#E8ECF4', fontFamily: '"Playfair Display", serif', lineHeight: 1.1, marginBottom: '0.35rem' }}>{value}</div>
      {sub && (
        <div style={{ fontSize: '0.78rem', color: positive === true ? '#34D399' : positive === false ? '#F87171' : '#6B7280' }}>{sub}</div>
      )}
    </div>
  );
}

export default function PortalDashboard() {
  const [properties, setProperties] = useState([]);
  const [cashflow, setCashflow] = useState({});
  const months = lastNMonths(12);

  useEffect(() => {
    setProperties(getProperties());
    setCashflow(getCashflow());
  }, []);

  if (properties.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ color: '#4A5568', marginBottom: '1rem', fontSize: '0.875rem' }}>No properties yet.</div>
        <a href="/portal/properties" style={{ color: '#C9A84C', fontSize: '0.875rem', textDecoration: 'none' }}>Add your first property →</a>
      </div>
    );
  }

  // ── Computed stats ──────────────────────────────────────────────────────────
  const totalValue     = properties.reduce((s, p) => s + (p.currentValue || 0), 0);
  const totalDebt      = properties.reduce((s, p) => s + (p.mortgageBalance || 0), 0);
  const totalInvested  = properties.reduce((s, p) => s + (p.purchasePrice || 0), 0);
  const totalEquity    = totalValue - totalDebt;
  const unrealizedGain = totalValue - totalInvested;

  const currentMonth = months[months.length - 1];
  let monthlyNet = 0;
  properties.forEach((p) => {
    const entry = cashflow[p.id]?.[currentMonth];
    if (entry) monthlyNet += netCashflow(entry);
  });

  // Fix 3 — static 12-month portfolio value trend
  const valueHistory = PORTFOLIO_TREND;

  // Fix 4 — static 12-month cash flow history
  const cashflowHistory = CASH_FLOW_HISTORY;

  // ── Equity per property (pie) ──────────────────────────────────────────────
  const equityPie = properties.map((p) => ({
    name: p.address.split(',')[0],
    value: Math.max(0, (p.currentValue || 0) - (p.mortgageBalance || 0)),
  }));

  const tooltipStyle = {
    background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
    color: '#E8ECF4', fontSize: '0.82rem',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page header */}
      <div>
        <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.6rem', fontWeight: 700, color: '#E8ECF4', marginBottom: '0.25rem' }}>
          Portfolio Overview
        </h1>
        <p style={{ color: '#4A5568', fontSize: '0.82rem' }}>{properties.length} properties · Atlanta metro</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
        <StatCard
          label="Portfolio Value"
          value={fmt(totalValue)}
          sub={`${properties.length} properties`}
          color="#C9A84C"
        />
        <StatCard
          label="Total Equity"
          value={fmt(totalEquity)}
          sub={pct(totalEquity, totalValue) + ' LTV hedge'}
          color="#10B981"
          positive={true}
        />
        <StatCard
          label="Total Invested"
          value={fmt(totalInvested)}
          sub="Acquisition cost"
          color="#3A7DFF"
        />
        <StatCard
          label="Unrealized Gain"
          value={fmt(unrealizedGain)}
          sub={`${pct(unrealizedGain, totalInvested)} appreciation`}
          color="#8B5CF6"
          positive={unrealizedGain >= 0}
        />
        <StatCard
          label="Monthly Cash Flow"
          value={`${monthlyNet >= 0 ? '+' : ''}${fmt(monthlyNet)}`}
          sub={`${months[months.length - 1]}`}
          color={monthlyNet >= 0 ? '#10B981' : '#EF4444'}
          positive={monthlyNet >= 0}
        />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
        {/* Portfolio value trend */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A5568', marginBottom: '1.25rem' }}>
            Portfolio Value — 12 Month Trend
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={valueHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="#C9A84C" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Equity breakdown pie */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A5568', marginBottom: '1.25rem' }}>
            Equity Distribution
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={equityPie}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {equityPie.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle} />
              <Legend formatter={(v) => <span style={{ color: '#9CA3AF', fontSize: '0.78rem' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cash flow bar chart */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.5rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A5568', marginBottom: '1.25rem' }}>
          Monthly Cash Flow — Last 12 Months
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={cashflowHistory} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
            <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle} />
            <Legend formatter={(v) => <span style={{ color: '#9CA3AF', fontSize: '0.78rem' }}>{v}</span>} />
            <Bar dataKey="income"   fill="rgba(16,185,129,0.7)"  name="Income" radius={[3,3,0,0]} />
            <Bar dataKey="expenses" fill="rgba(239,68,68,0.5)"   name="Expenses" radius={[3,3,0,0]} />
            <Bar dataKey="net"      fill="rgba(201,168,76,0.85)" name="Net" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Property quick-view */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A5568' }}>Properties</span>
          <a href="/portal/properties" style={{ fontSize: '0.78rem', color: '#C9A84C', textDecoration: 'none' }}>View all →</a>
        </div>
        {properties.map((p) => {
          const equity = (p.currentValue || 0) - (p.mortgageBalance || 0);
          const gain   = (p.currentValue || 0) - (p.purchasePrice || 0);
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              transition: 'background 0.15s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#E8ECF4', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.address}
                </div>
                <div style={{ color: '#4A5568', fontSize: '0.75rem' }}>{p.propertyType} · {p.status}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: '#E8ECF4', fontSize: '0.9rem', fontWeight: 600 }}>{fmt(p.currentValue || 0)}</div>
                <div style={{ color: '#34D399', fontSize: '0.75rem' }}>+{fmt(gain)} gain</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: '#C9A84C', fontSize: '0.9rem', fontWeight: 600 }}>{fmt(equity)}</div>
                <div style={{ color: '#4A5568', fontSize: '0.75rem' }}>equity</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
