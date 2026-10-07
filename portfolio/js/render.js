/* ============================================================
   SITE RENDER ENGINE
   Reads AUKStore.getContent() and paints every dynamic section.
   Each page calls window.AUKRender.init("<page>") once on load.
   ============================================================ */
(function (global) {
  "use strict";

  var esc = function (s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  };

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", AUKStore.getTheme());
  }

  function getPath(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }

  /* Turn whatever was typed in the Admin into a link that really works.
     "linkedin.com/in/amir"  -> https://linkedin.com/in/amir
     "name@site.com"         -> mailto:name@site.com
     "+92 347 0895288" (kind "phone") -> https://wa.me/923470895288
     "" or "#"               -> "" (link is hidden instead of going nowhere) */
  function normalizeUrl(value, kind) {
    var v = (value == null ? "" : String(value)).trim();
    if (!v || v === "#") return "";
    if (kind === "phone") {
      if (/^https?:\/\//i.test(v)) return v;
      var digits = v.replace(/[^\d]/g, "");
      return digits ? "https://wa.me/" + digits : "";
    }
    if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
    if (/^\/\//.test(v)) return "https:" + v;
    if (/^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/.test(v)) return "mailto:" + v;
    if (/^(javascript|data|vbscript):/i.test(v)) return "";
    return "https://" + v.replace(/^\/+/, "");
  }

  function setLink(el, url, external) {
    if (!el) return;
    if (url) {
      el.href = url;
      el.hidden = false;
      el.removeAttribute("aria-disabled");
      if (external) { el.target = "_blank"; el.rel = "noopener noreferrer"; }
    } else {
      el.hidden = true;
      el.removeAttribute("href");
    }
  }

  /* ---------- shared: brand, footer, plain-text bindings, contact links ---------- */
  function renderChrome(c) {
    document.querySelectorAll("[data-text]").forEach(function (el) {
      var v = getPath(c, el.getAttribute("data-text"));
      if (typeof v === "string") el.textContent = v;
    });
    document.querySelectorAll("[data-brand]").forEach(function (el) {
      el.innerHTML = esc(c.site.brandFirst) + " <span>" + esc(c.site.brandLast) + "</span>";
    });
    document.title = document.title.replace(/\|.*$/, "| " + c.site.brandFirst + " " + c.site.brandLast);

    var mailto = "mailto:" + c.contact.email;
    document.querySelectorAll('[data-bind="contact.email"]').forEach(function (el) {
      el.textContent = c.contact.email;
      if (el.tagName === "A") el.href = mailto;
    });
    document.querySelectorAll('[data-bind-href="contact.email-mailto"]').forEach(function (el) { el.href = mailto; });
    document.querySelectorAll('[data-bind-href="contact.linkedin"]').forEach(function (el) { setLink(el, normalizeUrl(c.contact.linkedin), true); });
    document.querySelectorAll('[data-bind-href="contact.scholar"]').forEach(function (el) { setLink(el, normalizeUrl(c.contact.scholar), true); });
    document.querySelectorAll('[data-bind="contact.address"]').forEach(function (el) { el.textContent = c.contact.address; });

    document.querySelectorAll('[data-bind="closingCta.eyebrow"]').forEach(function (el) { el.textContent = c.closingCta.eyebrow; });
    document.querySelectorAll('[data-bind="closingCta.heading"]').forEach(function (el) { el.textContent = c.closingCta.heading; });
    document.querySelectorAll('[data-bind="closingCta.buttonLabel"]').forEach(function (el) { el.textContent = c.closingCta.buttonLabel; });
    document.querySelectorAll('[data-bind="hero.secondaryCta"]').forEach(function (el) { el.textContent = c.hero.secondaryCta; });
  }

  /* ---------- HOME ---------- */
  function renderHome(c) {
    var h = c.hero;
    var titleEl = document.getElementById("heroTitle");
    if (titleEl) {
      titleEl.innerHTML = esc(h.titleLead) + "<br />" + esc(h.titleRest) + " <em>" + esc(h.titleEm) + "</em> " + esc(h.titleTail);
    }
    var eyebrowEl = document.querySelector('[data-bind="hero.eyebrow"]');
    if (eyebrowEl) eyebrowEl.textContent = h.eyebrow;
    var taglineEl = document.querySelector('[data-bind="hero.tagline"]');
    if (taglineEl) taglineEl.textContent = h.tagline;
    var primaryCtaEl = document.getElementById("heroPrimaryCta");
    if (primaryCtaEl) primaryCtaEl.childNodes[0].nodeValue = h.primaryCta + " ";
    var portraitImg = document.getElementById("heroPortraitImg");
    if (portraitImg) portraitImg.src = h.portraitImage;
    var portraitTag = document.querySelector('[data-bind="hero.portraitTag"]');
    if (portraitTag) portraitTag.textContent = h.portraitTag;

    var dt = c.digitalTwin;
    var dtHead = document.getElementById("dtHeading"); if (dtHead) dtHead.textContent = dt.heading;
    var dtLede = document.getElementById("dtLede"); if (dtLede) dtLede.textContent = dt.lede;
    var dtRow = document.getElementById("twinRow");
    if (dtRow) {
      dtRow.innerHTML = dt.layers.map(function (l) {
        return '<article class="twin-card">' +
          '<div class="twin-card__frame"><img src="' + esc(l.image) + '" alt="' + esc(l.title) + '" loading="lazy" /></div>' +
          '<div class="twin-card__meta"><span class="twin-card__step">' + esc(l.step) + '</span><h3>' + esc(l.title) + '</h3></div>' +
          '</article>';
      }).join("");
    }
    var dtFeatureImg = document.getElementById("twinFeatureImg");
    var dtFeatureTag = document.getElementById("twinFeatureTag");
    var dtFeatureTitle = document.getElementById("twinFeatureTitle");
    if (dtFeatureImg) dtFeatureImg.src = dt.feature.image;
    if (dtFeatureTag) dtFeatureTag.textContent = dt.feature.tag;
    if (dtFeatureTitle) dtFeatureTitle.textContent = dt.feature.title;

    var statsWrap = document.getElementById("statsGrid");
    if (statsWrap) {
      statsWrap.innerHTML = c.stats.map(function (s) {
        return '<div class="stat"><div class="stat__num" data-count-to="' + s.value + '" data-decimals="' + s.decimals + '">' +
          '<span class="num">0</span><span class="suffix">' + esc(s.suffix) + '</span></div>' +
          '<div class="stat__label">' + esc(s.label) + '</div></div>';
      }).join("");
    }

    var svcCards = document.getElementById("svcCards");
    if (svcCards) {
      if (!svcCards._icons) {
        svcCards._icons = Array.prototype.map.call(svcCards.querySelectorAll(".service-card__icon"), function (n) { return n.innerHTML; });
      }
      var icons = svcCards._icons;
      svcCards.innerHTML = (c.serviceCards || []).map(function (s, i) {
        return '<div class="service-card"><div class="service-card__icon">' + (icons[i % icons.length] || "") + '</div>' +
          '<h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div>';
      }).join("");
    }

    var svcHead = document.getElementById("svcTeaserHeading"); if (svcHead) svcHead.textContent = c.servicesTeaserHeading;
    var svcLede = document.getElementById("svcTeaserLede"); if (svcLede) svcLede.textContent = c.servicesTeaserLede;

    var workGrid = document.getElementById("workGrid");
    if (workGrid) {
      workGrid.innerHTML = c.featuredWork.map(function (w) {
        return '<article class="work-card">' +
          '<div class="work-card__frame"><img src="' + esc(w.image) + '" alt="' + esc(w.title) + '" style="width:100%;height:100%;object-fit:cover;" /></div>' +
          '<div class="work-card__meta"><span class="work-card__kicker">' + esc(w.kicker) + '</span><h3>' + esc(w.title) + '</h3></div>' +
          '</article>';
      }).join("");
    }

    var testiTrack = document.getElementById("testiTrack");
    var testiNav = document.getElementById("testiNav");
    if (testiTrack) {
      testiTrack.innerHTML = c.testimonials.map(function (t) {
        return '<div class="testi__slide"><p class="testi__quote">' + esc(t.quote) + '</p>' +
          '<p class="testi__by"><b>' + esc(t.by) + '</b> \u00b7 ' + esc(t.org) + '</p></div>';
      }).join("");
    }
    if (testiNav) {
      testiNav.innerHTML = c.testimonials.map(function (t, i) {
        return '<button class="testi__dot" aria-label="Testimonial ' + (i + 1) + '"></button>';
      }).join("");
    }

    var marqueeTrack = document.getElementById("marqueeTrack");
    if (marqueeTrack) {
      var items = c.toolsMarquee.map(function (name) { return '<span class="marquee__item">' + esc(name) + '</span>'; }).join("");
      var itemsHidden = c.toolsMarquee.map(function (name) { return '<span class="marquee__item" aria-hidden="true">' + esc(name) + '</span>'; }).join("");
      marqueeTrack.innerHTML = items + itemsHidden;
    }

    if (window.initHomeBehaviors) window.initHomeBehaviors();
  }

  /* ---------- PORTFOLIO ---------- */
  function renderPortfolio(c) {
    var grid = document.getElementById("portfolioGrid");
    if (!grid) return;

    var cats = c.portfolioCategories || [];
    var filters = document.getElementById("filters");
    if (filters) {
      var wanted = filters.getAttribute("data-active") || "all";
      if (wanted !== "all" && !cats.some(function (k) { return k.id === wanted; })) wanted = "all";
      filters.setAttribute("data-active", wanted);
      var tabs = [{ id: "all", label: c.pages.projects.allLabel || "All Work" }].concat(cats);
      filters.innerHTML = '<span class="filter-indicator" id="filterIndicator"></span>' + tabs.map(function (k) {
        var on = k.id === wanted;
        return '<button class="filter-tab' + (on ? " is-active" : "") + '" data-filter="' + esc(k.id) + '" role="tab" aria-selected="' + on + '" type="button">' + esc(k.label) + '</button>';
      }).join("");
    }

    if (!c.portfolio.length) {
      grid.innerHTML = '<p class="empty-state">New projects are on the way.</p>';
    } else {
      grid.innerHTML = c.portfolio.map(function (p) {
        return '<button class="portfolio-card" data-category="' + esc(p.category) + '" data-id="' + esc(p.id) + '" type="button">' +
          '<div class="portfolio-card__frame"><img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;" /></div>' +
          '<div class="portfolio-card__meta">' +
          '<span class="portfolio-card__kicker">' + esc(p.kicker) + '</span>' +
          '<h3>' + esc(p.title) + '</h3>' +
          '<p>' + esc(p.desc) + '</p>' +
          '</div></button>';
      }).join("");
    }
    if (window.initPortfolioBehaviors) window.initPortfolioBehaviors();
  }

  /* ---------- SERVICES ---------- */
  function renderServices(c) {
    var wrap = document.getElementById("servicesList");
    if (!wrap) return;
    wrap.innerHTML = c.services.map(function (s, i) {
      var check = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.5 6.5 12 13 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      return '<article class="service-detail service-detail--' + esc(s.color) + ' reveal">' +
        '<div class="service-detail__side"><span class="service-detail__index">' + String(i + 1).padStart(2, "0") + '</span>' +
        '<div class="service-detail__icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/></svg></div></div>' +
        '<div class="service-detail__body">' +
        '<h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p>' +
        '<ul class="service-detail__deliverables">' + s.deliverables.map(function (d) { return "<li>" + check + esc(d) + "</li>"; }).join("") + "</ul>" +
        '<div class="service-detail__footer"><span class="service-detail__price">Starting at <b>' + esc(s.priceAmount) + '</b> ' + esc(s.priceUnit) + '</span>' +
        '<a href="contact.html" class="service-detail__quote">Get a Quote<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
        '</div></div></article>';
    }).join("");

    var revealEls = wrap.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    }
  }

  /* ---------- ABOUT ---------- */
  function renderAbout(c) {
    var a = c.about;
    var headEl = document.getElementById("aboutHeading"); if (headEl) headEl.textContent = a.heading;
    var storyEl = document.getElementById("aboutStory");
    if (storyEl) storyEl.innerHTML = a.story.map(function (p) { return '<p class="body-copy" style="max-width:none;">' + esc(p) + "</p>"; }).join("");
    var factsEl = document.getElementById("aboutFacts");
    if (factsEl) {
      factsEl.innerHTML = a.facts.map(function (f) {
        return '<div class="narrative__fact"><span>' + esc(f.label) + '</span><span>' + esc(f.value) + '</span></div>';
      }).join("");
    }
    var cvLink = document.getElementById("cvDownload");
    if (cvLink) { cvLink.hidden = !a.cvFile; if (a.cvFile) cvLink.href = a.cvFile; }

    var tlEl = document.getElementById("timeline");
    if (tlEl) {
      tlEl.innerHTML = a.milestones.map(function (m) {
        return '<div class="milestone reveal' + (m.current ? " milestone--current" : "") + '">' +
          '<span class="milestone__year">' + esc(m.year) + '</span><h3>' + esc(m.title) + '</h3><p>' + esc(m.desc) + '</p></div>';
      }).join("");
    }

    var skillsEl = document.getElementById("skillsList");
    if (skillsEl) {
      skillsEl.innerHTML = a.skills.map(function (s) {
        return '<div class="skill"><div class="skill__top"><span class="skill__name">' + esc(s.name) + '</span><span class="skill__pct">' + s.pct + '%</span></div>' +
          '<div class="skill__track"><div class="skill__fill" style="--pct:' + s.pct + '%"></div></div></div>';
      }).join("");
    }

    var awardsEl = document.getElementById("awardsList");
    if (awardsEl) {
      awardsEl.innerHTML = a.awards.map(function (aw) {
        return '<div class="award-item"><span class="award-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2 14.5 8.5 21 9l-5 4.6L17.5 21 12 17.3 6.5 21 8 13.6 3 9l6.5-.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></span>' +
          '<div><h4>' + esc(aw.title) + '</h4><p>' + esc(aw.sub) + '</p></div></div>';
      }).join("");
    }

    var expEl = document.getElementById("expGalleries");
    if (expEl) {
      var eg = c.experienceGalleries;
      expEl.innerHTML = eg.items.map(function (exp) {
        var imgs = (exp.images || []).map(function (im) {
          return '<a href="' + esc(im) + '" target="_blank" rel="noopener"><img src="' + esc(im) + '" alt="' + esc(exp.title) + ' photo" loading="lazy" /></a>';
        }).join("");
        return '<div class="exp-gallery"><div class="exp-gallery__head"><h3>' + esc(exp.title) + '</h3><p>' + esc(exp.subtitle) + '</p></div>' +
          '<div class="exp-gallery__grid">' + (imgs || '<span class="exp-gallery__empty">Photos coming soon.</span>') + '</div></div>';
      }).join("");
    }

    if (window.initSkillObservers) window.initSkillObservers();
    if (window.initRevealObservers) window.initRevealObservers();
  }

  /* ---------- CONTACT ---------- */
  function renderContact(c) {
    var ct = c.contact;
    var headEl = document.getElementById("contactHeading"); if (headEl) headEl.textContent = ct.heading;
    var ledeEl = document.getElementById("contactLede"); if (ledeEl) ledeEl.textContent = ct.lede;

    var emailLink = document.getElementById("contactEmailLink");
    if (emailLink) { emailLink.href = "mailto:" + ct.email; emailLink.querySelector(".contact-link__value").textContent = ct.email; }

    var waLink = document.getElementById("contactWhatsappLink");
    if (waLink) {
      setLink(waLink, normalizeUrl(ct.whatsappLink || ct.whatsapp, "phone") || normalizeUrl(ct.whatsapp, "phone"), true);
      waLink.querySelector(".contact-link__value").textContent = ct.whatsapp;
    }
    setLink(document.getElementById("contactLinkedinLink"), normalizeUrl(ct.linkedin), true);
    setLink(document.getElementById("contactScholarLink"), normalizeUrl(ct.scholar || c.publications.scholarLink), true);

    var typeSel = document.getElementById("fType");
    if (typeSel) {
      var keep = typeSel.value;
      typeSel.innerHTML = '<option value="" disabled>Select a project type</option>' +
        (ct.projectTypes || []).map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join("");
      typeSel.value = (ct.projectTypes || []).indexOf(keep) >= 0 ? keep : "";
    }

    window.AUK_CONTACT_EMAIL = ct.email;
    document.dispatchEvent(new CustomEvent("auk:contact-ready", { detail: ct }));
  }

  /* ---------- CREDENTIALS (Publications + Certifications) ---------- */
  function fileIconSvg() {
    return '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" class="cert-card__file-icon"><path d="M6 2h9l5 5v15H6V2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M15 2v5h5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 13h6M9 16.5h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  }
  function certCard(item) {
    var frame = item.fileUrl
      ? (item.fileUrl.indexOf("data:application/pdf") === 0 || /\.pdf($|\?)/i.test(item.fileUrl)
          ? '<div class="cert-card__frame">' + fileIconSvg() + '</div>'
          : '<div class="cert-card__frame"><img src="' + esc(item.fileUrl) + '" alt="' + esc(item.title) + '" loading="lazy" /></div>')
      : '<div class="cert-card__frame">' + fileIconSvg() + '</div>';
    var inner = frame + '<div class="cert-card__meta"><h4>' + esc(item.title) + '</h4><p>' + esc([item.issuer, item.date].filter(Boolean).join(" \u00b7 ")) + '</p></div>';
    return item.fileUrl
      ? '<a class="cert-card" href="' + esc(item.fileUrl) + '" target="_blank" rel="noopener">' + inner + '</a>'
      : '<div class="cert-card">' + inner + '</div>';
  }
  function certGroup(items) {
    if (!items || !items.length) return '<div class="cert-card__empty">Nothing uploaded here yet.</div>';
    return items.map(certCard).join("");
  }

  function renderCredentials(c) {
    var pubHead = document.getElementById("pubHeading"); if (pubHead) pubHead.textContent = c.publications.heading;
    var pubLede = document.getElementById("pubLede"); if (pubLede) pubLede.textContent = c.publications.lede;
    var scholarUrl = normalizeUrl(c.publications.scholarLink) || normalizeUrl(c.contact.scholar);
    var scholarLink = document.getElementById("pubScholarLink");
    setLink(scholarLink, scholarUrl, true);
    var scholarWrap = document.getElementById("pubScholarWrap");
    if (scholarWrap) scholarWrap.hidden = !scholarUrl;

    var papersEl = document.getElementById("papersList");
    if (papersEl) {
      papersEl.innerHTML = c.publications.papers.map(function (p) {
        var links = "";
        if (p.fileUrl) links += '<a href="' + esc(p.fileUrl) + '" target="_blank" rel="noopener">View PDF</a>';
        var ext = normalizeUrl(p.externalLink);
        if (ext) links += '<a href="' + esc(ext) + '" target="_blank" rel="noopener noreferrer">View Online</a>';
        return '<div class="pub-card"><h3>' + esc(p.title) + '</h3><span class="pub-card__venue">' + esc(p.venue) + '</span>' +
          '<p class="pub-desc">' + esc(p.description) + '</p>' +
          (links ? '<div class="pub-card__links">' + links + '</div>' : '') + '</div>';
      }).join("");
    }

    var certHead = document.getElementById("certHeading"); if (certHead) certHead.textContent = c.certifications.heading;
    var certLede = document.getElementById("certLede"); if (certLede) certLede.textContent = c.certifications.lede;
    var jobEl = document.getElementById("certJobExperience"); if (jobEl) jobEl.innerHTML = certGroup(c.certifications.jobExperience);
    var acadEl = document.getElementById("certAcademic"); if (acadEl) acadEl.innerHTML = certGroup(c.certifications.academic);
    var scholEl = document.getElementById("certScholarships"); if (scholEl) scholEl.innerHTML = certGroup(c.certifications.scholarships);

    if (window.initRevealObservers) window.initRevealObservers();
  }

  var PAGE_RENDERERS = { home: renderHome, portfolio: renderPortfolio, services: renderServices, about: renderAbout, contact: renderContact, credentials: renderCredentials };

  function renderPage(page) {
    var c = AUKStore.getContent();
    applyTheme();
    renderChrome(c);
    if (PAGE_RENDERERS[page]) PAGE_RENDERERS[page](c);
  }

  global.AUKRender = {
    normalizeUrl: normalizeUrl,
    init: function (page) {
      var paintedVersion = -1;
      function paint() {
        if (paintedVersion === AUKStore.version) return;
        paintedVersion = AUKStore.version;
        renderPage(page);
      }
      AUKStore.onChange(function () { paintedVersion = -1; paint(); });

      if (AUKStore.hasCache()) {
        paint();            // instant: last known content
        AUKStore.init();    // then check the server; repaints only if something changed
      } else {
        // first ever visit: give the server a moment so nobody sees default text flash
        var painted = false;
        var timer = setTimeout(function () { if (!painted) { painted = true; paint(); } }, 1800);
        AUKStore.init().then(function () { clearTimeout(timer); if (!painted) { painted = true; paint(); } });
      }
    }
  };
})(window);
