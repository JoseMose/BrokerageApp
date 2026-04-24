/**
 * IBM App ID JWT Authentication Middleware
 *
 * Verifies Bearer tokens issued by IBM App ID using the tenant's JWKS endpoint.
 * Populates req.user with Cognito-compatible claims so all existing handlers
 * work without modification:
 *   req.user.sub              → user ID
 *   req.user.email            → email
 *   req.user['cognito:groups']→ roles array (mapped from App ID roles)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

const TENANT_ID = process.env.APP_ID_TENANT_ID || '';
const REGION    = process.env.APP_ID_REGION    || 'us-south';

// JWKS endpoint for IBM App ID
const JWKS_URI = `https://${REGION}.appid.cloud.ibm.com/oauth/v4/${TENANT_ID}/publickeys`;

const jwksClient = jwksRsa({
  jwksUri: JWKS_URI,
  cache:   true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getKey(header: any, callback: any) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = (key as any).publicKey || (key as any).rsaPublicKey;
    callback(null, signingKey);
  });
}

// ── Middleware ────────────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ success: false, error: 'Authorization token required' });
    return;
  }

  jwt.verify(token, getKey as any, { algorithms: ['RS256'] }, (err, decoded: any) => {
    if (err) {
      console.error('JWT verification failed:', err.message);
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    // Map App ID claims to Cognito-compatible shape
    (req as any).user = {
      sub:               decoded.sub,
      email:             decoded.email || decoded['email'],
      // App ID stores roles in 'roles' array; map to cognito:groups
      'cognito:groups':  decoded.roles || decoded['cognito:groups'] || [],
    };

    next();
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const groups: string[] = user['cognito:groups'] || [];
  if (!groups.includes('Admin') && !groups.includes('Admins')) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }

  next();
}
