/**
 * IBM App ID — OAuth 2.0 Authorization Code + PKCE
 *
 * No external SDK needed. Uses the browser's native SubtleCrypto API.
 *
 * Usage:
 *   login()           → redirects to IBM App ID hosted login/signup
 *   handleCallback()  → exchanges auth code for tokens, stores them
 *   logout()          → clears tokens, redirects to IBM App ID logout
 *   isAuthenticated() → true if a non-expired id_token exists in localStorage
 *   getCurrentUser()  → parses the id_token claims into a user object
 *   getIdToken()      → raw JWT string for use as Bearer token
 */

const REGION    = import.meta.env.VITE_APP_ID_REGION    || 'us-south';
const TENANT_ID = import.meta.env.VITE_APP_ID_TENANT_ID || '';
const CLIENT_ID = import.meta.env.VITE_APP_ID_CLIENT_ID || '';

const BASE_URL     = `https://${REGION}.appid.cloud.ibm.com/oauth/v4/${TENANT_ID}`;
const REDIRECT_URI = `${window.location.origin}/auth/callback`;

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
  const data   = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function login() {
  const verifier   = generateCodeVerifier();
  const challenge  = await generateCodeChallenge(verifier);

  sessionStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         'code',
    scope:                 'openid email profile',
    redirect_uri:          REDIRECT_URI,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${BASE_URL}/authorization?${params}`;
}

export async function handleCallback(code) {
  const verifier = sessionStorage.getItem('pkce_verifier');
  if (!verifier) throw new Error('No PKCE verifier found — please try logging in again.');

  const response = await fetch(`${BASE_URL}/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     CLIENT_ID,
      code,
      redirect_uri:  REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  const tokens = await response.json();

  localStorage.setItem('ibm_id_token',      tokens.id_token);
  localStorage.setItem('ibm_access_token',  tokens.access_token);
  if (tokens.refresh_token) {
    localStorage.setItem('ibm_refresh_token', tokens.refresh_token);
  }

  sessionStorage.removeItem('pkce_verifier');

  return tokens;
}

export function getIdToken() {
  return localStorage.getItem('ibm_id_token');
}

export function isAuthenticated() {
  const token = getIdToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function getCurrentUser() {
  const token = getIdToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      sub:               payload.sub,
      email:             payload.email || '',
      name:              payload.name  || payload.email || '',
      username:          payload.email || payload.sub,
      'cognito:groups':  payload.roles || payload['cognito:groups'] || [],
    };
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem('ibm_id_token');
  localStorage.removeItem('ibm_access_token');
  localStorage.removeItem('ibm_refresh_token');

  const params = new URLSearchParams({
    client_id:    CLIENT_ID,
    redirect_uri: `${window.location.origin}/`,
  });
  window.location.href = `${BASE_URL}/logout?${params}`;
}
