// Shared helpers for admin API endpoints.
//
// Every admin endpoint must:
//   1. Read the caller's Supabase access token (Bearer JWT).
//   2. Resolve the user, then verify they have role = 'admin' in `profiles`.
//   3. Use the SERVICE-ROLE client for privileged reads/writes.
//
// The service-role key bypasses RLS, so it must ONLY ever be used server-side
// (never shipped to the browser). See ADMIN_PANEL.md §1.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// A service-role client (full DB access, bypasses RLS). Server-only.
export function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Pull the Bearer token from the Authorization header.
export function bearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

// Verify the request is from an authenticated admin.
// Returns { ok: true, admin, db } or { ok: false, status, error }.
export async function requireAdmin(req) {
  const db = serviceClient();
  if (!db) return { ok: false, status: 500, error: 'Server not configured' };

  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: 'Missing bearer token' };

  // Resolve the user from their JWT using the service client.
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData || !userData.user) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }
  const uid = userData.user.id;

  // Confirm they're an admin.
  const { data: profile, error: pErr } = await db
    .from('profiles')
    .select('user_id, email, role')
    .eq('user_id', uid)
    .maybeSingle();

  if (pErr) return { ok: false, status: 500, error: 'Profile lookup failed' };
  if (!profile || profile.role !== 'admin') {
    return { ok: false, status: 403, error: 'Admin access required' };
  }

  return { ok: true, admin: profile, db };
}

// Write an entry to the admin audit log. Fire-and-forget (never throws).
export async function audit(db, adminId, action, targetUserId, detail) {
  try {
    await db.from('admin_audit_log').insert({
      admin_user_id: adminId,
      action,
      target_user_id: targetUserId || null,
      detail: detail || null,
    });
  } catch (_e) { /* logging must never break the request */ }
}

// Standard JSON responder.
export function send(res, status, body) {
  res.status(status).json(body);
}
