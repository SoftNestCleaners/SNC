/**
 * SoftNest Cleaners — quote form handler (Cloudflare Pages Function)
 *
 * Lives at:  /api/quote        (the path mirrors the folder structure)
 * Replaces:  api/quote.php     from the PHP version
 *
 * Required environment variables (Pages → Settings → Environment variables):
 *   TELEGRAM_BOT_TOKEN   from @BotFather
 *   TELEGRAM_CHAT_ID     from @userinfobot
 *
 * Optional:
 *   RESEND_API_KEY       enables the email backup copy
 *   ADMIN_EMAIL          where the backup copy goes
 *   MAIL_FROM            verified sender on your domain, e.g. quotes@yourdomain.com
 *   LEADS                a KV namespace binding; enables rate limiting + lead backup
 */

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT = 5;          // submissions per IP
const RATE_WINDOW = 3600;      // per hour

const SERVICES = {
  upholstery: 'Upholstery Cleaning',
  carpet: 'Carpet Cleaning',
  rug: 'Area Rug Cleaning',
  mattress: 'Mattress Cleaning',
  car: 'Car Interior Cleaning',
  other: 'Other',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cap = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

/* Only POST reaches this endpoint. */
export async function onRequestGet() {
  return json({ ok: false, error: 'Method not allowed' }, 405);
}

export async function onRequestPost({ request, env }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'Could not read the form' }, 400);
  }

  /* ---------- anti-spam: honeypot ---------- */
  if (cap(form.get('website'), 100)) {
    return json({ ok: true });           // pretend it worked; don't teach the bot
  }

  /* ---------- anti-spam: rate limit (needs the LEADS KV binding) ---------- */
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.LEADS) {
    const key = `rl:${ip}`;
    const count = parseInt((await env.LEADS.get(key)) || '0', 10);
    if (count >= RATE_LIMIT) {
      return json({ ok: false, error: 'Too many requests. Please call us instead.' }, 429);
    }
    await env.LEADS.put(key, String(count + 1), { expirationTtl: RATE_WINDOW });
  }

  /* ---------- validation ---------- */
  const firstName = cap(form.get('firstName'), 60);
  const lastName  = cap(form.get('lastName'), 60);
  const phone     = cap(form.get('phone'), 30);
  const email     = cap(form.get('email'), 120);
  const zip       = cap(form.get('zip'), 12);
  const service   = cap(form.get('service'), 40);
  const date      = cap(form.get('date'), 20) || 'Not specified';
  const message   = cap(form.get('message'), 2000) || 'No message';

  for (const [name, value] of Object.entries({ firstName, lastName, phone, email, zip, service })) {
    if (!value) return json({ ok: false, error: `Field '${name}' is required` }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ ok: false, error: 'Please enter a valid email address' }, 400);
  }
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    return json({ ok: false, error: 'Please enter a valid ZIP code' }, 400);
  }

  const serviceName = SERVICES[service] || service;

  /* ---------- compose ---------- */
  const text =
    `🆕 <b>NEW SOFTNEST LEAD</b>\n\n` +
    `👤 <b>Name:</b> ${esc(firstName)} ${esc(lastName)}\n` +
    `📞 <b>Phone:</b> ${esc(phone)}\n` +
    `📧 <b>Email:</b> ${esc(email)}\n` +
    `📍 <b>ZIP:</b> ${esc(zip)}\n\n` +
    `🛠 <b>Service:</b> ${esc(serviceName)}\n` +
    `📅 <b>Preferred date:</b> ${esc(date)}\n\n` +
    `📝 <b>Message:</b>\n${esc(message)}`;

  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  /* ---------- Telegram ---------- */
  let telegramOk = false;
  if (token && chatId) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
      telegramOk = res.ok;
    } catch {
      telegramOk = false;
    }

    /* photos, capped */
    if (telegramOk) {
      const photos = form.getAll('photos[]').filter((f) => f && typeof f === 'object' && f.size > 0);
      let sent = 0;
      for (const file of photos) {
        if (sent >= MAX_PHOTOS) break;
        if (file.size > MAX_PHOTO_BYTES) continue;
        if (!/^image\//.test(file.type || '')) continue;
        try {
          const fd = new FormData();
          fd.append('chat_id', chatId);
          if (sent === 0) fd.append('caption', `📎 Photos from ${firstName} ${lastName}`);
          fd.append('photo', file, file.name || `photo${sent}.jpg`);
          await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: fd });
          sent++;
        } catch {
          /* a failed photo must not fail the whole lead */
        }
      }
    }
  }

  /* ---------- email backup (optional, via Resend) ---------- */
  let mailOk = false;
  if (env.RESEND_API_KEY && env.ADMIN_EMAIL && env.MAIL_FROM) {
    try {
      const plain = text.replace(/<\/?b>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [env.ADMIN_EMAIL],
          reply_to: email,
          subject: `New quote request — ${firstName} ${lastName}`,
          text: plain,
        }),
      });
      mailOk = res.ok;
    } catch {
      mailOk = false;
    }
  }

  /* ---------- respond honestly ---------- */
  if (telegramOk || mailOk) {
    return json({ ok: true, message: 'Quote request received' });
  }

  /* Nothing got through — keep the lead if KV is available. */
  if (env.LEADS) {
    try {
      await env.LEADS.put(
        `lead:${Date.now()}:${ip}`,
        JSON.stringify({ receivedAt: new Date().toISOString(), firstName, lastName, phone, email, zip, serviceName, date, message })
      );
    } catch {
      /* nothing further we can do */
    }
  }
  return json({ ok: false, error: 'Delivery failed' }, 500);
}
