// GET /api/admin/users — list users for the admin panel.
//
// Query params:
//   q      — search by email (optional)
//   status — filter by subscription status (optional)
//   plan   — filter by plan (optional)
//   limit  — page size (default 50, max 200)
//   offset — pagination offset (default 0)
//   sort   — column to sort by (allowlisted; default created_at)
//   dir    — 'asc' | 'desc' (default desc)
//
// Requires an admin bearer token. Reads via the service-role client.

import { requireAdmin, send } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const gate = await requireAdmin(req);
  if (!gate.ok) return send(res, gate.status, { error: gate.error });
  const { db } = gate;

  const q = (req.query.q || '').toString().trim();
  const status = (req.query.status || '').toString().trim();
  const plan = (req.query.plan || '').toString().trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;

  // Sorting — allowlist the sortable columns to avoid injection.
  const SORTABLE = new Set([
    'email', 'plan', 'status', 'current_period_end', 'comp_reason', 'created_at',
  ]);
  const sort = SORTABLE.has((req.query.sort || '').toString()) ? req.query.sort.toString() : 'created_at';
  const ascending = (req.query.dir || '').toString() === 'asc';

  let query = db
    .from('profiles')
    .select(
      'user_id, email, role, plan, status, stripe_customer_id, current_period_end, cancel_at_period_end, comp_reason, created_at',
      { count: 'exact' }
    )
    .order(sort, { ascending, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (q) query = query.ilike('email', `%${q}%`);
  if (status) query = query.eq('status', status);
  if (plan) query = query.eq('plan', plan);

  const { data, error, count } = await query;
  if (error) return send(res, 500, { error: error.message });

  send(res, 200, { users: data || [], total: count || 0, limit, offset });
}
