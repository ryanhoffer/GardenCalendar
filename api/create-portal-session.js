// POST /api/create-portal-session
//
// Opens the Stripe Customer Portal so the user can update their card, switch
// plans, or cancel. Auth: Supabase Bearer JWT.
// Returns: { url }.

import {
  stripeClient, appUrl, requireUser, getProfile,
} from '../_lib/billing.js';
import { send } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const stripe = stripeClient();
  if (!stripe) return send(res, 500, { error: 'Billing not configured' });

  const auth = await requireUser(req);
  if (!auth.ok) return send(res, auth.status, { error: auth.error });
  const { user, db } = auth;

  try {
    const profile = await getProfile(db, user.id);
    const customerId = profile && profile.stripe_customer_id;
    if (!customerId) return send(res, 400, { error: 'No billing account yet' });

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl(req)}/`,
    });
    return send(res, 200, { url: portal.url });
  } catch (e) {
    return send(res, 500, { error: e.message || 'Stripe error' });
  }
}
