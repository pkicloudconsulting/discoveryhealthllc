// Discovery Health LLC: contact form backend (Cloudflare Worker).
// Receives the /contact/ form as JSON and, through Resend:
//   1. emails the office the full inquiry (Reply-To is the visitor), and
//   2. sends the visitor a short confirmation FROM office@ that never repeats what they told us.
// Spam protection: hidden "website" trap, 3 requests per IP per 10 minutes, 2 minute duplicate guard (KV),
// optional Cloudflare Turnstile. Secrets: RESEND_API_KEY (required), TURNSTILE_SECRET (optional).
// Build: worker/build.py inlines the logo into contact-worker.js. Edit THIS file, then rebuild.

const OFFICE = "office@discoveryhealthllc.com";
const FROM = "Discovery Health LLC <office@discoveryhealthllc.com>";
const PRACTICE = "Discovery Health LLC";
const PHONE = "(267) 939-7727";
const PHONE_TEL = "+12679397727";
const SITE = "https://pkicloudconsulting.github.io/discoveryhealthllc/";
const LOGO_CID = "dh-logo";
const LOGO_PNG_BASE64 = "__LOGO__";

const ALLOWED_ORIGINS = [
  "https://www.discoveryhealthllc.com",
  "https://discoveryhealthllc.com",
  "https://pkicloudconsulting.github.io",
  "http://127.0.0.1:8002",
  "http://localhost:8002",
];
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
        await sendViaResend(env.RESEND_API_KEY, {
          from: FROM, to: [email], reply_to: OFFICE,
          subject: `We received your message: ${PRACTICE}`,
          text: [`Hi ${first},`, "", `Thank you for contacting ${PRACTICE}. We have received your message and a member of our team will be in touch, usually within one business day.`, "", `If you would rather talk now, call us at ${PHONE}.`, "", "If this is a medical emergency, please call 911.", "", "Kind regards,", `The ${PRACTICE} team`, SITE].join("\n"),
          html: shell("We received your message and will be in touch within one business day.",
            eyebrow("Message received") + headline(`Thank you, ${esc(first)}.`) +
            para(`We have received your message. A member of our team will be in touch, usually within <strong>one business day</strong>, to talk through the options.`) +
            para(`If you would rather talk now, call us at <a href="tel:${PHONE_TEL}" style="color:${TEAL};font-weight:700;text-decoration:none;">${esc(PHONE)}</a>.`) +
            `<div style="padding:12px 16px;background:${MIST};border-left:4px solid ${TEAL};border-radius:0 10px 10px 0;font-size:14px;line-height:1.6;color:${INK};margin:4px 0 18px;">If this is a medical emergency, please call <strong>911</strong>.</div>` +
            `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${pill(SITE, "Visit our website", true)}</tr></table>` +
            `<p style="margin:20px 0 0;font-size:16px;line-height:1.65;color:${INK};">Kind regards,<br><strong>The ${esc(PRACTICE)} team</strong></p>`),
        });
      }
      return json({ success: true }, 200, headers);
    } catch (err) {
      console.error("send failed:", String((err && err.message) || err).slice(0, 300));
      return json({ error: `We could not send your message right now. Please call ${PHONE} or email ${OFFICE}.` }, 502, headers);
    }
  },
};
