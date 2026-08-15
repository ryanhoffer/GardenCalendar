// POST /api/admin/grant-access — provision or revoke a free/comped account.
//
// Body (JSON):
//   { email: string, action: 'grant' | 'revoke', reason?: string }
//
// SCAFFOLD: This updates the `profiles` row directly (app-side comp). Once
// Stripe billing is wired up, prefer applying a 100%-off Stripe coupon so all
// entitlement state stays single-sourced (see BILLING.md §6). The Stripe path
// is marked TODO below.

import { requireAdmin, audit, send } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const gate = await requireAdmin(req);
  if (!gate.ok) return send(res, gate.status, { error: gate.error });
  const { db, admin } = gate;

  const body = typeof req.body === 'object' && req.body ? req.body : safeJson(req.body);
  const email = (body.email || '').toString().trim().toLowerCase();
  const action = (body.action || 'grant').toString();
  const reason = (body.reason || '').toString().trim() || 'Comped by admin';

  if (!email) return send(res, 400, { error: 'email is required' });
  if (!['grant', 'revoke'].includes(action)) {
    return send(res, 400, { error: "action must be 'grant' or 'revoke'" });
  }

  // Find the target user's profile by email.
  const { data: profile, error: findErr } = await db
    .from('profiles')
    .select('user_id, email, plan, status, comp_reason')
    .ilike('email', email)
    .maybeSingle();

  if (findErr) return send(res, 500, { error: findErr.message });
  if (!profile) return send(res, 404, { error: 'No user found with that email' });

  // TODO(stripe): when billing is live, grant/revoke via a 100%-off coupon on
  // the customer's subscription instead of (or in addition to) these fields.

  const update = action === 'grant'
    ? { plan: 'pro', status: 'active', comp_reason: reason }
    : { plan: 'none', status: 'inactive', comp_reason: null };

  const { error: upErr } = await db
    .from('profiles')
    .update(update)
    .eq('user_id', profile.user_id);

  if (upErr) return send(res, 500, { error: upErr.message });

  await audit(db, admin.user_id, action === 'grant' ? 'grant_free' : 'revoke_free',
    profile.user_id, { email, reason });

  send(res, 200, { ok: true, email, action, profile: { ...profile, ...update } });
}

function safeJson(v) {
  try { return JSON.parse(v || '{}'); } catch (_e) { return {}; }
}
