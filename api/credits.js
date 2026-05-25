export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { sessionId, userId } = req.body;

  // Verify payment with Stripe
  const stripeRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
      }
    }
  );
  const session = await stripeRes.json();

  if (session.payment_status !== 'paid') {
    return res.status(400).json({ error: 'Payment not completed' });
  }

  const lettersToAdd = session.amount_total >= 1499 ? 10 : 5;

  // Update Supabase directly
  const getRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=letters_allowed`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const profiles = await getRes.json();
  if (!profiles || profiles.length === 0) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const newTotal = profiles[0].letters_allowed + lettersToAdd;

  await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ letters_allowed: newTotal })
    }
  );

  return res.status(200).json({ letters_allowed: newTotal });
}
