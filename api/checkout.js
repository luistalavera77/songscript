export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { priceId, userId, userEmail } = req.body;

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
  'payment_method_types[]': 'card',
  'line_items[0][price]': priceId,
  'line_items[0][quantity]': '1',
  'mode': 'payment',
  'success_url': `${process.env.NEXT_PUBLIC_SITE_URL}?payment=success`,
  'cancel_url': `${process.env.NEXT_PUBLIC_SITE_URL}`,
  'customer_email': userEmail,
  'metadata[user_id]': userId
})
  });

  const session = await stripeRes.json();
  if (session.error) return res.status(400).json({ error: session.error.message });
  return res.status(200).json({ url: session.url });
}
