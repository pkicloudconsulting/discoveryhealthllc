// Discovery Health LLC: contact form backend (Cloudflare Worker).
// Receives the /contact/ form as JSON and, through Resend:
//   1. emails the office the full inquiry (Reply-To is the visitor), and
//   2. sends the visitor a short confirmation FROM office@ that never repeats what they told us.
// Spam protection: hidden "website" trap, 3 requests per IP per 10 minutes, 2 minute duplicate guard (KV),
// optional Cloudflare Turnstile. Secrets: RESEND_API_KEY (required), TURNSTILE_SECRET (optional).
// Build: worker/build.py inlines the logo into contact-worker.js. Edit THIS file, then rebuild.

const OFFICE = "office@discoveryhealthva.com";
const FROM = "Discovery Health LLC <office@discoveryhealthva.com>";
const PRACTICE = "Discovery Health LLC";
const PHONE = "(804) 599-5541";
const PHONE_TEL = "+18045995541";
const SITE = "https://www.discoveryhealthva.com/";
const LOGO_CID = "dh-logo";
const LOGO_PNG_BASE64 = "__LOGO__";

const ALLOWED_ORIGINS = [
  "https://www.discoveryhealthva.com",
  "https://discoveryhealthva.com",
  "https://pkicloudconsulting.github.io",
  "http://127.0.0.1:8002",
  "http://localhost:8002",
];
// Resend replies that point at setup rather than a passing glitch, so the site can fall back to mailto
const CONFIG_ERROR = /not verified|validation_error|invalid.{0,20}api key|unauthorized|restricted|Resend 40[0-3]/i;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 600;
const DUPLICATE_WINDOW_SECONDS = 120;

const TEAL = "#2f7a86";
const TEAL_DEEP = "#163f47";
const CORAL = "#ee707b";
const INK = "#1d2b2e";
const SOFT = "#4a6068";
const MIST = "#eef6f7";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
}
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function clean(v, max) { return String(v == null ? "" : v).trim().slice(0, max || 2000); }
function json(obj, status, headers) { return new Response(JSON.stringify(obj), { status, headers }); }

async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const out = await res.json().catch(() => ({ success: false }));
  return out.success === true;
}

async function sendViaResend(apiKey, payload) {
  const withLogo = payload.html && payload.html.includes(`cid:${LOGO_CID}`)
    ? { ...payload, attachments: [{ filename: "discovery-health-logo.png", content: LOGO_PNG_BASE64, content_id: LOGO_CID }] }
    : payload;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(withLogo),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

function shell(preheader, inner) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${MIST};">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${MIST};opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MIST};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #d8e4e6;border-radius:18px;overflow:hidden;font-family:${FONT};">
  <tr><td style="height:5px;font-size:0;line-height:0;background:${CORAL};">&nbsp;</td></tr>
  <tr><td style="padding:26px 36px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="vertical-align:middle;padding-right:12px;"><img src="cid:${LOGO_CID}" width="56" height="56" alt="${PRACTICE} logo" style="display:block;border:0;"></td>
    <td style="vertical-align:middle;font-size:18px;font-weight:800;letter-spacing:0.5px;color:${TEAL_DEEP};">DISCOVERY HEALTH LLC<br><span style="font-size:11px;letter-spacing:4px;color:${TEAL};font-weight:700;">HOME CARE</span></td>
  </tr></table></td></tr>
  <tr><td style="padding:0 36px;"><div style="height:1px;background:#d8e4e6;font-size:0;line-height:0;">&nbsp;</div></td></tr>
  <tr><td style="padding:26px 36px 28px;">${inner}</td></tr>
  <tr><td style="padding:18px 36px 24px;background:${TEAL_DEEP};font-size:12px;line-height:1.7;color:#d8eef0;">
    ${esc(PRACTICE)} &middot; Home health and community-based support services<br>
    <a href="tel:${PHONE_TEL}" style="color:#ffffff;text-decoration:none;">${esc(PHONE)}</a> &nbsp;&middot;&nbsp; <a href="mailto:${OFFICE}" style="color:#ffffff;text-decoration:none;">${OFFICE}</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}
const eyebrow = (t) => `<div style="font-size:12px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${CORAL};margin:0 0 10px;">${esc(t)}</div>`;
const headline = (h) => `<h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;font-weight:800;color:${TEAL_DEEP};">${h}</h1>`;
const para = (h) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:${INK};">${h}</p>`;
function rows(list) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` + list.map(([label, value, href], i) => {
    const b = i === list.length - 1 ? "" : "border-bottom:1px solid #eef1f4;";
    const v = href ? `<a href="${esc(href)}" style="color:${TEAL};text-decoration:none;">${esc(value)}</a>` : esc(value);
    return `<tr><td style="padding:10px 0;${b}font-size:13px;color:${SOFT};width:140px;vertical-align:top;">${esc(label)}</td><td style="padding:10px 0;${b}font-size:15px;color:${INK};font-weight:600;vertical-align:top;">${v}</td></tr>`;
  }).join("") + `</table>`;
}
function pill(href, label, solid) {
  return solid
    ? `<td style="border-radius:999px;background:${CORAL};"><a href="${href}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${label}</a></td>`
    : `<td style="border-radius:999px;border:1.5px solid ${TEAL};"><a href="${href}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:700;color:${TEAL};text-decoration:none;">${label}</a></td>`;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method === "GET") return new Response(`${PRACTICE} form receiver is running.`, { status: 200 });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);

    let data;
    try { data = JSON.parse(await request.text()); } catch { return json({ error: "Invalid request" }, 400, headers); }
    if (data.website) return json({ success: true }, 200, headers); // spam trap

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (env.RATE_LIMIT) {
      const key = `rl:${ip}`;
      const count = parseInt((await env.RATE_LIMIT.get(key)) || "0", 10);
      if (count >= RATE_LIMIT_MAX) return json({ error: `Too many requests. Please try again in a few minutes or call ${PHONE}.` }, 429, headers);
      await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
    }
    if (env.TURNSTILE_SECRET && !(await verifyTurnstile(env.TURNSTILE_SECRET, data.turnstileToken, ip))) {
      return json({ error: "Verification failed. Please try again." }, 403, headers);
    }

    const name = clean(data.name, 120), phone = clean(data.phone, 40), email = clean(data.email, 200);
    const who = clean(data.I_am_a, 80), service = clean(data.service, 120), msg = clean(data.message, 3000), page = clean(data.page, 200);
    const city = clean(data.city, 80), state = clean(data.state, 40);
    const where = [city, state].filter(Boolean).join(", ");
    const first = name.split(/\s+/)[0] || "there";
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!name || !phone || !msg) return json({ error: "Please add your name, a phone number and a short message." }, 400, headers);
    if (email && !emailOk) return json({ error: "Please check the email address." }, 400, headers);

    if (env.RATE_LIMIT) {
      const dupKey = `dup:${(emailOk ? email : phone).toLowerCase()}`;
      if (await env.RATE_LIMIT.get(dupKey)) return json({ success: true }, 200, headers);
      await env.RATE_LIMIT.put(dupKey, "1", { expirationTtl: DUPLICATE_WINDOW_SECONDS });
    }
    if (!env.RESEND_API_KEY) return json({ error: "Email is not configured yet.", code: "not_configured" }, 503, headers);

    const submitted = new Date().toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " ET";
    const details = [
      ["Phone", phone, `tel:${phone.replace(/[^\d+]/g, "")}`],
      ["Email", emailOk ? email : "Not provided (call back)", emailOk ? `mailto:${email}` : ""],
      ["They are a", who || "Not given"],
      ["Location", where || "Not given"],
      ["Service", service || "Not sure yet"],
      ["Submitted", submitted],
      ["Sent from", page ? `Website ${page}` : "Website contact form"],
    ];
    try {
      await sendViaResend(env.RESEND_API_KEY, {
        from: FROM, to: [OFFICE], ...(emailOk ? { reply_to: email } : {}),
        subject: `New care inquiry: ${name}${service && service !== "Not sure yet" ? ` (${service})` : ""}`,
        text: [`NEW CARE INQUIRY: ${name}`, "", ...details.map(([l, v]) => `${l}: ${v}`), "", "MESSAGE", msg, "", emailOk ? `Press reply to answer ${first} directly.` : `No email given: please call ${phone}.`].join("\n"),
        html: shell(`${name}: ${service || "care inquiry"}`,
          eyebrow("New care inquiry") + headline(esc(name)) + rows(details) +
          `<div style="margin:22px 0 8px;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${TEAL};">Their message</div>` +
          `<div style="padding:14px 16px;background:${MIST};border-left:4px solid ${CORAL};border-radius:0 10px 10px 0;font-size:15px;line-height:1.6;color:${INK};white-space:pre-wrap;">${esc(msg)}</div>` +
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;"><tr>${pill(`tel:${esc(phone.replace(/[^\d+]/g, ""))}`, `Call ${esc(first)}`, true)}${emailOk ? `<td style="width:10px;"></td>${pill(`mailto:${esc(email)}`, "Reply by email", false)}` : ""}</tr></table>`),
      });
      if (emailOk) {
        try {
        const step = (n, t) => `<tr>
          <td style="width:28px;vertical-align:top;padding:0 12px 14px 0;"><div style="width:26px;height:26px;border-radius:50%;background:${MIST};color:${TEAL_DEEP};font-size:13px;font-weight:800;text-align:center;line-height:26px;">${n}</div></td>
          <td style="vertical-align:top;padding:3px 0 14px;font-size:15px;line-height:1.55;color:${INK};">${t}</td></tr>`;
        await sendViaResend(env.RESEND_API_KEY, {
          from: FROM, to: [email], reply_to: OFFICE,
          subject: `Thank you, ${first} \u2014 we have your message`,
          text: [
            `Hi ${first},`, "",
            `Thank you for contacting ${PRACTICE}. Your message has reached our team and we will be in touch, usually within one business day.`, "",
            "WHAT HAPPENS NEXT",
            "1. A member of our care team reads your message.",
            "2. We call you to understand what you need. There is no obligation and no cost for the conversation.",
            "3. If we are the right fit, a nurse arranges an in-home assessment and we build a care plan with you.", "",
            `If you would rather talk now, call us on ${PHONE}.`, "",
            "If this is a medical emergency, please call 911.", "",
            "Kind regards,", `The ${PRACTICE} team`, SITE, "",
            "---",
            `This is an automated confirmation, so there is no need to reply to it. If you would like to add anything, call ${PHONE} or write to ${OFFICE} and a person will pick it up.`,
          ].join("\n"),
          html: shell("We have your message and will be in touch within one business day.",
            eyebrow("Message received") + headline(`Thank you, ${esc(first)}.`) +
            para(`Your message has reached our team. Someone will be in touch, usually within <strong>one business day</strong>, to talk through the options with you.`) +
            `<div style="margin:22px 0 8px;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${TEAL};">What happens next</div>` +
            `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;">` +
              step(1, "A member of our care team reads your message.") +
              step(2, "We call you to understand what you need. There is no obligation, and the conversation costs nothing.") +
              step(3, "If we are the right fit, a nurse arranges an in-home assessment and we build a care plan with you.") +
            `</table>` +
            para(`If you would rather talk now, call us on <a href="tel:${PHONE_TEL}" style="color:${TEAL};font-weight:700;text-decoration:none;">${esc(PHONE)}</a>.`) +
            `<div style="padding:12px 16px;background:${MIST};border-left:4px solid ${CORAL};border-radius:0 10px 10px 0;font-size:14px;line-height:1.6;color:${INK};margin:4px 0 20px;">If this is a medical emergency, please call <strong>911</strong>.</div>` +
            `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${pill(`tel:${PHONE_TEL}`, `Call ${esc(PHONE)}`, true)}<td style="width:10px;"></td>${pill(SITE, "Visit our website", false)}</tr></table>` +
            `<p style="margin:22px 0 0;font-size:16px;line-height:1.65;color:${INK};">Kind regards,<br><strong>The ${esc(PRACTICE)} team</strong></p>` +
            `<div style="margin:22px 0 0;padding:14px 0 0;border-top:1px solid #eef1f4;font-size:13px;line-height:1.6;color:${SOFT};">This is an automated confirmation, so there is no need to reply to it. If you would like to add anything, call <a href="tel:${PHONE_TEL}" style="color:${TEAL};text-decoration:none;">${esc(PHONE)}</a> or write to <a href="mailto:${OFFICE}" style="color:${TEAL};text-decoration:none;">${OFFICE}</a> and a person will pick it up.</div>`),
        });
        } catch (e) {
          // the office already has the enquiry; a failed courtesy copy is not the visitor's problem
          console.error("confirmation to visitor failed:", String((e && e.message) || e).slice(0, 300));
        }
      }
      return json({ success: true }, 200, headers);
    } catch (err) {
      const detail = String((err && err.message) || err);
      console.error("send failed:", detail.slice(0, 300));
      // A misconfigured mail setup (unverified sending domain, missing or revoked key) must not
      // dead-end the visitor: answer not_configured so the site falls back to their email app
      // with the message pre-filled. Only a genuine transient failure returns an error.
      if (CONFIG_ERROR.test(detail)) {
        return json({ error: "Email is not configured yet.", code: "not_configured" }, 503, headers);
      }
      return json({ error: `We could not send your message right now. Please call ${PHONE} or email ${OFFICE}.` }, 502, headers);
    }
  },
};
