// Portal data layer — all persisted in localStorage for V1
const KEYS = {
  session:    'je_portal_session',
  properties: 'je_portfolio',
  cashflow:   'je_cashflow',
  documents:  'je_documents',
  alerts:     'je_alerts',
};

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED_PROPERTIES = [
  {
    id: 'prop_001',
    address: '2847 Peachtree Rd NE, Atlanta, GA 30305',
    purchaseDate: '2022-03-15',
    purchasePrice: 320000,
    currentValue: 385000,
    mortgageBalance: 270000,
    monthlyRent: 2400,
    monthlyMortgage: 1650,
    propertyType: 'SFR',
    status: 'Holding',
    notes: 'Buckhead. Long-term tenant at $2,400/mo. Strong appreciation corridor.',
  },
  {
    id: 'prop_002',
    address: '1104 Edgewood Ave SE, Atlanta, GA 30307',
    purchaseDate: '2023-08-20',
    purchasePrice: 285000,
    currentValue: 312000,
    mortgageBalance: 247000,
    monthlyRent: 2100,
    monthlyMortgage: 1420,
    propertyType: 'SFR',
    status: 'Holding',
    notes: 'Inman Park. Appreciating ~8% annually. Short-term rental candidate.',
  },
  {
    id: 'prop_003',
    address: '415 Auburn Ave NE, Atlanta, GA 30312',
    purchaseDate: '2021-11-05',
    purchasePrice: 195000,
    currentValue: 268000,
    mortgageBalance: 132000,
    monthlyRent: 1850,
    monthlyMortgage: 1180,
    propertyType: 'SFR',
    status: 'Holding',
    notes: 'Old Fourth Ward. Paid down aggressively. Highest cash-on-cash return.',
  },
];

const SEED_CASHFLOW = {
  prop_001: {
    '2026-01': { rent: 2400, mortgage: 1650, tax: 385, insurance: 150, maintenance: 0,   management: 0, other: 40  },
    '2026-02': { rent: 2400, mortgage: 1650, tax: 385, insurance: 150, maintenance: 250, management: 0, other: 0   },
    '2026-03': { rent: 2400, mortgage: 1650, tax: 385, insurance: 150, maintenance: 0,   management: 0, other: 65  },
    '2026-04': { rent: 2400, mortgage: 1650, tax: 385, insurance: 150, maintenance: 100, management: 0, other: 0   },
  },
  prop_002: {
    '2026-01': { rent: 2100, mortgage: 1420, tax: 312, insurance: 150, maintenance: 120, management: 0, other: 0   },
    '2026-02': { rent: 2100, mortgage: 1420, tax: 312, insurance: 150, maintenance: 0,   management: 0, other: 0   },
    '2026-03': { rent: 2100, mortgage: 1420, tax: 312, insurance: 150, maintenance: 0,   management: 0, other: 30  },
    '2026-04': { rent: 2100, mortgage: 1420, tax: 312, insurance: 150, maintenance: 100, management: 0, other: 0   },
  },
  prop_003: {
    '2026-01': { rent: 1850, mortgage: 1180, tax: 268, insurance: 150, maintenance: 0,   management: 0, other: 0   },
    '2026-02': { rent: 1850, mortgage: 1180, tax: 268, insurance: 150, maintenance: 400, management: 0, other: 0   },
    '2026-03': { rent: 1850, mortgage: 1180, tax: 268, insurance: 150, maintenance: 0,   management: 0, other: 20  },
    '2026-04': { rent: 1850, mortgage: 1180, tax: 268, insurance: 150, maintenance: 100, management: 0, other: 0   },
  },
};

const SEED_DOCUMENTS = [
  {
    id: 'doc_001',
    name: '2847 Peachtree Rd NE — Closing Disclosure',
    category: 'Closing Documents',
    propertyId: 'prop_001',
    fileType: 'PDF',
    fileSize: '2.4 MB',
    notes: '',
    fileRef: '',
    uploadedAt: '2024-03-15T00:00:00.000Z',
  },
  {
    id: 'doc_002',
    name: '1104 Edgewood Ave SE — Closing Disclosure',
    category: 'Closing Documents',
    propertyId: 'prop_002',
    fileType: 'PDF',
    fileSize: '2.1 MB',
    notes: '',
    fileRef: '',
    uploadedAt: '2024-08-22T00:00:00.000Z',
  },
  {
    id: 'doc_003',
    name: '415 Auburn Ave NE — Home Inspection Report',
    category: 'Inspection Reports',
    propertyId: 'prop_003',
    fileType: 'PDF',
    fileSize: '5.8 MB',
    notes: '',
    fileRef: '',
    uploadedAt: '2023-11-10T00:00:00.000Z',
  },
  {
    id: 'doc_004',
    name: '2847 Peachtree Rd NE — Lease Agreement',
    category: 'Leases & Rental Agreements',
    propertyId: 'prop_001',
    fileType: 'PDF',
    fileSize: '1.2 MB',
    notes: '',
    fileRef: '',
    uploadedAt: '2024-04-01T00:00:00.000Z',
  },
  {
    id: 'doc_005',
    name: '1104 Edgewood Ave SE — Insurance Policy 2026',
    category: 'Insurance Policies',
    propertyId: 'prop_002',
    fileType: 'PDF',
    fileSize: '0.9 MB',
    notes: '',
    fileRef: '',
    uploadedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'doc_006',
    name: 'Portfolio Q1 2026 Summary',
    category: 'Miscellaneous',
    propertyId: '',
    fileType: 'PDF',
    fileSize: '1.7 MB',
    notes: '',
    fileRef: '',
    uploadedAt: '2026-04-01T00:00:00.000Z',
  },
];

const SEED_ALERTS = [
  { id: 'alert_001', type: 'equity_milestone', label: 'Equity Milestone', description: '2847 Peachtree Rd — alert when equity hits 40%', threshold: '40', status: 'Active',  createdAt: '2026-01-15' },
  { id: 'alert_002', type: 'cashflow_drop',    label: 'Cash Flow Drop',   description: 'Portfolio — alert if monthly net drops below $1,500', threshold: '1500', status: 'Active',  createdAt: '2026-02-01' },
  { id: 'alert_003', type: 'rate_alert',       label: 'Rate Watch',       description: 'Alert when 30-yr fixed drops below 6.0%', threshold: '6.0',  status: 'Paused', createdAt: '2026-03-10' },
];

// ── Auth ───────────────────────────────────────────────────────────────────────
export const isPortalAuthenticated = () =>
  localStorage.getItem(KEYS.session) === 'authenticated';

export const setPortalSession = () =>
  localStorage.setItem(KEYS.session, 'authenticated');

export const clearPortalSession = () =>
  localStorage.removeItem(KEYS.session);

// ── Properties ────────────────────────────────────────────────────────────────
export const getProperties = () => {
  const raw = localStorage.getItem(KEYS.properties);
  return raw ? JSON.parse(raw) : [];
};

const saveProperties = (arr) =>
  localStorage.setItem(KEYS.properties, JSON.stringify(arr));

export const addProperty = (prop) =>
  saveProperties([...getProperties(), { ...prop, id: `prop_${Date.now()}` }]);

export const updateProperty = (id, data) =>
  saveProperties(getProperties().map((p) => (p.id === id ? { ...p, ...data } : p)));

export const deleteProperty = (id) =>
  saveProperties(getProperties().filter((p) => p.id !== id));

// ── Cashflow ──────────────────────────────────────────────────────────────────
export const getCashflow = () => {
  const raw = localStorage.getItem(KEYS.cashflow);
  return raw ? JSON.parse(raw) : {};
};

const saveCashflow = (data) =>
  localStorage.setItem(KEYS.cashflow, JSON.stringify(data));

export const getCashflowEntry = (propId, month) => {
  const cf = getCashflow();
  return cf[propId]?.[month] || { rent: 0, mortgage: 0, tax: 0, insurance: 0, maintenance: 0, management: 0, other: 0 };
};

export const setCashflowEntry = (propId, month, data) => {
  const cf = getCashflow();
  if (!cf[propId]) cf[propId] = {};
  cf[propId][month] = data;
  saveCashflow(cf);
};

// Returns net cash flow for a property+month
export const netCashflow = (entry) => {
  const { rent = 0, mortgage = 0, tax = 0, insurance = 0, maintenance = 0, management = 0, other = 0 } = entry;
  return rent - mortgage - tax - insurance - maintenance - management - other;
};

// Returns last N months as 'YYYY-MM' strings
export const lastNMonths = (n = 12) => {
  const result = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    result.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
};

// ── Documents ─────────────────────────────────────────────────────────────────
export const getDocuments = () => {
  const raw = localStorage.getItem(KEYS.documents);
  return raw ? JSON.parse(raw) : [];
};

const saveDocuments = (arr) =>
  localStorage.setItem(KEYS.documents, JSON.stringify(arr));

export const addDocument = (doc) =>
  saveDocuments([
    ...getDocuments(),
    { ...doc, id: `doc_${Date.now()}`, uploadedAt: new Date().toISOString() },
  ]);

export const deleteDocument = (id) =>
  saveDocuments(getDocuments().filter((d) => d.id !== id));

// ── Alerts ────────────────────────────────────────────────────────────────────
export const getAlerts = () => {
  const raw = localStorage.getItem(KEYS.alerts);
  return raw ? JSON.parse(raw) : [];
};

const saveAlerts = (arr) =>
  localStorage.setItem(KEYS.alerts, JSON.stringify(arr));

export const addAlert = (alert) =>
  saveAlerts([...getAlerts(), { ...alert, id: `alert_${Date.now()}`, createdAt: new Date().toISOString().split('T')[0] }]);

export const updateAlert = (id, data) =>
  saveAlerts(getAlerts().map((a) => (a.id === id ? { ...a, ...data } : a)));

export const deleteAlert = (id) =>
  saveAlerts(getAlerts().filter((a) => a.id !== id));

// ── Seed ──────────────────────────────────────────────────────────────────────
const SEED_VERSION = '2';

export const seedIfEmpty = () => {
  // Version bump forces a full re-seed with updated property data and documents
  if (localStorage.getItem('je_seed_v') !== SEED_VERSION) {
    saveProperties(SEED_PROPERTIES);
    saveCashflow(SEED_CASHFLOW);
    saveAlerts(SEED_ALERTS);
    saveDocuments(SEED_DOCUMENTS);
    localStorage.setItem('je_seed_v', SEED_VERSION);
  }
};
