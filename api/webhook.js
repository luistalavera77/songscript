export const config = { api: { bodyParser: false } };
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const processed = new Set();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const parts = sig.split(',').reduce((acc, part) => {
    const [k, v] = part.split('='); acc[k] = v; return acc;
  }, {});
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${body}`).digest('hex');
  if (expected !== parts.v1) return res.status(400).json({ error: 'Invalid signature' });
  const event = JSON.parse(body);
  if (event.type === 'checkout.session.completed') {
    if (processed.has(event.id)) return res.status(200).json({ received: true });
    processed.add(event.id);
    const session = event.data.object;
    const userId = session.metadata?.user_id || new URL(session.success_url).searchParams.get('user_id');
    const lettersToAdd = session.amount_total >= 1499 ? 10 : 5;
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data: profile } = await sb.from('profiles').select('letters_allowed').eq('id', userId).single();
    if (profile) {
      await sb.from('profiles').update({ letters_allowed: profile.letters_allowed + lettersToAdd }).eq('id', userId);
    }
  }
  return res.status(200).json({ received: true });
}
