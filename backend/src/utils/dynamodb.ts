/**
 * IBM Cloudant Database Service
 * Drop-in replacement for the DynamoDB service — same public interface,
 * Cloudant under the hood.  Handler files require zero changes.
 *
 * Table → Cloudant database mapping:
 *   RealtorLeads      → leads
 *   RealtorAgents     → agents
 *   RealtorTransactions → transactions
 *   MasterLeads       → master-leads
 *   AgentFunnel       → agent-funnel
 */

import { CloudantV1 } from '@ibm-cloud/cloudant';
import { IamAuthenticator } from 'ibm-cloud-sdk-core';

// ── Client setup ────────────────────────────────────────────────────────────

const authenticator = new IamAuthenticator({
  apikey: process.env.CLOUDANT_API_KEY || '',
});

const cloudant = new CloudantV1({ authenticator });
cloudant.setServiceUrl(process.env.CLOUDANT_URL || '');

// ── Table → DB name map ──────────────────────────────────────────────────────

const TABLE_DB_MAP: Record<string, string> = {
  RealtorLeads:        'leads',
  RealtorAgents:       'agents',
  RealtorTransactions: 'transactions',
  MasterLeads:         'master-leads',
  AgentFunnel:         'agent-funnel',
};

function dbName(tableName: string): string {
  return TABLE_DB_MAP[tableName] || tableName.toLowerCase().replace(/_/g, '-');
}

// ── Primary-key helpers ──────────────────────────────────────────────────────

/**
 * Derive a Cloudant `_id` from a DynamoDB composite key object.
 * Rules:
 *   { leadId }              → leadId
 *   { transactionId }       → transactionId
 *   { id }                  → id
 *   { agentId, SK:'profile'}→ agentId
 *   { agentId, SK }         → agentId:SK
 *   { agentId, id }         → agentId:id
 */
function docId(key: Record<string, any>): string {
  const { leadId, transactionId, id, agentId, SK } = key;

  if (leadId)        return leadId;
  if (transactionId) return transactionId;
  if (id && !agentId) return id;

  if (agentId) {
    if (!SK || SK === 'profile') return agentId;
    if (id) return `${agentId}:${id}`;
    return `${agentId}:${SK}`;
  }

  // Fallback: join values in insertion order
  return Object.values(key).filter(Boolean).join(':');
}

// ── Update-expression parser ─────────────────────────────────────────────────

interface ParsedUpdate {
  sets:    Record<string, any>;   // field → value
  removes: string[];              // fields to delete
}

/**
 * Parse a subset of DynamoDB UpdateExpression syntax.
 * Supports: SET f = :v, #alias = :v, f.nested = :v   REMOVE f1, f2
 */
function parseUpdateExpression(
  expr: string,
  values: Record<string, any>,
  names?: Record<string, string>
): ParsedUpdate {
  const result: ParsedUpdate = { sets: {}, removes: [] };

  // Normalise expression attribute names
  const resolve = (token: string): string => {
    if (names && token.startsWith('#')) return names[token] || token;
    return token;
  };

  // Split on SET / REMOVE keywords (case-insensitive)
  const setMatch    = expr.match(/SET\s+([\s\S]+?)(?=\s+REMOVE|$)/i);
  const removeMatch = expr.match(/REMOVE\s+([\s\S]+?)(?=\s+SET|$)/i);

  if (setMatch) {
    const parts = setMatch[1].split(',');
    for (const part of parts) {
      const [lhs, rhs] = part.split('=').map(s => s.trim());
      if (!lhs || !rhs) continue;
      const field = resolve(lhs);
      const value = values[rhs.trim()];
      if (value !== undefined) result.sets[field] = value;
    }
  }

  if (removeMatch) {
    const fields = removeMatch[1].split(',').map(f => resolve(f.trim()));
    result.removes.push(...fields);
  }

  return result;
}

// ── Mango selector builder ───────────────────────────────────────────────────

/**
 * Convert a DynamoDB KeyConditionExpression + values to a Cloudant Mango selector.
 *
 * Handles common patterns:
 *   "leadId = :leadId"
 *   "agentId = :agentId AND SK = :sk"
 *   "GSI1PK = :pk"
 */
function buildSelector(expression: string, values: Record<string, any>): Record<string, any> {
  const selector: Record<string, any> = {};

  // Split on AND
  const clauses = expression.split(/\s+AND\s+/i);

  for (const clause of clauses) {
    // field = :placeholder
    const eqMatch = clause.match(/^\s*([\w#.]+)\s*=\s*(:[\w]+)\s*$/);
    if (eqMatch) {
      const field = eqMatch[1].replace(/^#/, '');
      const placeholder = eqMatch[2];
      if (values[placeholder] !== undefined) selector[field] = values[placeholder];
      continue;
    }

    // begins_with(field, :placeholder)
    const bwMatch = clause.match(/begins_with\s*\(\s*([\w.]+)\s*,\s*(:[\w]+)\s*\)/i);
    if (bwMatch) {
      const field = bwMatch[1];
      const val   = values[bwMatch[2]];
      if (val !== undefined) {
        selector[field] = { $gte: val, $lt: val + '\uffff' };
      }
    }
  }

  return selector;
}

/**
 * Convert a DynamoDB FilterExpression to a Mango selector fragment.
 * Only the patterns actually used in this codebase are implemented.
 */
function buildFilterSelector(
  expression: string,
  values: Record<string, any>,
  names?: Record<string, string>
): Record<string, any> {
  // Re-use the key condition builder (same syntax subset)
  // Resolve #aliases first
  let resolved = expression;
  if (names) {
    for (const [alias, field] of Object.entries(names)) {
      resolved = resolved.replace(new RegExp(alias, 'g'), field);
    }
  }
  return buildSelector(resolved, values);
}

// ── Ensure database exists (lazy) ────────────────────────────────────────────

const _ensured = new Set<string>();

async function ensureDb(db: string): Promise<void> {
  if (_ensured.has(db)) return;
  try {
    await cloudant.getDatabaseInformation({ db });
  } catch {
    await cloudant.putDatabase({ db });
  }
  _ensured.add(db);
}

// ── Public DynamoDBService (Cloudant-backed) ─────────────────────────────────

export class DynamoDBService {
  // ── PUT ──────────────────────────────────────────────────────────────────

  static async putItem(tableName: string, item: any): Promise<void> {
    const db = dbName(tableName);
    await ensureDb(db);

    const _id = docId(item);
    const document: any = { ...item, _id };

    // Fetch existing _rev so we can overwrite rather than conflict
    try {
      const existing = await cloudant.getDocument({ db, docId: _id });
      document._rev = (existing.result as any)._rev;
    } catch {
      // Document doesn't exist yet — that's fine
    }

    await cloudant.putDocument({ db, docId: _id, document });
  }

  // ── GET ──────────────────────────────────────────────────────────────────

  static async getItem(tableName: string, key: any): Promise<any> {
    const db = dbName(tableName);
    await ensureDb(db);

    try {
      const res = await cloudant.getDocument({ db, docId: docId(key) });
      const doc: any = res.result;
      // Remove Cloudant-internal fields before returning
      const { _id, _rev, ...rest } = doc;
      return rest;
    } catch (err: any) {
      if (err.status === 404) return undefined;
      throw err;
    }
  }

  // ── QUERY ─────────────────────────────────────────────────────────────────

  static async queryItems(
    tableName: string,
    keyConditionExpression: string,
    expressionAttributeValues: any,
    _indexName?: string,              // indexes auto-resolved by Mango
    expressionAttributeNames?: any,
    filterExpression?: string
  ): Promise<any[]> {
    const db = dbName(tableName);
    await ensureDb(db);

    let selector = buildSelector(keyConditionExpression, expressionAttributeValues);

    if (filterExpression) {
      const filterSelector = buildFilterSelector(
        filterExpression,
        expressionAttributeValues,
        expressionAttributeNames
      );
      selector = { ...selector, ...filterSelector };
    }

    const res = await cloudant.postFind({
      db,
      selector,
      limit: 2000,
    });

    return ((res.result as any).docs || []).map(({ _id, _rev, ...rest }: any) => rest);
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  static async updateItem(
    tableName: string,
    key: any,
    updateExpression: string,
    expressionAttributeValues: any,
    expressionAttributeNames?: any
  ): Promise<any> {
    const db = dbName(tableName);
    await ensureDb(db);

    const _id = docId(key);

    // Fetch current document (need _rev to update)
    let existing: any = {};
    let _rev: string | undefined;
    try {
      const res = await cloudant.getDocument({ db, docId: _id });
      const doc: any = res.result;
      _rev    = doc._rev;
      const { _id: _unused, _rev: _unused2, ...fields } = doc;
      existing = fields;
    } catch (err: any) {
      if (err.status !== 404) throw err;
      // Document doesn't exist yet — will create
    }

    const { sets, removes } = parseUpdateExpression(
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );

    // Apply updates
    const updated = { ...existing, ...sets };
    for (const field of removes) delete updated[field];

    const document: any = { ...updated, _id };
    if (_rev) document._rev = _rev;

    await cloudant.putDocument({ db, docId: _id, document });

    return updated;
  }

  // ── SCAN ──────────────────────────────────────────────────────────────────

  static async scanItems(
    tableName: string,
    filterExpression?: string,
    expressionAttributeValues?: any,
    expressionAttributeNames?: any
  ): Promise<any[]> {
    const db = dbName(tableName);
    await ensureDb(db);

    let selector: Record<string, any> = {};

    if (filterExpression && expressionAttributeValues) {
      selector = buildFilterSelector(
        filterExpression,
        expressionAttributeValues,
        expressionAttributeNames
      );
    }

    const res = await cloudant.postFind({
      db,
      selector,
      limit: 10000, // high limit — scan means "get everything"
    });

    return ((res.result as any).docs || []).map(({ _id, _rev, ...rest }: any) => rest);
  }

  // ── DELETE ────────────────────────────────────────────────────────────────

  static async deleteItem(tableName: string, key: any): Promise<void> {
    const db = dbName(tableName);
    await ensureDb(db);

    const _id = docId(key);

    try {
      const res  = await cloudant.getDocument({ db, docId: _id });
      const _rev = (res.result as any)._rev;
      await cloudant.deleteDocument({ db, docId: _id, rev: _rev });
    } catch (err: any) {
      if (err.status === 404) return; // Already gone
      throw err;
    }
  }
}
