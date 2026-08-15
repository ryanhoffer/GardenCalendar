// POST /api/create-checkout-session
//
// Starts a Stripe Checkout flow for a Pro subscription (14-day free trial).
// Body: { plan: 'monthly' | 'yearly' }
// Auth: Supabase Bearer JWT.
// Returns: { url } — the client redirects the browser there.

import {
  stripeClient, priceIds, appUrl, requireUser, getProfile, updateProfile,
} from '../_lib/billing.js';
import { send } from '../_lib/admin.js';

const TRIAL_DAYS = Number(process.env.STRIPE_TRIAL_DAYS || 14);

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const stripe = stripeClient();
  if (!stripe) return send(res, 500, { error: 'Billing not configured' });

  const auth = await requireUser(req);
  if (!auth.ok) return send(res, auth.status, { error: auth.error });
  const { user, db } = auth;

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const plan = body.plan === 'yearly' ? 'yearly' : 'monthly';
  const prices = priceIds();
  const price = prices[plan];
  if (!price) return send(res, 500, { error: `Price not configured for ${plan}` });

  try {
    // Find or create the Stripe customer, storing the id on the profile.
    const profile = await getProfile(db, user.id);
    let customerId = profile && profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await updateProfile(db, user.id, { stripe_customer_id: customerId });
    }

    const base = appUrl(req);
    const wsSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { trial_period_days: TRIAL_DAYS },
      allow_promotion_codes: true,
      client_reference_id: user.id,
      success_url: `${base}/app?checkout=success`,
      cancel_url: `${base}/app?checkout=cancel`,
    });

    return send(res, 200, { url: wsSession.url });
  } catch (e) {
    return send(res, 500, { error: e.message || 'Stripe error' });
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
