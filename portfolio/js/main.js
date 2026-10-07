/* ============================================================
   AMIR ULLAH KHAN - PORTFOLIO / shared behavior
   Nav + active link run immediately. Everything that depends on
   dynamic content (reveal, counters, slider, marquee, skills) is
   exposed as an init function that render.js calls after paint.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Mobile nav toggle ---------- */
  var toggle = document.querySelector(".nav__toggle");
  var links = document.querySelector(".nav__links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { links.classList.remove("is-open"); });
    });
  }

  /* ---------- Ambient cursor glow (desktop pointer only) ---------- */
  var canHoverFine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (canHoverFine && !reduceMotion) {
    var glow = document.createElement("div");
    glow.id = "cursorGlow";
    document.body.appendChild(glow);
    var gx = 0, gy = 0, cx = 0, cy = 0, raf = null;
    function tick() {
      cx += (gx - cx) * 0.15;
      cy += (gy - cy) * 0.15;
      glow.style.transform = "translate(" + cx + "px," + cy + "px)";
      raf = requestAnimationFrame(tick);
    }
    window.addEventListener("mousemove", function (e) {
      gx = e.clientX; gy = e.clientY;
      glow.classList.add("is-active");
      if (!raf) raf = requestAnimationFrame(tick);
    });
    document.addEventListener("mouseleave", function () { glow.classList.remove("is-active"); });
  }

  /* ---------- Active nav link ---------- */
  var current = (window.location.pathname.split("/").pop() || "index.html");
  document.querySelectorAll(".nav__links a[data-nav]").forEach(function (a) {
    if (a.getAttribute("data-nav") === current) a.classList.add("is-active");
  });

  /* ---------- Generic scroll reveal (re-runnable after re-render) ---------- */
  window.initRevealObservers = function () {
    var revealEls = document.querySelectorAll(".reveal:not([data-reveal-bound]), .reveal-stagger:not([data-reveal-bound])");
    if (!revealEls.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); el.setAttribute("data-reveal-bound", "1"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach(function (el) { el.setAttribute("data-reveal-bound", "1"); io.observe(el); });
  };
  window.initRevealObservers();

  /* ---------- Skill meters (re-runnable) ---------- */
  window.initSkillObservers = function () {
    var skillFills = document.querySelectorAll(".skill__fill:not([data-skill-bound])");
    if (!skillFills.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      skillFills.forEach(function (el) { el.classList.add("is-filled"); el.setAttribute("data-skill-bound", "1"); });
      return;
    }
    var skillIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-filled");
            skillIo.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    skillFills.forEach(function (el) { el.setAttribute("data-skill-bound", "1"); skillIo.observe(el); });
  };

  /* ---------- Home-only behaviors: portrait reveal, counters, testimonial slider ---------- */
  window.initHomeBehaviors = function () {
    window.initRevealObservers();

    var portrait = document.querySelector(".hero__portrait");
    if (portrait && !portrait.hasAttribute("data-revealed")) {
      portrait.setAttribute("data-revealed", "1");
      requestAnimationFrame(function () {
        setTimeout(function () { portrait.classList.add("is-revealed"); }, 150);
      });
    }

    var statNums = document.querySelectorAll(".stat__num[data-count-to]:not([data-count-bound])");
    if (statNums.length) {
      var animateCount = function (el) {
        var target = parseFloat(el.getAttribute("data-count-to"));
        var decimals = el.getAttribute("data-decimals") ? parseInt(el.getAttribute("data-decimals"), 10) : 0;
        var numEl = el.querySelector(".num");
        if (reduceMotion) { numEl.textContent = target.toFixed(decimals); return; }
        var duration = 1400;
        var start = null;
        function step(ts) {
          if (start === null) start = ts;
          var progress = Math.min((ts - start) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          numEl.textContent = (target * eased).toFixed(decimals);
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      };
      if ("IntersectionObserver" in window) {
        var statIo = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { animateCount(entry.target); statIo.unobserve(entry.target); }
          });
        }, { threshold: 0.4 });
        statNums.forEach(function (el) { el.setAttribute("data-count-bound", "1"); statIo.observe(el); });
      } else {
        statNums.forEach(animateCount);
      }
    }

    var testi = document.querySelector(".testi");
    if (testi) {
      var track = testi.querySelector(".testi__track");
      var slides = testi.querySelectorAll(".testi__slide");
      var dots = testi.querySelectorAll(".testi__dot");
      var index = 0;
      var timer = null;
      if (window.__testiTimer) { clearInterval(window.__testiTimer); window.__testiTimer = null; }

      function goTo(i) {
        index = (i + slides.length) % slides.length;
        track.style.transform = "translateX(-" + index * 100 + "%)";
        dots.forEach(function (d, di) { d.classList.toggle("is-active", di === index); });
      }
      dots.forEach(function (d, di) {
        d.addEventListener("click", function () { goTo(di); restart(); });
      });
      function restart() {
        if (reduceMotion) return;
        clearInterval(timer);
        timer = window.__testiTimer = setInterval(function () { goTo(index + 1); }, 6000);
      }
      if (slides.length > 1) {
        goTo(0);
        restart();
        testi.addEventListener("mouseenter", function () { clearInterval(timer); });
        testi.addEventListener("mouseleave", restart);
      }
    }
  };
})();
