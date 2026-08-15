// Returns the PUBLIC Supabase config for the browser.
// Only the URL + anon key — both safe to expose because Row Level Security is
// enabled on the database (see supabase/migrations/0001_init.sql).
// The service-role key must NEVER be served here.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  // Publishable Stripe values are safe to expose to the browser.
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
  const priceMonthly = process.env.STRIPE_PRICE_MONTHLY || '';
  const priceYearly = process.env.STRIPE_PRICE_YEARLY || '';

  // Signal misconfiguration clearly instead of silently shipping empties.
  res.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    stripePublishableKey,
    prices: { monthly: priceMonthly, yearly: priceYearly },
    billingConfigured: Boolean(stripePublishableKey && priceMonthly && priceYearly),
  });
}
