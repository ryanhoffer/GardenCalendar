// GET /api/admin/metrics — high-level numbers for the admin dashboard.
//
// SCAFFOLD: Counts come from `profiles`. Revenue/MRR is a placeholder until
// Stripe billing is wired up (pull from Stripe or compute from active subs).

import { requireAdmin, send } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const gate = await requireAdmin(req);
  if (!gate.ok) return send(res, gate.status, { error: gate.error });
  const { db } = gate;

  // Helper to count rows matching a filter.
  const countWhere = async (col, val) => {
    let q = db.from('profiles').select('user_id', { count: 'exact', head: true });
    if (col) q = q.eq(col, val);
    const { count, error } = await q;
    return error ? 0 : (count || 0);
  };

  const [total, active, trialing, pastDue, canceled, comped] = await Promise.all([
    countWhere(null, null),
    countWhere('status', 'active'),
    countWhere('status', 'trialing'),
    countWhere('status', 'past_due'),
    countWhere('status', 'canceled'),
    // comped = has a comp_reason; approximate via not-null filter.
    (async () => {
      const { count, error } = await db
        .from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .not('comp_reason', 'is', null);
      return error ? 0 : (count || 0);
    })(),
  ]);

  send(res, 200, {
    users: { total, active, trialing, pastDue, canceled, comped },
    // TODO(stripe): real revenue metrics once billing is live.
    revenue: { mrr: null, currency: 'usd', note: 'Placeholder — wire up Stripe.' },
  });
}
