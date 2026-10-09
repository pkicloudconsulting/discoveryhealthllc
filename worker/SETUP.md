# Contact form setup: Cloudflare Worker + Resend

The Contact page form posts to a small Cloudflare Worker (`dh-contact`). The Worker sends two emails
through Resend, both **from office@discoveryhealthva.com**:

1. **To the office:** name, phone, email, who they are, city and state, service of interest and message. Reply-To is
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
        |-- Resend: inquiry email  --> office@discoveryhealthva.com
        '-- Resend: confirmation   --> the visitor (from office@)
```

> **Status (2026-10-09): COMPLETE and verified end to end.**
> The Worker is live at `https://dh-contact.tight-bush-2238.workers.dev` on the
> info@pkicloudconsulting.com Cloudflare account, with the `RATE_LIMIT` KV namespace bound and the
> `RESEND_API_KEY` secret set. The Resend domain `discoveryhealthva.com` is **verified** (DKIM, both
> SPF records and the `rsend` CNAME all green) and `assets/js/dh.js` points at the Worker.
>
> Proven by a real submission on 2026-10-09: the Worker returned `{"success":true}` and Resend
> delivered both emails -- *New care inquiry: ...* to the office and *Thank you, ... we have your
> message* to the visitor.
>
> **Mail-safety note for anyone editing DNS here.** Namecheap deletes auto-managed records when you
> save the first host record (`DeleteParkingRecords`) and when you leave Private Email for Custom MX.
> The apex SPF `v=spf1 include:spf.privateemail.com ~all` was silently dropped **twice** during setup
> and had to be re-added by hand; the first re-add looked saved in the UI but did not persist until the
> page was reloaded and it was entered again. After ANY change in Advanced DNS, reload the page and
> confirm these still resolve:
>
> ```
> dig +short MX  discoveryhealthva.com      # must list mx1 AND mx2.privateemail.com
> dig +short TXT discoveryhealthva.com      # must show the privateemail SPF
> ```
>
> Mail Settings is now **Custom MX** with three rows: `@ mx1.privateemail.com 10`,
> `@ mx2.privateemail.com 10`, `send feedback-smtp.us-east-1.amazonses.com 10`.
>
> The old parking records (`www -> parkingpage.namecheap.com` and the `@` URL redirect) were removed by
> Namecheap during the first save. The website itself is served from GitHub Pages at
> `pkicloudconsulting.github.io/discoveryhealthllc`; **the custom domain is not pointed at the site
> yet** -- that is separate, still-outstanding work.

## Part 1. Resend: let office@ send email (about 15 minutes plus DNS wait)

Steps 1, 2 and 5 are **done**. The outstanding work is step 3, in Namecheap.

1. ~~Resend account~~ -- done. One API key exists, named `discoveryhealth`.
2. ~~**Domains > Add domain**, `discoveryhealthva.com`, region **North Virginia (us-east-1)**~~ -- done
   2026-10-09, domain id `70ca70fd-3e63-43ef-a91e-b04509e93565`, status `not_started` until the DNS below lands.
3. **Add these four records in Namecheap** (Domain List > **Manage** next to discoveryhealthva.com >
   **Advanced DNS**). These are the exact values Resend issued for this domain:

   | Type | Host | Priority | Value |
   |---|---|---|---|
   | TXT | `resend._domainkey` | | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDnoVBSE22VoqUxOdKClgHuz7Wh/VrRt8tZZv4pNIDTNVd7cn6StH4X04kZTWSjkpW7BldUeTBTB2tpYHS+P2x4o51NBpFzjOA22BNqW1zUD0ptd/Ps/g7mQiwsaaRfhLO6DB43SE88jWCawRrnqlHjlUlEs6bgyB/qMwEsRCEfyQIDAQAB` |
   | TXT | `send` | | `v=spf1 include:amazonses.com ~all` |
   | MX | `send` | 10 | `feedback-smtp.us-east-1.amazonses.com` |
   | CNAME | `rsend` | | `send.forge.rmta.net` |

   The three TXT/CNAME rows go under **Host Records** with **Add New Record**.

   The `send` **MX** row is the one that needs care. Namecheap's **Mail Settings** is currently on
   **Private Email**, which means Namecheap manages the MX rows and will not let you add another.
   Switch it to **Custom MX**, then re-add all three by hand:

   | Host | Priority | Value |
   |---|---|---|
   | `@` | 10 | `mx1.privateemail.com` |
   | `@` | 10 | `mx2.privateemail.com` |
   | `send` | 10 | `feedback-smtp.us-east-1.amazonses.com` |

   Miss either `@` row and the office inbox stops receiving mail, so check them before saving, then
   send a test message to office@ from your phone to confirm the inbox still works.

   **Leave the existing `@` TXT `v=spf1 include:spf.privateemail.com ~all` exactly as it is** -- it is
   the mailbox SPF and is unrelated to the new `send` one. Keep Resend **Receiving OFF**; it would add
   an MX on `@` and take over the office inbox.

   Optional but recommended, once the above verifies: TXT on `_dmarc` with `v=DMARC1; p=none;`
   (the domain has no DMARC record today).
   **Or let `nc-dns` do it.** There is no browser login for Namecheap (no OAuth, unlike `wrangler`),
   so this needs API access turned on first: Namecheap > Profile > Tools > **Namecheap API Access**,
   toggle on, allowlist `67.187.26.24`, copy the key into `~/.config/namecheap/credentials`
   (template at `~/.config/namecheap/credentials.example`, mode 600). Then:

   ```
   nc-dns whoami                       # confirm the key and the IP allowlist
   nc-dns list discoveryhealthva.com   # see what is there now
   nc-dns apply discoveryhealthva.com \
     --from-resend worker/resend-domain.json \
     --keep-mx '@:mx1.privateemail.com:10' \
     --keep-mx '@:mx2.privateemail.com:10'
   ```

   It prints a diff and writes nothing until you add `--yes`. Namecheap's `setHosts` API replaces every
   host record at once, so `nc-dns` always reads the current set and merges; it also refuses outright to
   switch mail to Custom MX unless you pass the mailbox rows, because Private Email hides them from the
   API and dropping them would break the office inbox. Note Namecheap gates API access behind 20+
   domains, $50 spent, or a $50 balance.

4. Back in Resend, click **Verify DNS records**. Usually green in 5 to 30 minutes.
5. ~~**API Keys > Create API key**~~ -- done. The key is already set as the `RESEND_API_KEY` secret on
   the `dh-contact` Worker (verified reaching Resend). Nothing more to do here.

## Part 2. Deploy the Worker -- DONE (2026-10-09)

Deployed from the CLI. Node is installed under `~/.local/node` (not on the system PATH by default;
`export PATH="$HOME/.local/bin:$PATH"`), wrangler is authenticated via OAuth with credentials in
`~/Library/Preferences/.wrangler/config/default.toml`, so a redeploy is just:

```
export PATH="$HOME/.local/bin:$PATH"
cd worker && wrangler deploy
```

The browser route below is kept as a fallback (it is how the three sibling sites were first set up and
needs no install).

1. Sign in at **https://dash.cloudflare.com** (the info@pkicloudconsulting.com account, the one that
   already holds `pmhs-consultation`, `curawell-consultation` and the DIF Consult Worker).
2. **Workers & Pages** > **Create** > **Create Worker**. Name it exactly `dh-contact`, click **Deploy**.
3. Click **Edit code**. Select all in the editor and delete it, then paste the full contents of
   `worker/contact-worker.js` from this repo (the generated file, logo already inlined -- not
   `contact-worker.src.js`). Click **Deploy**.
4. Open the Worker address shown at the top of the page. You should see:
   *Discovery Health LLC form receiver is running.*

   Confirm the address is `https://dh-contact.tight-bush-2238.workers.dev`. That value is already set
   as `FORM_ENDPOINT` in `assets/js/dh.js`. If your account subdomain differs, send the real address
   over and it gets corrected.

At this point the form is live but has no Resend key, so it answers `not_configured` and the website
quietly falls back to the visitor email app. Nothing is broken while Part 1 is still pending.

## Part 3. Put the key in the Worker, and the rate limit

The KV part is **done** (step 2 below, namespace `dh-contact-RATE_LIMIT`, id
`88bcaebebcf84708a819e1347d8291ef`, recorded in `wrangler.toml`). Only the secret is outstanding.

1. The `RESEND_API_KEY` secret. Either run this yourself, pasting the key at the prompt (it is never
   echoed and never reaches the repo or chat):

   ```
   export PATH="$HOME/.local/bin:$PATH"
   cd worker && wrangler secret put RESEND_API_KEY
   ```

   or in the dashboard: **Workers & Pages** > `dh-contact` > **Settings** >
   **Variables and Secrets** > **Add**, type **Secret**, name `RESEND_API_KEY`, value the key from
   Part 1 step 5, then **Deploy**.
2. Rate limit and duplicate guard (recommended, matches the sibling sites):
   - **Storage & Databases** > **KV** > **Create a namespace**, name it `dh-contact-RATE_LIMIT`.
   - Back on the Worker: **Settings** > **Bindings** > **Add** > **KV namespace**. Variable name
     `RATE_LIMIT`, namespace `dh-contact-RATE_LIMIT`. Click **Deploy**.

   The Worker checks `env.RATE_LIMIT` before using it, so skipping this only drops the 3-per-10-minutes
   limit and the 2 minute duplicate guard. Everything else works.

CLI equivalent, if Node is ever installed: `npx wrangler secret put RESEND_API_KEY`, and the
`kv namespace create` line in `wrangler.toml`.

## Part 4. Test

1. Open the live site's Contact page, fill it in with an email you can check, press Send.
2. office@ gets **New care inquiry: <name>**, and your inbox gets **We received your message**.
3. If nothing arrives, check Resend > Emails and the Worker's Logs tab.

## Redeploying after edits

Edit `contact-worker.src.js`, then:

```
python3 worker/build.py      # needs Pillow: python3 -m pip install Pillow
```

then paste the regenerated `worker/contact-worker.js` into the dashboard editor again and **Deploy**
(or `cd worker && npx wrangler deploy` where Node is available). Never edit `contact-worker.js` by
hand -- `build.py` overwrites it.

Constants at the top of the file: office address, sender, phone, website address, allowed origins.
Add the custom domain to `ALLOWED_ORIGINS` (already listed for www and the apex) and update `SITE`
when it goes live.

## Privacy note

Inquiries pass through Cloudflare and Resend into the office mailbox. Neither signs a HIPAA Business
Associate Agreement on the free plans. The form already asks visitors not to include medical details,
and the confirmation repeats nothing. If the agency handles PHI through this channel, review that with
the owner or move to providers that sign a BAA.
