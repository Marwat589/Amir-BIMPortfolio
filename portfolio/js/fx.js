/* ============================================================
   FX: cursor-follow spotlight on cards, magnetic primary buttons,
   click-to-copy email toast. pointermove only (no scroll listeners),
   transform + custom properties only. Skips touch and reduced motion.
   ============================================================ */
(function () {
  "use strict";
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CARD = ".service-card, .work-card, .portfolio-card, .twin-card, .stat, .cert-card, .pub-card, .award-item, .service-detail, .exp-gallery";

  if (fine && !calm) {
    var frame = null, last = null;
    document.addEventListener("pointermove", function (e) {
      last = e;
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        var card = last.target.closest && last.target.closest(CARD);
        if (card) {
          var r = card.getBoundingClientRect();
          card.style.setProperty("--mx", (last.clientX - r.left) + "px");
          card.style.setProperty("--my", (last.clientY - r.top) + "px");
        }
        var btn = last.target.closest && last.target.closest(".btn--primary");
        document.querySelectorAll(".btn--primary.is-magnet").forEach(function (b) {
          if (b !== btn) { b.classList.remove("is-magnet"); b.style.transform = ""; }
        });
        if (btn) {
          var br = btn.getBoundingClientRect();
          var dx = (last.clientX - (br.left + br.width / 2)) / br.width;
          var dy = (last.clientY - (br.top + br.height / 2)) / br.height;
          btn.classList.add("is-magnet");
          btn.style.transform = "translate(" + (dx * 8).toFixed(1) + "px," + (dy * 6 - 2).toFixed(1) + "px)";
        }
      });
    }, { passive: true });
  }

  /* Click the email in the footer or on Contact: copy it and confirm. The mailto link still works
     on a normal click; use a modifier-click (Ctrl/Cmd) or long-press to copy. */
  var toast = null, timer = null;
  function say(msg) {
    if (!toast) { toast = document.createElement("div"); toast.className = "fx-toast"; toast.setAttribute("role", "status"); document.body.appendChild(toast); }
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove("is-visible"); }, 2200);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="mailto:"]');
    if (!a || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    var addr = a.getAttribute("href").replace(/^mailto:/, "").split("?")[0];
    if (navigator.clipboard) navigator.clipboard.writeText(addr).then(function () { say("Email copied to clipboard"); }, function () { say(addr); });
    else say(addr);
  });
})();
