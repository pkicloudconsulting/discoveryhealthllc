# Discovery Health LLC website

Static marketing site for Discovery Health LLC (home health and community-based support services).
Plain HTML, CSS and JavaScript. No build step, no framework. Deploys as-is to GitHub Pages
(branch mode: Settings > Pages > Deploy from a branch > main, root) or any static host.

## Structure

```
index.html                 Home (rotating photo/clip hero, services, steps, thrive, FAQ, resources)
services/                  All six service groups with anchors (#skilled-nursing, #home-care, #transitional-care,
                           #consumer-directed, #care-coordination, #quality-safety)
about/                     Mission, values, how we work
faq/                       Full FAQ accordion (the home page shows the first six)
contact/                   Contact details and inquiry form
resources/                 Four articles (no dates shown by design) plus the index
privacy-policy/            Website privacy policy
404.html, robots.txt, sitemap.xml, .nojekyll
assets/css/dh.css          All styles. Bump ?ver=dh-N in every HTML file after editing it.
assets/js/dh.js            Nav, hero carousel, scroll reveal, FAQ accordion, contact form
assets/img/                Photos (client supplied), logo, favicons, og-share.jpeg
assets/video/              Two 5-second muted hero clips (video only, 720p)
docs/reference/            Flyer and reference screenshots used for the design
```

All links are relative, so the site works at a domain root and at a project path.

## Brand

Colours come from the client's services flyer: teal #2f7a86 (primary), coral #ee707b (calls to action),
purple #664c8c, lavender, pale teal tints. Type is Figtree (Google Fonts) with Caveat for the two
script slogans. Image holders use the Care Advantage shape (border-radius 80px 80px 0 80px).

## Contact details used sitewide

- Phone (804) 599-5541
- info@discoveryhealthva.com and office@discoveryhealthva.com

Change them in every HTML file (search and replace) and in `assets/js/dh.js`.

## Virginia presence

The site states its Virginia service area in several places. Keep them in step if the wording changes:

- Home hero badge `.hero-locale` ("Serving families across Virginia") and the ribbon under it
- Footer contact list: a map-pin row on every page, plus the `.footer-services` line
- Contact page: the "Service area" entry in the contact card
- Contact form: `City or county` and a `State` select that defaults to Virginia
- `<meta name="geo.region" content="US-VA">` and `geo.placename` in every page head
- Titles and meta descriptions on home, about, services, FAQ and contact
- JSON-LD on the home page: `address.addressRegion` VA and `areaServed` Virginia
- The chatbot's "What areas do you serve?" answer

The JSON-LD carries no street address or locality, only the state. Add `addressLocality` and
`streetAddress` once the business address is confirmed; local search results improve sharply with them.

## Contact form

`assets/js/dh.js` has `FORM_ENDPOINT = ""`. While empty, submitting the form opens the visitor's
email app with the message prefilled (mailto to office@). Point it at a backend (for example a
Cloudflare Worker that relays to email) to send silently; the form posts URL-encoded fields with
`mode: no-cors`, honeypot field `website`.

Fields: `name`, `phone`, `email`, `I_am_a`, `city`, `state` (defaults to Virginia), `service`,
`message`. The Worker reads `city` and `state` into one "Location" row in the office email, so adding
a field to the form means adding it to `worker/contact-worker.src.js` too, then rebuilding.

## Chatbot

`assets/chatbot/dh-chatbot.js` is a rule-based assistant (no backend): topics and FAQ answers live at the
top of the file, matched by keywords. An emergency regex answers "call 911" before anything else. State is
kept in sessionStorage. Edit the FAQ list to change answers; bump `?ver=` on both chatbot files afterwards.

## Reviews and QR widget (home page)

The "What people are saying" quotes are placeholders written for layout. Replace them with real,
permissioned client reviews before launch. The QR card (bottom left, desktop only) encodes
`assets/img/site-qr.png`, currently the GitHub Pages URL. Regenerate it when the custom domain goes live:

```
python3 -c "import qrcode; qrcode.make('https://www.discoveryhealthva.com/').save('assets/img/site-qr.png')"
```

## Editing

- Each page carries its own header and footer. Edit them in every file when the nav changes.
- Hero slides live in `index.html` under `<section class="hero">`. A slide with `data-video`
  plays its clip after a short hold and advances when the clip ends; photo slides stay 5 seconds.
  `data-word` is the word that rotates in the headline.
- Articles: copy an existing `resources/<slug>/index.html`, add a card to `resources/index.html`
  and the home page, and add the URL to `sitemap.xml`.
- Domain: `sitemap.xml`, `robots.txt` and the canonical/og tags assume https://www.discoveryhealthva.com.
  Search and replace if the final domain differs.

## Preview locally

```
python3 -m http.server 8002
open http://localhost:8002/
```
