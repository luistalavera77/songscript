export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const parts = sig.split(',').reduce((acc, part) => {
      const [k, v] = part.split('=');
      acc[k] = v;
      return acc;
    }, {});
    const { createHmac } = await import('crypto');
    const expected = createHmac('sha256', secret)
      .update(`${parts.t}.${body}`)
      .digest('hex');
    if (expected !== parts.v1) return res.status(400).json({ error: 'Invalid signature' });
  } catch(err) {
    return res.status(400).json({ error: err.message });
  }

  const event = JSON.parse(body);
  console.log('Event:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const lettersToAdd = session.amount_total >= 1499 ? 10 : 5;

    console.log('userId:', userId, 'lettersToAdd:', lettersToAdd);
    if (!userId) return res.status(200).json({ received: true });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    console.log('SUPABASE_URL:', SUPABASE_URL);
    console.log('SERVICE_KEY exists:', !!SERVICE_KEY);
    console.log('SERVICE_KEY length:', SERVICE_KEY?.length);

    // Get current profile
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,letters_allowed`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('GET status:', getRes.status);
    const profiles = await getRes.json();
    console.log('Profiles:', JSON.stringify(profiles));

    if (!profiles || profiles.length === 0) {
      console.log('No profile found');
      return res.status(200).json({ received: true });
    }

    const newTotal = profiles[0].letters_allowed + lettersToAdd;
    console.log('New total:', newTotal);

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
    console.log('Done');
  }

  return res.status(200).json({ received: true });
}
