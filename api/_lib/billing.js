// Shared helpers for Stripe billing endpoints.
//
// - stripeClient(): a configured Stripe SDK instance (server-only secret key).
// - requireUser(req): verify the caller's Supabase JWT and return their user.
// - getProfile / upsertProfileByCustomer: read/write the `profiles` row via the
//   service-role client (bypasses RLS; server-only).
// - hasAccess(profile): the single source of truth for "is this user entitled?".
//
// Secrets (STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY) must NEVER reach the
// browser. See BILLING.md.

import Stripe from 'stripe';
import { serviceClient, bearerToken } from './admin.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

// A configured Stripe client, or null if the key isn't set.
export function stripeClient() {
  if (!STRIPE_SECRET_KEY) return null;
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
}

// Public price IDs (safe to expose to the browser via /api/config).
export function priceIds() {
  return {
    monthly: process.env.STRIPE_PRICE_MONTHLY || '',
    yearly: process.env.STRIPE_PRICE_YEARLY || '',
  };
}

// Base URL for Stripe redirect (success/cancel/return) URLs.
export function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  return host ? `${proto}://${host}` : '';
}

// Verify the request is from an authenticated user.
// Returns { ok: true, user, db } or { ok: false, status, error }.
export async function requireUser(req) {
  const db = serviceClient();
  if (!db) return { ok: false, status: 500, error: 'Server not configured' };

  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: 'Missing bearer token' };

  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }
  return { ok: true, user: data.user, db };
}

// Read a profile row by user id.
export async function getProfile(db, userId) {
  const { data } = await db
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data || null;
}

// Update a profile keyed by user id (billing fields).
export async function updateProfile(db, userId, patch) {
  return db.from('profiles').update(patch).eq('user_id', userId);
}

// Update a profile keyed by Stripe customer id (used by the webhook).
export async function updateProfileByCustomer(db, customerId, patch) {
  return db
    .from('profiles')
    .update(patch)
    .eq('stripe_customer_id', customerId);
}

// The single entitlement rule. Comped accounts always have access; otherwise
// an active/trialing subscription that hasn't lapsed grants access.
export function hasAccess(profile) {
  if (!profile) return false;
  if (profile.comp_reason) return true;
  const active = profile.status === 'active' || profile.status === 'trialing';
  if (!active) return false;
  if (!profile.current_period_end) return true;
  return new Date(profile.current_period_end).getTime() > Date.now();
}

// Map a Stripe subscription object onto our profile columns.
export function subscriptionToPatch(sub) {
  const item = sub.items && sub.items.data && sub.items.data[0];
  return {
    stripe_subscription_id: sub.id,
    price_id: item ? item.price.id : null,
    status: sub.status, // trialing | active | past_due | canceled | ...
    plan: (sub.status === 'active' || sub.status === 'trialing') ? 'pro' : 'none',
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
  };
}
