# Contact form setup: Cloudflare Worker + Resend

The Contact page form posts to a small Cloudflare Worker (`dh-contact`). The Worker sends two emails
through Resend, both **from office@discoveryhealthllc.com**:

1. **To the office:** name, phone, email, who they are, service of interest and message. Reply-To is
   the visitor, so pressing Reply answers them directly.
2. **To the visitor** (only if they gave an email): a short branded confirmation with the phone number
   and a "call 911 in an emergency" line. It never repeats what they wrote.

Spam protection: hidden spam-trap field, at most 3 requests per visitor every 10 minutes, a 2 minute
duplicate guard, and optional Cloudflare Turnstile.

Until the Resend key is in place the Worker answers "not configured", and the website quietly falls
back to opening the visitor's email app addressed to office@. Nothing breaks while setup is pending.

```
Visitor fills in /contact/
        |  (JSON from the browser)
        v
Cloudflare Worker  dh-contact.<subdomain>.workers.dev
        |-- spam trap, rate limit, duplicate guard
        |-- Resend: inquiry email  --> office@discoveryhealthllc.com
        '-- Resend: confirmation   --> the visitor (from office@)
```

## Part 1. Resend: let office@ send email (about 15 minutes plus DNS wait)

1. Sign in at https://resend.com (the free plan covers 3 domains and 3,000 emails a month).
2. **Domains > Add domain**, enter `discoveryhealthllc.com`, region **North Virginia (us-east-1)**.
3. Add the records Resend lists at the domain's DNS host (copy the exact values from the Resend screen):

   | Type | Host | Value |
   |---|---|---|
   | TXT | `resend._domainkey` | the long `p=...` key |
   | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` (priority 10) |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` |
   | TXT (recommended) | `_dmarc` | `v=DMARC1; p=none;` |

   Leave the domain's existing mailbox MX records on `@` untouched. Keep Resend **Receiving OFF**, it
   would add an MX on `@` and take over the office inbox.
4. Click **Verify DNS records** and wait for green.
5. **API Keys > Create API key**, name `dh-website`, permission **Sending access**, domain
   `discoveryhealthllc.com`. Copy it once; it only goes into Cloudflare.

## Part 2. Put the key in the Worker

```
cd worker
npx wrangler secret put RESEND_API_KEY
```

or in the dashboard: Workers & Pages > `dh-contact` > Settings > Variables and Secrets > Add >
Secret `RESEND_API_KEY`.

## Part 3. Test

1. Open the live site's Contact page, fill it in with an email you can check, press Send.
2. office@ gets **New care inquiry: <name>**, and your inbox gets **We received your message**.
3. If nothing arrives, check Resend > Emails and the Worker's Logs tab.

## Redeploying after edits

Edit `contact-worker.src.js`, then:

```
python3 worker/build.py
cd worker && npx wrangler deploy
```

Constants at the top of the file: office address, sender, phone, website address, allowed origins.
Add the custom domain to `ALLOWED_ORIGINS` (already listed for www and the apex) and update `SITE`
when it goes live.

## Privacy note

Inquiries pass through Cloudflare and Resend into the office mailbox. Neither signs a HIPAA Business
Associate Agreement on the free plans. The form already asks visitors not to include medical details,
and the confirmation repeats nothing. If the agency handles PHI through this channel, review that with
the owner or move to providers that sign a BAA.
