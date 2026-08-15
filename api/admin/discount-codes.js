// /api/admin/discount-codes — list & create discount codes.
//
//   GET  — list all codes (newest first).
//   POST — create a code. Body:
//     { code, type: 'percent'|'amount'|'free_period', value, duration,
//       maxRedemptions?, expiresAt? }
//
// SCAFFOLD: Codes are stored in Supabase. When Stripe billing is live, also
// mirror each code into Stripe as a Coupon/Promotion Code so Checkout can apply
// it natively, and store the id in `stripe_coupon_id` (see BILLING.md, TODO).

import { requireAdmin, audit, send } from '../_lib/admin.js';

export default async function handler(req, res) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return send(res, gate.status, { error: gate.error });
  const { db, admin } = gate;

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, { codes: data || [] });
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body ? req.body : safeJson(req.body);
    const code = (body.code || '').toString().trim().toUpperCase();
    const type = (body.type || 'percent').toString();
    const value = Number(body.value);
    const duration = (body.duration || 'once').toString();
    const maxRedemptions = body.maxRedemptions != null ? parseInt(body.maxRedemptions, 10) : null;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;

    if (!code) return send(res, 400, { error: 'code is required' });
    if (!['percent', 'amount', 'free_period'].includes(type)) {
      return send(res, 400, { error: 'invalid type' });
    }
    if (!Number.isFinite(value) || value < 0) {
      return send(res, 400, { error: 'value must be a non-negative number' });
    }

    // TODO(stripe): create a matching Stripe coupon/promotion code here and
    // capture its id to store in stripe_coupon_id.

    const { data, error } = await db
      .from('discount_codes')
      .insert({
        code, type, value, duration,
        max_redemptions: maxRedemptions,
        expires_at: expiresAt,
        active: true,
        created_by: admin.user_id,
      })
      .select()
      .single();

    if (error) {
      // Unique violation → friendly message.
      if (error.code === '23505') return send(res, 409, { error: 'That code already exists' });
      return send(res, 500, { error: error.message });
    }

    await audit(db, admin.user_id, 'create_code', null, { code, type, value });
    return send(res, 201, { code: data });
  }

  send(res, 405, { error: 'Method not allowed' });
}

function safeJson(v) {
  try { return JSON.parse(v || '{}'); } catch (_e) { return {}; }
}
