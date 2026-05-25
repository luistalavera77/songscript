export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { type, name, email, song, artist, tone } = req.body;

  let subject, html;

  if (type === 'signup') {
    subject = `New SongScript Sign Up — ${name}`;
    html = `
      <h2>New user signed up</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}</p>
    `;
  } else if (type === 'letter') {
    subject = `New Letter Generated — "${song}" by ${artist}`;
    html = `
      <h2>A new letter was created</h2>
      <p><strong>User:</strong> ${name} (${email})</p>
      <p><strong>Song:</strong> "${song}" by ${artist}</p>
      <p><strong>Tone:</strong> ${tone}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}</p>
    `;
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: 'alberto.talavera@gmail.com',
      subject,
      html
    })
  });

  const data = await resendRes.json();
  return res.status(200).json(data);
}
