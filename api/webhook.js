export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const body = await req.text();

  let event;
  try {
    // Verify webhook signature
    const crypto = await import('crypto');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const parts = sig.split(',').reduce((acc, part) => {
      const [k, v] = part.split('=');
      acc[k] = v;
      return acc;
    }, {});
    const payload = `${parts.t}.${body}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (expected !== parts.v1) return res.status(400).json({ error: 'Invalid signature' });
    event = JSON.parse(body);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id || new URL(session.success_url).searchParams.get('user_id');
    const amountPaid = session.amount_total;

    // Determine letters to add based on amount
    const lettersToAdd = amountPaid >= 1499 ? 10 : 5;

    // Update Supabase
    const sbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'GET',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const profiles = await sbRes.json();
    if (profiles && profiles[0]) {
      const current = profiles[0].letters_allowed;
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
          body: JSON.stringify({ letters_allowed: current + lettersToAdd })
        }
      );
    }
  }

  return res.status(200).json({ received: true });
}
