// POST /api/stripe-webhook
//
// Receives Stripe events and syncs subscription state into `profiles` via the
// service-role client. Signature is verified with STRIPE_WEBHOOK_SECRET using
// the RAW request body (bodyParser disabled below — required by Stripe).
//
// Handled events:
//   checkout.session.completed        → link customer, sync subscription
//   customer.subscription.created      → sync status/price/period
//   customer.subscription.updated      → sync status/price/period/cancel flag
//   customer.subscription.deleted      → canceled / plan=none
//   invoice.payment_failed             → past_due
//   invoice.payment_succeeded          → active (period bumped via sub sync)
//
// Always returns 200 quickly and works idempotently.

import {
  stripeClient, subscriptionToPatch, updateProfileByCustomer,
} from '../_lib/billing.js';
import { serviceClient } from '../_lib/admin.js';

// Vercel: give us the raw body so we can verify the Stripe signature.
export const config = { api: { bodyParser: false } };

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const stripe = stripeClient();
  if (!stripe || !WEBHOOK_SECRET) { res.status(500).end('Billing not configured'); return; }

  let event;
  try {
    const buf = await rawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(buf, sig, WEBHOOK_SECRET);
  } catch (e) {
    res.status(400).end(`Webhook signature verification failed: ${e.message}`);
    return;
  }

  const db = serviceClient();
  if (!db) { res.status(500).end('DB not configured'); return; }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.subscription && s.customer) {
          const sub = await stripe.subscriptions.retrieve(s.subscription);
          await updateProfileByCustomer(db, s.customer, subscriptionToPatch(sub));
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await updateProfileByCustomer(db, sub.customer, subscriptionToPatch(sub));
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await updateProfileByCustomer(db, sub.customer, {
          status: 'canceled',
          plan: 'none',
          cancel_at_period_end: false,
        });
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object;
        if (inv.customer) {
          await updateProfileByCustomer(db, inv.customer, { status: 'past_due' });
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const inv = event.data.object;
        if (inv.subscription) {
          const sub = await stripe.subscriptions.retrieve(inv.subscription);
          await updateProfileByCustomer(db, sub.customer, subscriptionToPatch(sub));
        }
        break;
      }
      default:
        // Unhandled event types are acknowledged and ignored.
        break;
    }
  } catch (e) {
    // Log but still 200 so Stripe doesn't hammer retries for app-side issues.
    console.error('stripe-webhook handler error:', e.message);
  }

  res.status(200).json({ received: true });
}
