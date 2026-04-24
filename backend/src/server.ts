/**
 * Express Server — IBM Code Engine (port 8080)
 *
 * Each former Lambda handler is wired as an Express route via the
 * lambdaAdapter() wrapper, which constructs an APIGatewayEvent-shaped object
 * so existing handler logic runs unchanged.
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth';

// ── Handlers (same files, same exports) ──────────────────────────────────────
import { handler as adminHandler }         from './handlers/admin';
import { handler as agentMgmtHandler }     from './handlers/agent-management';
import { handler as marketplaceHandler }   from './handlers/marketplace';
import { handler as paymentHandler }       from './handlers/payment';
import { handler as masterLeadsHandler }   from './handlers/master-leads';
import { handler as agentFunnelHandler }   from './handlers/agent-funnel';
import { handler as aiRecsHandler }        from './handlers/ai-recommendations';
import { handler as bulkPackagesHandler }  from './handlers/bulk-packages';
import { handler as leadIntakeHandler }    from './handlers/lead-intake';
import { handler as feedbackHandler }      from './handlers/feedback';

const app  = express();
const PORT = parseInt(process.env.PORT || '8080');

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Raw body for Stripe webhooks BEFORE json parser
app.use('/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Lambda adapter ────────────────────────────────────────────────────────────

/**
 * Converts an Express req/res into a Lambda APIGatewayEvent, calls the handler,
 * then writes the Lambda APIResponse back to Express.
 */
function lambdaAdapter(
  handler: (event: any) => Promise<any>,
  pathParamMap: Record<string, string> = {}
) {
  return async (req: Request, res: Response) => {
    // Build path parameters from Express named params
    const pathParameters: Record<string, string> = {};
    for (const [expressKey, lambdaKey] of Object.entries(pathParamMap)) {
      if (req.params[expressKey]) pathParameters[lambdaKey] = req.params[expressKey];
    }

    const user = (req as any).user || {};

    const event = {
      httpMethod:            req.method,
      path:                  req.path,
      headers:               req.headers as Record<string, string>,
      queryStringParameters: Object.keys(req.query).length
        ? (req.query as Record<string, string>)
        : null,
      pathParameters:        Object.keys(pathParameters).length ? pathParameters : null,
      body:                  req.body
        ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
        : null,
      requestContext: {
        authorizer: {
          claims: {
            sub:               user.sub   || '',
            email:             user.email || '',
            'cognito:groups':  user['cognito:groups'] || [],
          },
        },
        requestId: req.headers['x-request-id'] || '',
      },
      isBase64Encoded: false,
    };

    try {
      const result = await handler(event);
      const body   = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
      res.status(result.statusCode || 200).set(result.headers || {}).send(body);
    } catch (err: any) {
      console.error('Handler threw unhandled error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}

// ── Health check (Code Engine requirement) ───────────────────────────────────

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Public routes (no auth) ───────────────────────────────────────────────────

// Lead intake form submission (public website form)
app.post('/create-lead', lambdaAdapter(leadIntakeHandler));

// Stripe webhook (auth handled internally by Stripe signature)
app.post('/payments/webhook', lambdaAdapter(paymentHandler));

// Feedback
app.post('/feedback', lambdaAdapter(feedbackHandler));

// ── Protected routes ──────────────────────────────────────────────────────────

// Agent profile
app.get('/agents',    requireAuth, lambdaAdapter(agentMgmtHandler));
app.post('/agents',   requireAuth, lambdaAdapter(agentMgmtHandler));
app.put('/agents',    requireAuth, lambdaAdapter(agentMgmtHandler));

// Agent — leads sub-resources
app.get('/agents/assigned-leads',
  requireAuth, lambdaAdapter(agentMgmtHandler));

app.post('/agents/create-lead',
  requireAuth, lambdaAdapter(agentMgmtHandler));

app.post('/agents/leads/:leadId/activity',
  requireAuth, lambdaAdapter(agentMgmtHandler, { leadId: 'leadId' }));

app.put('/agents/leads/:leadId',
  requireAuth, lambdaAdapter(agentMgmtHandler, { leadId: 'leadId' }));

app.delete('/agents/leads/:leadId',
  requireAuth, lambdaAdapter(agentMgmtHandler, { leadId: 'leadId' }));

app.post('/agents/pass-lead/:leadId',
  requireAuth, lambdaAdapter(agentMgmtHandler, { leadId: 'leadId' }));

// Agent AI recommendations
app.post('/agents/ai-recommendations',
  requireAuth, lambdaAdapter(aiRecsHandler));

// Marketplace
app.get('/marketplace',          requireAuth, lambdaAdapter(marketplaceHandler));
app.get('/marketplace/:leadId',  requireAuth, lambdaAdapter(marketplaceHandler, { leadId: 'leadId' }));

// Payments
app.post('/payments/purchase', requireAuth, lambdaAdapter(paymentHandler));
app.post('/payments/refund',   requireAuth, lambdaAdapter(paymentHandler));
app.get('/payments/receipt/:transactionId',
  requireAuth, lambdaAdapter(paymentHandler, { transactionId: 'transactionId' }));

// Admin routes
app.get('/admin',    requireAuth, lambdaAdapter(adminHandler));
app.post('/admin',   requireAuth, lambdaAdapter(adminHandler));
app.put('/admin',    requireAuth, lambdaAdapter(adminHandler));
app.delete('/admin', requireAuth, lambdaAdapter(adminHandler));

// Admin — bulk packages
app.get('/admin/bulk-packages',  requireAuth, lambdaAdapter(bulkPackagesHandler));
app.post('/admin/bulk-packages', requireAuth, lambdaAdapter(bulkPackagesHandler));

// Master leads (shared pool — agents browse, admin manages)
app.get('/master-leads',         requireAuth, lambdaAdapter(masterLeadsHandler));
app.post('/master-leads',        requireAuth, lambdaAdapter(masterLeadsHandler));
app.put('/master-leads/:id',     requireAuth, lambdaAdapter(masterLeadsHandler, { id: 'id' }));
app.delete('/master-leads/:id',  requireAuth, lambdaAdapter(masterLeadsHandler, { id: 'id' }));

// Agent funnel (private per-agent copy)
app.get('/funnel',       requireAuth, lambdaAdapter(agentFunnelHandler));
app.post('/funnel',      requireAuth, lambdaAdapter(agentFunnelHandler));
app.put('/funnel/:id',   requireAuth, lambdaAdapter(agentFunnelHandler, { id: 'id' }));
app.delete('/funnel/:id',requireAuth, lambdaAdapter(agentFunnelHandler, { id: 'id' }));

// ── 404 catch-all ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
