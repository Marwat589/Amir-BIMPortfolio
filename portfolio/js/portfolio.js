/* ============================================================
   PORTFOLIO PAGE - filters, staggered reveal, lightbox
   render.js rebuilds the filter tabs and the card grid from the
   saved content, then calls window.initPortfolioBehaviors().
   Handlers are delegated and always read the CURRENT cards, so
   nothing goes stale when the content is re-rendered.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var bound = false;
  var lastFocused = null;

  function cards() {
    var grid = document.getElementById("portfolioGrid");
    return grid ? Array.prototype.slice.call(grid.querySelectorAll(".portfolio-card")) : [];
  }

  function moveIndicator() {
    var indicator = document.getElementById("filterIndicator");
    var tab = document.querySelector(".filter-tab.is-active");
    if (!indicator || !tab) return;
    indicator.style.width = tab.offsetWidth + "px";
    indicator.style.transform = "translate(" + tab.offsetLeft + "px, " + tab.offsetTop + "px)";
    indicator.style.height = tab.offsetHeight + "px";
  }

  function applyFilter(filter, animate) {
    cards().forEach(function (card, i) {
      var match = filter === "all" || card.getAttribute("data-category") === filter;
      card.classList.toggle("is-filtered-out", !match);
      if (match && animate && !reduceMotion) {
        card.classList.remove("is-entering");
        void card.offsetWidth;
        card.style.animationDelay = Math.min(i % 6, 6) * 0.05 + "s";
        card.classList.add("is-entering");
      }
    });
  }

  function initEntrance() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var list = cards();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var i = list.indexOf(entry.target);
          entry.target.style.animationDelay = Math.min(i % 6, 6) * 0.06 + "s";
          entry.target.classList.add("is-entering");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    list.forEach(function (c) { io.observe(c); });
  }

  /* ---------- lightbox ---------- */
  function lightboxEls() {
    return {
      box: document.getElementById("lightbox"),
      frame: document.getElementById("lightboxFrame"),
      kicker: document.getElementById("lightboxKicker"),
      title: document.getElementById("lightboxTitle"),
      desc: document.getElementById("lightboxDesc"),
      close: document.getElementById("lightboxClose"),
      gallery: document.getElementById("lightboxGallery")
    };
  }

  function openLightbox(card) {
    var L = lightboxEls();
    if (!L.box) return;
    var id = card.getAttribute("data-id");
    var project = AUKStore.getContent().portfolio.filter(function (p) { return p.id === id; })[0];
    if (!project) return;

    L.frame.innerHTML = "";
    var main = document.createElement("img");
    main.src = project.image;
    main.alt = project.title;
    main.style.cssText = "width:100%;height:100%;object-fit:cover;";
    L.frame.appendChild(main);
    L.kicker.textContent = project.kicker || "";
    L.title.textContent = project.title || "";
    L.desc.textContent = project.desc || "";

    L.gallery.innerHTML = "";
    var shots = [project.image].concat(project.gallery || []);
    if (shots.length > 1) {
      shots.forEach(function (src, i) {
        var thumb = document.createElement("img");
        thumb.src = src;
        thumb.alt = "Project photo " + (i + 1);
        if (i === 0) thumb.classList.add("is-active");
        thumb.addEventListener("click", function () {
          main.src = src;
          L.gallery.querySelectorAll("img").forEach(function (t) { t.classList.remove("is-active"); });
          thumb.classList.add("is-active");
        });
        L.gallery.appendChild(thumb);
      });
    }

    lastFocused = document.activeElement;
    L.box.classList.add("is-open");
    L.box.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    L.close.focus();
  }

  function closeLightbox() {
    var L = lightboxEls();
    if (!L.box) return;
    L.box.classList.remove("is-open");
    L.box.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    var filters = document.getElementById("filters");
    if (filters) {
      filters.addEventListener("click", function (e) {
        var tab = e.target.closest(".filter-tab");
        if (!tab) return;
        filters.setAttribute("data-active", tab.getAttribute("data-filter"));
        filters.querySelectorAll(".filter-tab").forEach(function (t) {
          var on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        moveIndicator();
        applyFilter(tab.getAttribute("data-filter"), true);
      });
    }

    var grid = document.getElementById("portfolioGrid");
    if (grid) {
      grid.addEventListener("click", function (e) {
        var card = e.target.closest(".portfolio-card");
        if (card) openLightbox(card);
      });
    }

    var L = lightboxEls();
    if (L.box) {
      L.close.addEventListener("click", closeLightbox);
      L.box.addEventListener("click", function (e) { if (e.target === L.box) closeLightbox(); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && L.box.classList.contains("is-open")) closeLightbox();
      });
    }
    window.addEventListener("resize", moveIndicator);
  }

  window.initPortfolioBehaviors = function () {
    bindOnce();
    var filters = document.getElementById("filters");
    var active = filters ? (filters.getAttribute("data-active") || "all") : "all";
    applyFilter(active, false);
    initEntrance();
    requestAnimationFrame(moveIndicator);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveIndicator);
  };
})();
