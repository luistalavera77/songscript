export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { sessionId, userId } = req.body;
    if (!sessionId || !userId) return res.status(400).json({ error: 'Missing params' });

    // Verify with Stripe
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
      { headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` } }
    );
    const session = await stripeRes.json();
    if (session.payment_status !== 'paid') return res.status(400).json({ error: 'Not paid' });

    const lettersToAdd = session.amount_total >= 1499 ? 10 : 5;

    // Get profile
    const SUPABASE_URL = 'https://qyzjnyoxcuteanidsxav.supabase.co';
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=letters_allowed`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const getText = await getRes.text();
    console.log('GET status:', getRes.status, 'body:', getText);

    const profiles = JSON.parse(getText);
    if (!profiles || profiles.length === 0) return res.status(404).json({ error: 'Profile not found' });

    const newTotal = profiles[0].letters_allowed + lettersToAdd;

    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ letters_allowed: newTotal })
      }
    );

    console.log('PATCH status:', patchRes.status);
    return res.status(200).json({ letters_allowed: newTotal });

  } catch(err) {
    console.log('Credits error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
