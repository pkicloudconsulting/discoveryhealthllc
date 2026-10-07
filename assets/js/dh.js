/* Discovery Health LLC - shared behaviour: header nav, hero carousel, scroll reveal, FAQ accordion, contact form */
(function () {
  "use strict";

  /* Set this to the form backend URL (for example a Cloudflare Worker) once it exists.
     While it is empty the contact form falls back to opening the visitor email app with the message prefilled. */
  var FORM_ENDPOINT = "";
  var OFFICE_EMAIL = "office@discoveryhealthllc.com";
  var PHONE_DISPLAY = "(267) 939-7727";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Header navigation ---------- */
  var header = document.querySelector(".site-header");
  var burger = document.querySelector(".nav-burger");
  if (header && burger) {
    burger.addEventListener("click", function () {
      var open = header.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("nav-open")) { header.classList.remove("nav-open"); burger.setAttribute("aria-expanded", "false"); burger.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (header.classList.contains("nav-open") && !header.contains(e.target)) { header.classList.remove("nav-open"); burger.setAttribute("aria-expanded", "false"); }
    });
  }
  var page = document.body.getAttribute("data-page");
  if (page) {
    document.querySelectorAll(".site-nav a.nav-link[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === page) a.setAttribute("aria-current", "page");
    });
  }

  /* ---------- Hero carousel ----------
     A photo slide is up for STEP ms. A clip slide shows its poster for HOLD ms, then plays the muted clip and
     advances the moment the clip ends (SAFETY covers a stalled clip). The headline word changes with each slide. */
  (function () {
    var root = document.querySelector(".hero-carousel"); if (!root) return;
    var slides = [].slice.call(root.querySelectorAll(".hero-car-slide"));
    var word = document.querySelector(".hero-word");
    var dotsWrap = root.querySelector(".hero-car-dots");
    var i = 0, n = slides.length, timer = null, hold = null, hovering = false;
    var STEP = 5000, HOLD = 900, SAFETY = 9000;
    var dots = slides.map(function (s, j) {
      var d = document.createElement("button");
      d.type = "button"; d.className = "hero-car-dot";
      d.setAttribute("aria-label", "Show slide " + (j + 1) + ": " + (s.getAttribute("data-word") || ""));
      d.addEventListener("click", function () { go(j); restart(); });
      dotsWrap.appendChild(d);
      return d;
    });
    if (n < 2) dotsWrap.hidden = true;
    function makeClip(x, src) {
      var v = document.createElement("video");
      v.muted = true; v.loop = false; v.playsInline = true; v.preload = "auto";
      v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
      var im = x.querySelector("img"); if (im) v.style.objectPosition = im.style.objectPosition;
      v.addEventListener("canplay", function () { x.classList.add("has-video"); }, { once: true });
      v.addEventListener("ended", function () { if (slides[i] === x && !hovering) advance(); });
      v.src = src; x.insertBefore(v, x.querySelector("figcaption"));
      return v;
    }
    function go(j) {
      i = (j + n) % n;
      var s = slides[i];
      clearTimeout(hold);
      slides.forEach(function (x, k) { x.classList.toggle("is-active", k === i); x.setAttribute("aria-hidden", k !== i); });
      slides.forEach(function (x, k) {
        var src = x.getAttribute("data-video"); if (!src) return;
        var v = x.querySelector("video");
        var allowed = !reduce && !(navigator.connection && navigator.connection.saveData);
        if (allowed && !v && (k === i || k === (i + 1) % n)) v = makeClip(x, src);
        if (k === i && v) {
          v.pause();
          try { v.currentTime = 0; } catch (e) {}
          hold = setTimeout(function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); }, HOLD);
        } else if (v) { v.pause(); }
      });
      dots.forEach(function (d, k) { d.classList.toggle("is-active", k === i); d.setAttribute("aria-current", k === i ? "true" : "false"); });
      if (!word) return;
      var next = s.getAttribute("data-word") || word.textContent;
      if (reduce || word.textContent === next) { word.textContent = next; return; }
      word.classList.add("is-out");
      setTimeout(function () {
        word.textContent = next;
        word.classList.remove("is-out"); word.classList.add("is-enter");
        void word.offsetWidth;
        word.classList.remove("is-enter");
      }, 380);
    }
    function advance() { go(i + 1); restart(); }
    function restart() {
      if (reduce || n < 2) return;
      clearTimeout(timer);
      var v = slides[i].querySelector("video");
      timer = setTimeout(advance, !v ? STEP : v.ended ? 1500 : SAFETY);
    }
    root.addEventListener("mouseenter", function () { hovering = true; clearTimeout(timer); });
    root.addEventListener("mouseleave", function () { hovering = false; restart(); });
    var x0 = null;
    root.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    root.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1)); restart(); }
      x0 = null;
    }, { passive: true });
    document.addEventListener("visibilitychange", function () { if (document.hidden) clearTimeout(timer); else restart(); });
    go(0); restart();
  })();

  /* ---------- Scroll reveal ---------- */
  var toReveal = [].slice.call(document.querySelectorAll(".reveal"));
  if (toReveal.length) {
    if (reduce) { toReveal.forEach(function (el) { el.classList.add("in"); }); }
    else {
      /* anything whose top edge has entered the lower 92% of the viewport fades in; checked on load, scroll and resize */
      var pending = false;
      var check = function () {
        pending = false;
        var limit = window.innerHeight * 0.92;
        toReveal = toReveal.filter(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < limit && r.bottom > 0) { el.classList.add("in"); return false; }
          return true;
        });
        if (!toReveal.length) { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); }
      };
      var onScroll = function () { if (!pending) { pending = true; requestAnimationFrame(check); } };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      window.addEventListener("load", onScroll);
      check();
    }
  }

  /* ---------- FAQ: one open at a time per list ---------- */
  document.querySelectorAll(".faq-list").forEach(function (list) {
    list.addEventListener("toggle", function (e) {
      if (!e.target.open) return;
      list.querySelectorAll("details.faq[open]").forEach(function (d) { if (d !== e.target) d.open = false; });
    }, true);
  });

  /* ---------- Contact form ---------- */
  var form = document.querySelector("form.form[data-contact]");
  if (form) {
    var status = form.querySelector(".form-status");
    var say = function (kind, msg) { status.className = "form-status " + kind; status.textContent = msg; if (status.focus) status.focus(); };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var hp = form.querySelector("[name=website]");
      if (hp && hp.value) return; /* honeypot */
      var data = new FormData(form);
      var btn = form.querySelector("button[type=submit]");
      var mailto = function () {
        var lines = [];
        data.forEach(function (v, k) { if (k !== "website" && v) lines.push(k.replace(/_/g, " ") + ": " + v); });
        var subject = "Care inquiry from " + (data.get("name") || "website visitor");
        window.location.href = "mailto:" + OFFICE_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
        say("ok", "Your email app should open with your message ready to send. If it does not, email " + OFFICE_EMAIL + " or call " + PHONE_DISPLAY + ".");
      };
      if (FORM_ENDPOINT) {
        var payload = {}; data.forEach(function (v, k) { payload[k] = v; }); payload.page = location.pathname;
        btn.disabled = true; btn.textContent = "Sending...";
        fetch(FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
          .then(function (res) {
            if (res.ok) { form.reset(); say("ok", "Thank you. Your message has been sent. We will be in touch, usually within one business day."); return; }
            if (res.j && res.j.code === "not_configured") { mailto(); return; }
            say("err", (res.j && res.j.error) || ("Sorry, the message could not be sent. Please call " + PHONE_DISPLAY + " or email " + OFFICE_EMAIL + "."));
          })
          .catch(function () { mailto(); })
          .then(function () { btn.disabled = false; btn.textContent = "Send message"; });
        return;
      }
      mailto();
    });
  }

  /* ---------- Services dropdown ----------
     Desktop: the panel opens on hover and stays open for 350ms after the pointer leaves, so moving from the
     link down into the panel never snaps it shut. Phone: a chevron button expands the list inline. */
  (function () {
    var items = [].slice.call(document.querySelectorAll(".nav-item"));
    if (!items.length) return;
    var phone = window.matchMedia("(max-width: 960px)");
    items.forEach(function (item) {
      var timer;
      item.addEventListener("mouseenter", function () {
        if (phone.matches) return;
        clearTimeout(timer);
        items.forEach(function (o) { if (o !== item) o.classList.remove("is-hover"); });
        item.classList.add("is-hover");
      });
      item.addEventListener("mouseleave", function () { clearTimeout(timer); timer = setTimeout(function () { item.classList.remove("is-hover"); }, 350); });
      item.addEventListener("keydown", function (e) { if (e.key === "Escape") item.classList.remove("is-hover"); });
      var tog = item.querySelector(".nav-sub-toggle");
      if (tog) tog.addEventListener("click", function () { var open = item.classList.toggle("is-open"); tog.setAttribute("aria-expanded", open ? "true" : "false"); });
    });
  })();

  /* ---------- Reviews carousel ---------- */
  (function () {
    var root = document.querySelector(".reviews"); if (!root) return;
    var items = [].slice.call(root.querySelectorAll(".rev-item"));
    var dotsWrap = root.querySelector(".rev-dots");
    var i = 0, n = items.length, timer = null, hovering = false;
    var dots = items.map(function (it, k) {
      var d = document.createElement("button"); d.type = "button"; d.className = "rev-dot";
      d.setAttribute("aria-label", "Show review " + (k + 1));
      d.addEventListener("click", function () { go(k); restart(); });
      dotsWrap.appendChild(d); return d;
    });
    function go(k) {
      i = (k + n) % n;
      items.forEach(function (it, j) { it.classList.toggle("is-active", j === i); it.setAttribute("aria-hidden", j !== i); });
      dots.forEach(function (d, j) { d.classList.toggle("is-active", j === i); d.setAttribute("aria-current", j === i ? "true" : "false"); });
    }
    function restart() { clearTimeout(timer); if (reduce || hovering || n < 2) return; timer = setTimeout(function () { go(i + 1); restart(); }, 7000); }
    root.querySelector(".rev-arrow--prev").addEventListener("click", function () { go(i - 1); restart(); });
    root.querySelector(".rev-arrow--next").addEventListener("click", function () { go(i + 1); restart(); });
    root.addEventListener("mouseenter", function () { hovering = true; clearTimeout(timer); });
    root.addEventListener("mouseleave", function () { hovering = false; restart(); });
    var x0 = null;
    root.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    root.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1)); restart(); }
      x0 = null;
    }, { passive: true });
    go(0); restart();
  })();

  /* ---------- QR widget: hide for the session once dismissed ---------- */
  (function () {
    var q = document.querySelector(".dh-qr"); if (!q) return;
    try { if (sessionStorage.getItem("dhQrHide")) q.hidden = true; } catch (e) {}
    var c = q.querySelector(".dh-qr__close");
    if (c) c.addEventListener("click", function () { q.hidden = true; try { sessionStorage.setItem("dhQrHide", "1"); } catch (e) {} });
  })();
})();
