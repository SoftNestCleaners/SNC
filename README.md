# SoftNest Cleaners — Cloudflare Pages edition

Static page plus a Pages Function that delivers leads to Telegram.
Hosting is free; you pay only for the domain.

``` 
index.html                the page
style.css                 all style
script.js                 form submit, phone formatting, file limits
images/                   replace these placeholders with real photos
functions/api/quote.js    the form handler — becomes /api/quote automatically
php-backend/              the PHP version, if you ever move to normal hosting
```

The folder name `functions/` is not decoration — Cloudflare turns
`functions/api/quote.js` into the live URL `/api/quote`. Don't rename it.

---

## Step 1 — Telegram bot

1. Message **@BotFather** → `/newbot` → copy the token.
2. Message **@userinfobot** → copy your numeric Id. That is your chat id.
   For a group: add the bot to the group, then use **@getidsbot**;
   group ids start with a minus sign.
3. **Send `/start` to your own bot.** Telegram refuses to message a user
   who has never started the bot. This is the single most common reason
   a correctly configured form appears to do nothing.

## Step 2 — Buy the domain

Cloudflare Registrar sells at cost, no markup and no first-year bait pricing.
Dashboard → Domain Registration → Register Domain. A `.com` runs about $10–12/year.

You can also use any other registrar and point the nameservers at Cloudflare.

## Step 3 — Deploy the site

Dashboard → **Workers & Pages** → Create → **Pages** → Upload assets.

Drag in the contents of this folder (not the folder itself — the files must
sit at the root, so `index.html` is at the top level). You'll get a live
`something.pages.dev` URL straight away.

For updates later, either drag a new upload or connect a GitHub repo so
every push deploys itself.

## Step 4 — Add the secrets

Your project → **Settings** → **Environment variables** → Production:

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | the token from BotFather |
| `TELEGRAM_CHAT_ID` | your numeric chat id |

Click **Encrypt** on the token. Then **redeploy** — variables are only picked
up by a new deployment, not applied to the existing one.

## Step 5 — Connect the domain

Project → **Custom domains** → Set up a domain → enter your domain.
If the domain is on Cloudflare, DNS is configured automatically and HTTPS
is issued within a few minutes.

## Step 6 — Test before you advertise

Submit the form yourself. Green message on the page and a Telegram
notification within seconds means it works.

A red error means the lead did **not** arrive. Check, in this order:

1. Did you redeploy after adding the variables?
2. Did you send `/start` to your bot?
3. Token and chat id have no stray spaces?

---

## Optional extras (both free, both skippable)

**Rate limiting and lead backup.** Create a KV namespace
(Workers & Pages → KV → Create), then bind it to this project under
Settings → Bindings with the variable name `LEADS`. With it, the Function
limits each IP to 5 submissions per hour and stores any lead that fails to
deliver. Without it, everything still works — you just have neither.

**Email copy.** Cloudflare cannot send email directly. Sign up at
resend.com (free tier is generous), verify your domain, then add
`RESEND_API_KEY`, `ADMIN_EMAIL` and `MAIL_FROM` as environment variables.
Without these, Telegram is your only channel — which is fine, but it does
mean one channel with no backup.

---

## Before you go live

- Phone `(630) 555-0199` — appears in `index.html` and in the JSON-LD block
- Email `hello@softnestcleaners.com`
- Domain `softnestcleaners.com` — canonical link, og: tags, JSON-LD
- **All prices** in the "See prices" panels are invented samples
- All photos in `images/`

Photos: 1600×1000 (hero), 800×600 (services), 600×600 (before/after).
Keep those ratios to avoid layout shift. The before/after tiles need real
pairs from the same job, shot from the same spot — they sell better than
anything else on the page.

## What it costs

| | |
|---|---|
| Domain | ~$10–12/year |
| Pages hosting | free |
| Pages Functions | free up to 100,000 requests/day |
| KV (optional) | free tier is far beyond what this needs |
| Resend (optional) | free tier, 3,000 emails/month |
