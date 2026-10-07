/* Discovery Health assistant - topic-aware FAQ chatbot with an emergency safety layer.
   Runs entirely in the browser (no backend). Answers come from the FAQ list below; anything it cannot
   answer is pointed to the phone number and contact page. Markup is injected by this script, so a page
   only needs the stylesheet and this file. */
(function () {
  "use strict";
  var PHONE = "(267) 939-7727", TEL = "tel:+12679397727";
  var BASE = (function () { var s = document.currentScript && document.currentScript.src || ""; var i = s.indexOf("assets/chatbot/"); return i > -1 ? s.slice(0, i).replace(location.origin, "") : ""; })();
  /* BASE holds the site-relative prefix ("" at root, "../" one level down) so links work from any page */
  if (BASE.indexOf("http") === 0) BASE = BASE.replace(/^https?:\/\/[^/]+/, "");

  var TOPICS = {
    services: { label: "Our services", intro: "Here is what we do. Pick a question or type your own:" },
    waiver: { label: "CCC Plus Waiver", intro: "Consumer-directed services and service facilitation:" },
    cost: { label: "Cost and coverage", intro: "What families ask about paying for care:" },
    start: { label: "Getting started", intro: "How care begins and what to expect:" },
    contact: { label: "Contact and safety", intro: "How to reach us, and what to do in an emergency:" }
  };

  var FAQS = [
    { id: "overview", topic: "services", chip: "What services do you offer?", q: "What services do you offer?",
      a: "Discovery Health LLC provides six kinds of support at home:\n\n• Skilled nursing services\n• Non-skilled home care (help with daily living)\n• Service Facilitation for Consumer-Directed Services under the CCC Plus Waiver\n• Care coordination and health education\n• Quality, safety and care management support\n• Transitional care and fall prevention\n\nYou can read the full lists on our [services page](services/).",
      kw: ["services", "offer", "provide", "do you do", "help with", "types of care"] },
    { id: "skilled", topic: "services", chip: "What is skilled nursing?", q: "What is skilled nursing?",
      a: "Skilled nursing is clinical care from a licensed nurse in your home: nursing assessments, medication management and education, wound care and dressing changes, post-hospital and post-surgical care, monitoring of vital signs, chronic disease management, and teaching for patients and caregivers. It is often ordered after a hospital stay, a surgery, or a change in a chronic condition. [More about skilled nursing](services/#skilled-nursing).",
      kw: ["skilled", "nurse", "nursing", "wound", "dressing", "vital", "blood pressure", "injection", "post surgical", "surgery", "hospital", "discharge", "chronic"] },
    { id: "homecare", topic: "services", chip: "What does home care include?", q: "What does non-skilled home care include?",
      a: "Non-skilled home care is hands-on help with everyday life: bathing, dressing, grooming and toileting, mobility and transfers, meal preparation and feeding assistance as authorized, light housekeeping related to your care, companionship and safety supervision, and support with daily routines so you stay as independent as possible. [More about home care](services/#home-care).",
      kw: ["home care", "personal care", "bathing", "dressing", "toileting", "grooming", "meal", "cooking", "housekeeping", "companion", "companionship", "adl", "daily living", "aide", "caregiver", "non skilled", "nonskilled"] },
    { id: "difference", topic: "services", chip: "Skilled vs non-skilled?", q: "What is the difference between skilled nursing and non-skilled home care?",
      a: "Skilled nursing is clinical care that only a licensed nurse can provide, such as wound care, medication management and monitoring of a medical condition. Non-skilled home care is help with daily activities such as bathing, dressing, meals and companionship, provided by trained caregivers. Many families use both, and we coordinate them under one plan.",
      kw: ["difference", "versus", "vs", "compare", "skilled or"] },
    { id: "coordination", topic: "services", chip: "Do you work with my doctor?", q: "Do you coordinate with my doctor and other providers?",
      a: "Yes. Communication with physicians and other healthcare professionals is built into every plan. We help you understand discharge instructions, support medication management, share changes in condition, and work with your support coordinator or case manager when one is involved. [Care coordination](services/#care-coordination).",
      kw: ["doctor", "physician", "coordinate", "coordination", "pharmacy", "pharmacist", "case manager", "support coordinator", "education", "discharge instructions"] },

    { id: "waiver", topic: "waiver", chip: "What is the CCC Plus Waiver?", q: "What is the CCC Plus Waiver?",
      a: "The Commonwealth Coordinated Care Plus (CCC Plus) Waiver is a Virginia Medicaid program. One option within it, consumer direction, lets eligible participants hire and manage their own personal care attendants, with an Employer of Record handling the employer responsibilities. Discovery Health LLC provides Service Facilitation for eligible consumer-directed participants, subject to current Virginia DMAS requirements and program availability. [Read more](services/#consumer-directed).",
      kw: ["ccc plus", "ccc", "waiver", "medicaid waiver", "consumer directed", "consumer-directed", "dmas", "commonwealth coordinated"] },
    { id: "facilitation", topic: "waiver", chip: "What does a service facilitator do?", q: "What does a service facilitator do?",
      a: "A service facilitator supports the consumer-directed model: completing the initial assessment, helping develop the service plan, explaining the roles of the Employer of Record, attendant and facilitator, assisting with recruiting and hiring attendants and with employer paperwork, completing required follow-up visits and reassessments, monitoring the quality of services, and keeping the required records. [Full list](services/#consumer-directed).",
      kw: ["facilitator", "facilitation", "service facilitation", "attendant", "hire", "hiring", "recruit", "paperwork", "reassessment"] },
    { id: "eor", topic: "waiver", chip: "What is an Employer of Record?", q: "What is an Employer of Record (EOR)?",
      a: "The Employer of Record is the person who acts as the employer of the personal care attendant in a consumer-directed arrangement. That can be the participant or a family member or representative acting on their behalf. The EOR hires, schedules and supervises the attendant and signs off on time. The service facilitator explains these responsibilities and helps with the paperwork.",
      kw: ["employer of record", "eor", "employer"] },
    { id: "eligible", topic: "waiver", chip: "Am I eligible?", q: "Am I eligible for consumer-directed services?",
      a: "Eligibility, authorization and enrollment for the CCC Plus Waiver are determined by Virginia DMAS and the participant's managed care organization, not by us. If you already have a waiver and want to direct your own care, or you are not sure where you stand, call us on [" + PHONE + "](" + TEL + ") and we will help you understand the next steps.",
      kw: ["eligible", "eligibility", "qualify", "qualified", "approved", "authorization", "mco", "managed care"] },

    { id: "cost", topic: "cost", chip: "How much does care cost?", q: "How much does in-home care cost?",
      a: "It depends on the type of care, how often visits are needed and how long each visit lasts. For eligible individuals some services may be covered through Virginia Medicaid programs, including the CCC Plus Waiver, and other coverage such as long-term care insurance may apply. Call [" + PHONE + "](" + TEL + ") and we will review the options for your situation with no obligation.",
      kw: ["cost", "price", "pricing", "rate", "rates", "how much", "afford", "pay", "payment", "expensive", "fee"] },
    { id: "medicaid", topic: "cost", chip: "Do you accept Medicaid?", q: "Do you accept Medicaid?",
      a: "We provide Service Facilitation for eligible CCC Plus consumer-directed participants, subject to applicable Virginia DMAS enrollment and program requirements. For other services, coverage depends on your plan and eligibility. Call us and we will go through what applies to you.",
      kw: ["medicaid", "accept", "take medicaid", "insurance accepted"] },
    { id: "insurance", topic: "cost", chip: "Medicare or private insurance?", q: "Do you take Medicare or private insurance?",
      a: "Coverage for home-based care varies a great deal between plans, and some services are paid privately. Rather than guess, we would rather look at your situation together. Call [" + PHONE + "](" + TEL + ") or [send us a message](contact/) and we will tell you plainly what may be covered and what would not be.",
      kw: ["medicare", "insurance", "private pay", "long term care insurance", "ltc", "anthem", "aetna", "humana", "united", "cover", "coverage"] },

    { id: "start", topic: "start", chip: "How do I get started?", q: "How do I get started?",
      a: "Three steps:\n\n1. Reach out. Call [" + PHONE + "](" + TEL + ") or use the [contact page](contact/). We listen, answer questions and explain which services fit.\n2. Build your plan. A nurse completes an in-home assessment and we create an individualized care plan with you, your family and your physicians.\n3. Get care at home. Your care team arrives on schedule and the plan is adjusted as your needs change.",
      kw: ["start", "started", "begin", "sign up", "enroll", "first step", "process", "how does it work", "next step"] },
    { id: "howfast", topic: "start", chip: "How quickly can care begin?", q: "How quickly can care begin?",
      a: "We aim to begin as soon as possible after the assessment. Private arrangements can start quickly. Services covered through Medicaid or the CCC Plus Waiver depend on authorization from DMAS or the managed care organization, and we keep you informed at each step.",
      kw: ["how quickly", "how soon", "how fast", "when can", "start date", "urgent", "right away", "tomorrow", "this week"] },
    { id: "assessment", topic: "start", chip: "What happens at the assessment?", q: "What happens at the in-home assessment?",
      a: "A nurse visits your home, talks with you and your family about what is happening, reviews medications and medical history, looks at safety in the home, and identifies needs, risks and goals. From that visit we write an individualized plan of care that you can read and that is reviewed as things change.",
      kw: ["assessment", "evaluation", "visit", "first visit", "consultation", "plan of care", "care plan"] },
    { id: "who", topic: "start", chip: "Who will come to my home?", q: "Who will come to my home?",
      a: "Skilled services are provided by licensed nurses. Non-skilled home care is provided by trained caregivers. All staff are screened before they are assigned, and we work to keep the same team members with you so they learn your routines and notice changes early.",
      kw: ["who comes", "who will", "staff", "background check", "screened", "same caregiver", "consistent", "trust"] },
    { id: "contract", topic: "start", chip: "Is there a contract?", q: "Do I have to sign a long-term contract?",
      a: "Care is based on a written service agreement and an individualized plan of care that is reviewed and adjusted as your needs change. Schedules can be increased, reduced or paused with reasonable notice. Ask us about the notice period that applies to your services.",
      kw: ["contract", "commitment", "cancel", "cancellation", "notice", "agreement", "minimum hours"] },

    { id: "falls", topic: "services", chip: "Help after a hospital stay?", q: "Can you help after a hospital stay or a fall?",
      a: "Yes. Our transitional care and fall prevention service covers the move from hospital or rehab back home: reviewing discharge instructions, reconciling medications, checking the home for fall risks, helping with mobility, transfers and stairs, and teaching you and your family how to prevent falls. [Read more](services/#transitional-care).",
      kw: ["fall", "falls", "fell", "fall prevention", "stairs", "balance", "rehab", "transition", "transitional", "after hospital", "going home", "mobility"] },
    { id: "contact", topic: "contact", chip: "How do I reach you?", q: "How do I contact Discovery Health?",
      a: "Call [" + PHONE + "](" + TEL + "), email [info@discoveryhealthllc.com](mailto:info@discoveryhealthllc.com) or [office@discoveryhealthllc.com](mailto:office@discoveryhealthllc.com), or use the [contact page](contact/). We aim to respond to messages within one business day.",
      kw: ["contact", "phone", "call", "email", "reach", "number", "address", "hours", "open", "speak", "talk to someone", "human", "person"] },
    { id: "areas", topic: "contact", chip: "What areas do you serve?", q: "What areas do you serve?",
      a: "Discovery Health LLC serves individuals and families in their homes and communities. Please call [" + PHONE + "](" + TEL + ") to confirm availability in your area.",
      kw: ["area", "areas", "serve", "location", "located", "where", "county", "city", "richmond", "virginia", "near me", "zip"] },
    { id: "careers", topic: "contact", chip: "Are you hiring?", q: "Are you hiring nurses or caregivers?",
      a: "We are always glad to hear from nurses and caregivers who share our values. Please [send us a message](contact/) with your role and experience and the office will get back to you.",
      kw: ["hiring", "job", "jobs", "career", "careers", "work for", "employment", "apply", "cna", "rn", "lpn", "position"] },
    { id: "emergency", topic: "contact", chip: "What if there is an emergency?", q: "What should I do in an emergency?",
      a: "This chat and our website are not monitored for emergencies. If someone has chest pain, trouble breathing, signs of a stroke, severe bleeding, a serious fall or is unresponsive, call 911 now. For urgent but non-emergency questions about your care, call [" + PHONE + "](" + TEL + ").",
      kw: ["emergency", "urgent", "911", "ambulance", "er"] },
    { id: "privacy", topic: "contact", chip: "Is my information private?", q: "Is my information private?",
      a: "Yes. Please do not type detailed medical information into this chat; we will collect what we need by phone. How we handle information from this website is described in our [privacy policy](privacy-policy/). Once you are a patient or participant, your health information is protected under HIPAA.",
      kw: ["private", "privacy", "hipaa", "confidential", "secure", "data"] }
  ];

  /* Emergency safety layer: checked before anything else and answered instantly */
  var EMERGENCY_RE = /\b(chest pains?|heart attack|stroke|can'?t breathe|cannot breathe|not breathing|trouble breathing|unconscious|unresponsive|severe bleeding|bleeding (a lot|heavily|badly)|overdos\w*|choking|seizure|fell and can'?t|can'?t get up|collaps\w*|suicid\w*|want to die|hurt (myself|me))\b/i;
  var EMERGENCY_MSG = "If this is happening right now, please call 911 immediately. This chat is not monitored and cannot send help.\n\nIf it is not an emergency but you need to speak with someone about care, call us on [" + PHONE + "](" + TEL + ").";

  var GREETING = "Hello, I am the Discovery Health assistant.";
  var GREETING2 = "I can answer questions about our services, the CCC Plus Waiver, cost and coverage, and how to get started. Pick a topic below or type your question.";
  var FALLBACK = "I do not have a good answer for that yet. Our team can help directly: call [" + PHONE + "](" + TEL + ") or use the [contact page](contact/), answered within one business day. Or pick a topic below.";
  var SMALLTALK = [
    { re: /^(hi|hello|hey|good (morning|afternoon|evening))\b/i, a: "Hello! How can I help you today?" },
    { re: /\b(thank(s| you)|appreciate)\b/i, a: "You are welcome. Is there anything else I can help with?" },
    { re: /^(bye|goodbye|see you|that'?s all)\b/i, a: "Take care. We are here whenever you need us: " + PHONE + "." },
    { re: /\b(who are you|are you (a )?(bot|robot|human|real))\b/i, a: "I am an automated assistant for Discovery Health LLC. I can answer common questions; for anything personal, our team is a phone call away on " + PHONE + "." }
  ];

  var root, toggle, panel, log, sugg, form, input;
  var state = { started: false, topic: null, asked: [] };
  var history = [];

  function save() { try { sessionStorage.setItem("dhChat", JSON.stringify({ s: state, h: history.slice(-40), open: root.classList.contains("is-open") })); } catch (e) {} }
  function load() { try { var raw = sessionStorage.getItem("dhChat"); if (!raw) return null; return JSON.parse(raw); } catch (e) { return null; } }
  function byId(id) { for (var i = 0; i < FAQS.length; i++) if (FAQS[i].id === id) return FAQS[i]; return null; }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function render(text) {
    var html = esc(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, label, path) {
      var href = /^(https?:|tel:|mailto:)/.test(path) ? path : BASE + path;
      return '<a href="' + href + '">' + label + "</a>";
    });
    return html.replace(/\n/g, "<br>");
  }
  function addMsg(text, who, skipSave) {
    var d = document.createElement("div");
    d.className = "dhc-msg dhc-msg--" + who; d.innerHTML = render(text);
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    history.push({ text: text, who: who });
    if (!skipSave) save();
  }
  function typing(on) {
    var t = log.querySelector(".dhc-typing");
    if (on && !t) { t = document.createElement("div"); t.className = "dhc-msg dhc-msg--bot dhc-typing"; t.innerHTML = "<span></span><span></span><span></span>"; log.appendChild(t); log.scrollTop = log.scrollHeight; }
    if (!on && t) t.remove();
  }
  function botReply(text, after) {
    typing(true);
    var delay = Math.min(1400, 350 + text.length * 3);
    setTimeout(function () { typing(false); addMsg(text, "bot"); if (after) after(); }, delay);
  }
  function chip(label, cls, onClick) {
    var b = document.createElement("button"); b.type = "button"; b.className = "dhc-chip" + (cls ? " " + cls : ""); b.textContent = label;
    b.addEventListener("click", onClick); return b;
  }
  function renderChips() {
    sugg.innerHTML = "";
    if (!state.topic) {
      Object.keys(TOPICS).forEach(function (k) { sugg.appendChild(chip(TOPICS[k].label, "dhc-chip--topic", function () { openTopic(k); })); });
      sugg.appendChild(chip("Call " + PHONE, "dhc-chip--call", function () { location.href = TEL; }));
      return;
    }
    FAQS.filter(function (f) { return f.topic === state.topic && state.asked.indexOf(f.id) === -1; }).forEach(function (f) {
      sugg.appendChild(chip(f.chip, "", function () { answer(f, f.chip); }));
    });
    sugg.appendChild(chip("Back to topics", "dhc-chip--back", backToTopics));
  }
  function openTopic(k) { state.topic = k; save(); addMsg(TOPICS[k].label, "user"); botReply(TOPICS[k].intro, renderChips); }
  function backToTopics() { state.topic = null; save(); renderChips(); }
  function answer(f, echo) {
    if (echo) addMsg(echo, "user");
    if (state.asked.indexOf(f.id) === -1) state.asked.push(f.id);
    state.topic = f.topic; save();
    botReply(f.a, renderChips);
  }
  function normalize(s) { return s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function score(f, t) {
    var s = 0;
    f.kw.forEach(function (k) { if (t.indexOf(k) > -1) s += k.indexOf(" ") > -1 ? 3 : 2; });
    normalize(f.q).split(" ").forEach(function (w) { if (w.length > 3 && t.indexOf(w) > -1) s += 0.5; });
    return s;
  }
  function handle(text) {
    var raw = text.trim(); if (!raw) return;
    addMsg(raw, "user");
    if (EMERGENCY_RE.test(raw)) { typing(false); addMsg(EMERGENCY_MSG, "bot"); return; }
    var t = normalize(raw);
    for (var i = 0; i < SMALLTALK.length; i++) if (SMALLTALK[i].re.test(raw)) { botReply(SMALLTALK[i].a, renderChips); return; }
    var best = null, bs = 0;
    FAQS.forEach(function (f) { var s = score(f, t); if (s > bs) { bs = s; best = f; } });
    if (best && bs >= 2) { answer(best); return; }
    botReply(FALLBACK, function () { state.topic = null; renderChips(); });
  }
  function open() { root.classList.add("is-open"); toggle.setAttribute("aria-expanded", "true"); panel.hidden = false; if (!state.started) { state.started = true; save(); botReply(GREETING, function () { botReply(GREETING2, renderChips); }); } else renderChips(); setTimeout(function () { input.focus(); }, 200); save(); }
  function close() { root.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); panel.hidden = true; toggle.focus(); save(); }

  function build() {
    root = document.createElement("div"); root.className = "dhc"; root.setAttribute("data-dh-chatbot", "");
    root.innerHTML =
      '<button class="dhc-toggle" type="button" aria-expanded="false" aria-controls="dhc-panel" aria-label="Chat with the Discovery Health assistant">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        '<span class="dhc-toggle-label">Chat us</span></button>' +
      '<section class="dhc-panel" id="dhc-panel" role="dialog" aria-label="Discovery Health assistant" hidden>' +
        '<header class="dhc-head"><span class="dhc-avatar"><img src="' + BASE + 'assets/img/logo-mark.png" alt=""></span><div><strong>Discovery Health assistant</strong><small><i class="dhc-dot"></i>Online now. Not for emergencies: call 911.</small></div><button class="dhc-close" type="button" aria-label="Close chat">&times;</button></header>' +
        '<div class="dhc-log" role="log" aria-live="polite"></div>' +
        '<div class="dhc-sugg" aria-label="Suggested questions"></div>' +
        '<form class="dhc-form" autocomplete="off"><label class="dhc-sr" for="dhc-input">Type your question</label><input id="dhc-input" type="text" maxlength="300" placeholder="Type your question"><button type="submit" aria-label="Send">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg></button></form>' +
        '<p class="dhc-foot">Automated assistant. Please do not share medical details here.</p>' +
      "</section>";
    document.body.appendChild(root);
    toggle = root.querySelector(".dhc-toggle"); panel = root.querySelector(".dhc-panel"); log = root.querySelector(".dhc-log");
    sugg = root.querySelector(".dhc-sugg"); form = root.querySelector(".dhc-form"); input = root.querySelector("#dhc-input");
    toggle.addEventListener("click", function () { root.classList.contains("is-open") ? close() : open(); });
    root.querySelector(".dhc-close").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && root.classList.contains("is-open")) close(); });
    form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value; input.value = ""; handle(v); });
    var saved = load();
    if (saved && saved.s) {
      state = saved.s; (saved.h || []).forEach(function (m) { addMsg(m.text, m.who, true); });
      if (saved.open) { root.classList.add("is-open"); toggle.setAttribute("aria-expanded", "true"); panel.hidden = false; renderChips(); }
    }
    /* nudge label appears after a few seconds on first visit, hides once used */
    if (!saved) setTimeout(function () { root.classList.add("has-label"); }, 3500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
