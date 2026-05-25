const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const parts = sig.split(',').reduce((acc, part) => {
      const [k, v] = part.split('='); acc[k] = v; return acc;
    }, {});
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${parts.t}.${body}`)
      .digest('hex');
    if (expected !== parts.v1) {
      console.log('Invalid signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } catch(err) {
    console.log('Signature error:', err.message);
    return res.status(400).json({ error: err.message });
  }

  const event = JSON.parse(body);
  console.log('Event type:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const amountTotal = session.amount_total;
    const lettersToAdd = amountTotal >= 1499 ? 10 : 5;

    console.log('userId:', userId);
    console.log('amountTotal:', amountTotal);
    console.log('lettersToAdd:', lettersToAdd);

    if (!userId) {
      console.log('No userId found');
      return res.status(200).json({ received: true });
    }

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: profile, error: fetchError } = await sb
      .from('profiles')
      .select('id, letters_allowed')
      .eq('id', userId)
      .single();

    console.log('Profile:', JSON.stringify(profile));
    console.log('Fetch error:', JSON.stringify(fetchError));

    if (!profile) {
      console.log('No profile found');
      return res.status(200).json({ received: true });
    }

    const newTotal = profile.letters_allowed + lettersToAdd;
    console.log('Setting letters_allowed to:', newTotal);

    const { error: updateError } = await sb
      .from('profiles')
      .update({ letters_allowed: newTotal })
      .eq('id', userId);

    console.log('Update error:', JSON.stringify(updateError));
    console.log('Done');
  }

  return res.status(200).json({ received: true });
};

module.exports.config = { api: { bodyParser: false } };
