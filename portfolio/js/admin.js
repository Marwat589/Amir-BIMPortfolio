/* ============================================================
   ADMIN PANEL LOGIC
   ============================================================ */
(function () {
  "use strict";

  var renderPortfolioList = null;
  var draft = null; // working copy of content, mutated by the form, written on "Save"

  /* ---------- small DOM helpers ---------- */
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function field(labelText, inputEl) {
    return el("div", { class: "field" }, [el("label", { text: labelText }), inputEl]);
  }
  function textInput(value, onInput, placeholder) {
    var i = el("input", { type: "text" });
    i.value = value || "";
    if (placeholder) i.placeholder = placeholder;
    i.addEventListener("input", function () { onInput(i.value); });
    return i;
  }
  function textArea(value, onInput) {
    var t = el("textarea", {});
    t.value = value || "";
    t.addEventListener("input", function () { onInput(t.value); });
    return t;
  }
  function numberInput(value, onInput, min, max) {
    var i = el("input", { type: "number" });
    i.value = value != null ? value : 0;
    if (min != null) i.min = min;
    if (max != null) i.max = max;
    i.addEventListener("input", function () { onInput(parseFloat(i.value) || 0); });
    return i;
  }
  function checkboxRow(checked, onChange, labelText) {
    var wrap = el("label", { style: "display:flex;align-items:center;gap:8px;font-size:0.86rem;color:var(--text-1);margin:6px 0 16px;" });
    var cb = el("input", { type: "checkbox" });
    cb.checked = !!checked;
    cb.addEventListener("change", function () { onChange(cb.checked); });
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(labelText));
    return wrap;
  }

  /* Up/down reorder buttons for any array-backed list editor. `arr` is the live array (e.g.
     draft.portfolio), `idx` is this item's current position, `rerender` redraws the list.
     This is what controls the order things appear in on the live site. */
  function moveButtons(arr, idx, rerender) {
    var wrap = el("span", { class: "admin-move-btns" });
    var up = el("button", { type: "button", class: "admin-move-btn", title: "Move up", "aria-label": "Move up" });
    up.innerHTML = "&#9650;";
    var down = el("button", { type: "button", class: "admin-move-btn", title: "Move down", "aria-label": "Move down" });
    down.innerHTML = "&#9660;";
    up.disabled = idx === 0;
    down.disabled = idx === arr.length - 1;
    up.addEventListener("click", function () {
      if (idx === 0) return;
      var tmp = arr[idx - 1]; arr[idx - 1] = arr[idx]; arr[idx] = tmp;
      rerender();
    });
    down.addEventListener("click", function () {
      if (idx === arr.length - 1) return;
      var tmp = arr[idx + 1]; arr[idx + 1] = arr[idx]; arr[idx] = tmp;
      rerender();
    });
    wrap.appendChild(up); wrap.appendChild(down);
    return wrap;
  }

  /* ---------- status bar, errors, saving ---------- */
  var statusEl = null, statusTimer = null, pendingUploads = 0;

  function setStatus(msg, kind, ms) {
    if (!statusEl) {
      statusEl = el("div", { class: "admin-status", role: "status" });
      document.body.appendChild(statusEl);
    }
    clearTimeout(statusTimer);
    if (!msg) { statusEl.classList.remove("is-visible"); return; }
    statusEl.className = "admin-status is-visible" + (kind ? " admin-status--" + kind : "");
    statusEl.textContent = msg;
    if (ms) statusTimer = setTimeout(function () { statusEl.classList.remove("is-visible"); }, ms);
  }
  function handleError(err) {
    console.error(err);
    if (err && err.code === "auth") {
      setStatus(err.message, "error");
      setTimeout(function () { window.location.reload(); }, 1800);
      return;
    }
    setStatus((err && err.message) || "Something went wrong. Please try again.", "error", 7000);
  }
  function uploadStart() {
    pendingUploads++;
    setStatus("Uploading...", "info");
  }
  var activeQueues = 0;   // while >0, a batch upload owns the status line; per-file "Upload finished" stays quiet
  function uploadBlob(blob, onUrl) {
    uploadStart();
    AUKStore.uploadFile(blob).then(function (url) {
      pendingUploads--;
      onUrl(url);
      if (pendingUploads === 0 && activeQueues === 0) setStatus("Upload finished. Press Save Changes to publish it.", "ok", 3500);
    }, function (err) {
      pendingUploads--;
      handleError(err);
    });
  }

  /* Process a FileList a few at a time instead of all at once. Needed for large batches (a project
     can have hundreds of photos): decoding and compressing dozens of images in parallel can overwhelm
     the browser and silently drop some, and gives no useful progress feedback either way. */
  function queueFiles(fileList, handler) {
    var files = Array.prototype.slice.call(fileList);
    var total = files.length;
    if (!total) return Promise.resolve();
    var CONCURRENCY = 3, idx = 0, active = 0, done = 0;
    activeQueues++;
    return new Promise(function (resolve) {
      function pump() {
        if (idx >= files.length && active === 0) { activeQueues--; resolve(); return; }
        while (active < CONCURRENCY && idx < files.length) {
          var file = files[idx++];
          active++;
          handler(file, function () {
            done++; active--;
            if (total > 1) setStatus("Adding photo " + done + " of " + total + "...", "info");
            pump();
          });
        }
      }
      pump();
    });
  }

  function flash(toastEl, text, isError) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.toggle("is-error", !!isError);
    toastEl.classList.add("is-visible");
    setTimeout(function () { toastEl.classList.remove("is-visible"); }, 3000);
  }

  /* Save the whole draft. `target` is a data-toast key or a toast element. */
  function commit(target) {
    var toastEl = typeof target === "string" ? document.querySelector('[data-toast="' + target + '"]') : target;
    setStatus("Saving...", "info");
    return AUKStore.saveContent(draft).then(function (r) {
      var live = r.where === "server";
      flash(toastEl, live ? "Saved \u00b7 live for everyone" : "Saved in this browser only", false);
      setStatus(live ? "Saved. Visitors see this now." : "Saved in this browser only. No server is connected, so other devices will not see it.", live ? "ok" : "warn", 4000);
      return true;
    }).catch(function (err) {
      flash(toastEl, "Not saved", true);
      handleError(err);
      return false;
    });
  }

  /* ---------- image upload: read + downscale + compress, then store as a file ---------- */
  function handleImageFile(file, onUrl) {
    if (!file) return;
    if (file.type === "image/svg+xml" || file.type === "image/gif") { uploadBlob(file, onUrl); return; }
    var reader = new FileReader();
    reader.onerror = function () { setStatus("That image could not be read.", "error", 5000); };
    reader.onload = function (e) {
      var img = new Image();
      img.onerror = function () { setStatus("That file is not a readable image.", "error", 5000); };
      img.onload = function () {
        var maxDim = 1400;
        var w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
          else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        var canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        var keepPng = file.type === "image/png" && file.size < 1200000;
        canvas.toBlob(function (blob) {
          if (!blob) { setStatus("That image could not be processed.", "error", 5000); return; }
          uploadBlob(blob, onUrl);
        }, keepPng ? "image/png" : "image/jpeg", 0.84);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function imageUploadRow(currentSrc, round, onDataUrl) {
    var row = el("div", { class: "admin-thumb-row" });
    var img = el("img", { class: "admin-thumb" + (round ? " admin-thumb--round" : ""), alt: "preview" });
    img.src = currentSrc || "";
    var fileInput = el("input", { type: "file", accept: "image/*" });
    fileInput.addEventListener("change", function (e) {
      handleImageFile(e.target.files[0], function (url) { img.src = url; onDataUrl(url); });
    });
    var label = el("label", { class: "admin-file-btn", text: "Upload Image" }, [fileInput]);
    row.appendChild(img); row.appendChild(label);
    return row;
  }

  function isPdfUrl(url) { return !!url && (url.indexOf("data:application/pdf") === 0 || /\.pdf($|\?)/i.test(url)); }

  function handleAnyFile(file, onUrl) {
    if (!file) return;
    if (file.type.indexOf("image/") === 0) { handleImageFile(file, onUrl); return; }
    if (file.type !== "application/pdf") { setStatus("Please choose an image or a PDF.", "error", 5000); return; }
    if (file.size > 8 * 1024 * 1024) { setStatus("That PDF is over 8 MB. Compress it (for example with a free PDF compressor) and try again.", "error", 8000); return; }
    uploadBlob(file, onUrl);
  }

  function fileUploadRow(currentUrl, onUrl) {
    var row = el("div", { class: "admin-thumb-row" });
    var preview = el("div", { style: "width:74px;height:56px;border-radius:6px;border:1px solid var(--line);background:var(--bg-2);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font-size:11px;color:var(--text-2);" });
    function updatePreview(url) {
      preview.innerHTML = "";
      if (isPdfUrl(url)) preview.textContent = "PDF";
      else if (url) {
        var img = el("img", { style: "width:100%;height:100%;object-fit:cover;" });
        img.src = url;
        preview.appendChild(img);
      } else preview.textContent = "None";
    }
    updatePreview(currentUrl);
    var fileInput = el("input", { type: "file", accept: "image/*,application/pdf" });
    fileInput.addEventListener("change", function (e) {
      handleAnyFile(e.target.files[0], function (url) { updatePreview(url); onUrl(url); });
    });
    var label = el("label", { class: "admin-file-btn", text: "Upload Image or PDF" }, [fileInput]);
    row.appendChild(preview); row.appendChild(label);
    return row;
  }

  function multiImageEditor(container, imagesArr, onChange) {
    function render() {
      container.innerHTML = "";
      var grid = el("div", { style: "display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;" });
      imagesArr.forEach(function (src, idx) {
        var tile = el("div", { style: "position:relative;width:84px;height:64px;" });
        var img = el("img", { src: src, style: "width:100%;height:100%;object-fit:cover;border-radius:6px;border:1px solid var(--line);" });
        var rm = el("button", { type: "button", text: "\u00d7", style: "position:absolute;top:-7px;right:-7px;width:20px;height:20px;border-radius:50%;background:var(--bg-0);border:1px solid var(--line);color:var(--text-1);font-size:13px;line-height:1;cursor:pointer;" });
        rm.addEventListener("click", function () { imagesArr.splice(idx, 1); render(); if (onChange) onChange(); });
        tile.appendChild(img); tile.appendChild(rm);
        grid.appendChild(tile);
      });
      container.appendChild(grid);
      var fileInput = el("input", { type: "file", accept: "image/*", multiple: "multiple" });
      fileInput.addEventListener("change", function (e) {
        var total = e.target.files.length;
        queueFiles(e.target.files, function (file, next) {
          handleImageFile(file, function (dataUrl) { imagesArr.push(dataUrl); render(); if (onChange) onChange(); next(); });
        }).then(function () {
          if (total > 1) setStatus("Added " + total + " photos. Press Save Changes to publish.", "ok", 4000);
        });
      });
      var label = el("label", { class: "admin-file-btn", text: "+ Add Photos" }, [fileInput]);
      container.appendChild(label);
    }
    render();
  }

  /* ============================================================
     LOGIN
     ============================================================ */
  var loginScreen = document.getElementById("loginScreen");
  var adminShell = document.getElementById("adminShell");
  var loginForm = document.getElementById("loginForm");
  var loginError = document.getElementById("loginError");

  var dashboardShown = false;
  function showDashboard() {
    if (dashboardShown) return;
    dashboardShown = true;
    loginScreen.style.display = "none";
    adminShell.style.display = "flex";
    // always start from the newest saved version, so nothing recent gets overwritten
    AUKStore.refresh().then(function () {
      draft = AUKStore.getContent();
      document.documentElement.setAttribute("data-theme", AUKStore.getTheme());
      initDashboard();
      if (AUKStore.getMode() !== "server") showNotLiveGate();
    });
  }

  /* Blocks the whole dashboard behind an overlay until acknowledged, every time someone logs in
     while there is no server connected. This is the one thing that must never be missed: anything
     uploaded in this state lives only in this browser and can be lost (a wiped browser, a different
     device, clearing site data). Shown once per login, not just tucked into the Overview tab. */
  function showNotLiveGate() {
    var overlay = el("div", { class: "admin-gate" });
    var card = el("div", { class: "admin-gate__card" });
    card.appendChild(el("h2", { text: "\u26a0 This site is not connected to a server yet" }));
    card.appendChild(el("p", { text: "Nothing you upload or save right now leaves this browser. It is not on the internet, it will not survive clearing this browser's data, and no one else (including you, on another device) will see it. If you upload photos now expecting them to be live, you will lose them." }));
    card.appendChild(el("p", { text: "Deploy the site first (see READ-ME-FIRST.txt \u2014 GitHub + Netlify import is the reliable way), then open this Admin Panel on the deployed URL. The sidebar will say \"Live: saves reach every visitor\" once it's really connected." }));
    var label = el("label", { class: "admin-gate__ack" });
    var cb = el("input", { type: "checkbox" });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(" I understand this is preview-only and anything I add here can be lost"));
    card.appendChild(label);
    var btn = el("button", { class: "btn btn--primary", type: "button", text: "Continue in preview mode", disabled: "disabled" });
    cb.addEventListener("change", function () { btn.disabled = !cb.checked; });
    btn.addEventListener("click", function () { overlay.remove(); });
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  AUKStore.init().then(function () {
    if (AUKStore.isLoggedIn()) showDashboard();
  });

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var u = document.getElementById("loginUser").value.trim();
    var p = document.getElementById("loginPass").value;
    var btn = loginForm.querySelector("button[type=submit]");
    btn.disabled = true;
    AUKStore.init().then(function () { return AUKStore.login(u, p); }).then(function (ok) {
      if (ok) { loginError.classList.remove("is-visible"); showDashboard(); }
      else { loginError.textContent = "Incorrect username or password. Try again."; loginError.classList.add("is-visible"); }
    }).catch(function (err) {
      loginError.textContent = err.message || "Could not reach the login service.";
      loginError.classList.add("is-visible");
    }).then(function () { btn.disabled = false; });
  });

  document.getElementById("logoutBtn").addEventListener("click", function () {
    AUKStore.logout();
    window.location.reload();
  });

  /* ============================================================
     DASHBOARD INIT
     ============================================================ */
  function initDashboard() {
    initNav();
    initStatusPill();
    initOverviewExtras();
    initHeroSection();
    initStatsEditor();
    initFeaturedWorkEditor();
    initServiceCardsEditor();
    initDigitalTwinEditor();
    initTestimonialsEditor();
    initMarqueeEditor();
    initClosingCtaEditor();
    initAboutStory();
    initFactsEditor();
    initMilestonesEditor();
    initSkillsEditor();
    initExperienceEditor();
    initServicesEditor();
    initPortfolioEditor();
    initPublicationsEditor();
    initCertificationsEditor();
    initAwardsEditor();
    initContactEditor();
    initSiteTextEditor();
    initCategoriesEditor();
    initThemePicker();
    initSecurity();
    initResetAll();
  }

  function initNav() {
    var items = document.querySelectorAll(".admin-nav__item");
    items.forEach(function (btn) {
      btn.addEventListener("click", function () {
        items.forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        document.querySelectorAll(".admin-panel").forEach(function (p) { p.classList.remove("is-active"); });
        document.getElementById("panel-" + btn.getAttribute("data-panel")).classList.add("is-active");
        window.scrollTo(0, 0);
      });
    });
  }

  /* ---------- HERO ---------- */
  function initHeroSection() {
    var h = draft.hero;
    document.getElementById("prevHeroPortrait").src = h.portraitImage;
    document.getElementById("fileHeroPortrait").addEventListener("change", function (e) {
      handleImageFile(e.target.files[0], function (dataUrl) {
        h.portraitImage = dataUrl;
        document.getElementById("prevHeroPortrait").src = dataUrl;
      });
    });
    bindText("hEyebrow", h, "eyebrow");
    bindText("hPortraitTag", h, "portraitTag");
    bindText("hTitleLead", h, "titleLead");
    bindText("hTitleEm", h, "titleEm");
    bindText("hTitleRest", h, "titleRest");
    bindText("hTitleTail", h, "titleTail");
    bindTextArea("hTagline", h, "tagline");
    bindText("hPrimaryCta", h, "primaryCta");
    bindText("hSecondaryCta", h, "secondaryCta");

    document.querySelector('[data-save="home-hero"]').addEventListener("click", function () {
      commit("home-hero");
    });
  }
  function bindText(id, obj, key) {
    var i = document.getElementById(id);
    i.value = obj[key] || "";
    i.addEventListener("input", function () { obj[key] = i.value; });
  }
  function bindTextArea(id, obj, key) {
    var i = document.getElementById(id);
    i.value = obj[key] || "";
    i.addEventListener("input", function () { obj[key] = i.value; });
  }

  /* ---------- STATS ---------- */
  function initStatsEditor() {
    var container = document.getElementById("statsEditor");
    function render() {
      container.innerHTML = "";
      draft.stats.forEach(function (s, idx) {
        var wrap = el("div", { class: "admin-list-item" });
        wrap.appendChild(el("div", { class: "admin-list-item__tag", text: "Stat " + (idx + 1) }));
        var row = el("div", { class: "admin-grid-2" });
        row.appendChild(field("Value", numberInput(s.value, function (v) { s.value = v; s.decimals = (String(v).split(".")[1] || "").length; })));
        row.appendChild(field("Suffix (e.g. +, yrs)", textInput(s.suffix, function (v) { s.suffix = v; })));
        wrap.appendChild(row);
        wrap.appendChild(field("Label", textInput(s.label, function (v) { s.label = v; })));
        container.appendChild(wrap);
      });
    }
    render();
    document.querySelector('[data-save="home-stats"]').addEventListener("click", function () { commit("home-stats"); });
  }

  /* ---------- FEATURED WORK (home) ---------- */
  function initFeaturedWorkEditor() {
    var container = document.getElementById("featuredWorkEditor");
    function render() {
      container.innerHTML = "";
      draft.featuredWork.forEach(function (w, idx) {
        var wrap = el("div", { class: "admin-list-item" });
        var head = el("div", { class: "admin-list-item__head" }, [el("span", { class: "admin-list-item__tag", text: "Project " + (idx + 1) })]);
        var removeBtn = el("button", { type: "button", class: "admin-remove-btn", text: "Remove" });
        head.appendChild(moveButtons(draft.featuredWork, idx, render));
        removeBtn.addEventListener("click", function () { draft.featuredWork.splice(idx, 1); render(); });
        head.appendChild(removeBtn);
        wrap.appendChild(head);
        wrap.appendChild(imageUploadRow(w.image, false, function (dataUrl) { w.image = dataUrl; }));
        wrap.appendChild(field("Kicker label", textInput(w.kicker, function (v) { w.kicker = v; })));
        wrap.appendChild(field("Title", textInput(w.title, function (v) { w.title = v; })));
        container.appendChild(wrap);
      });
    }
    render();
    document.querySelector('[data-save="home-featured"]').addEventListener("click", function () { commit("home-featured"); });
  }

  /* ---------- DIGITAL TWIN LAYERS ---------- */
  function initDigitalTwinEditor() {
    var container = document.getElementById("digitalTwinEditor");
    var dt = draft.digitalTwin;
    container.appendChild(field("Section heading", textInput(dt.heading, function (v) { dt.heading = v; })));
    container.appendChild(field("Section subtext", textInput(dt.lede, function (v) { dt.lede = v; })));
    dt.layers.forEach(function (l, idx) {
      var wrap = el("div", { class: "admin-list-item" });
      wrap.appendChild(el("div", { class: "admin-list-item__tag", text: "Layer " + (idx + 1) }));
      wrap.appendChild(imageUploadRow(l.image, false, function (dataUrl) { l.image = dataUrl; }));
      wrap.appendChild(field("Step label", textInput(l.step, function (v) { l.step = v; })));
      wrap.appendChild(field("Title", textInput(l.title, function (v) { l.title = v; })));
      container.appendChild(wrap);
    });
    var featWrap = el("div", { class: "admin-list-item" });
    featWrap.appendChild(el("div", { class: "admin-list-item__tag", text: "Full Assembly Feature Panel" }));
    featWrap.appendChild(imageUploadRow(dt.feature.image, false, function (dataUrl) { dt.feature.image = dataUrl; }));
    featWrap.appendChild(field("Tag label", textInput(dt.feature.tag, function (v) { dt.feature.tag = v; })));
    featWrap.appendChild(field("Title", textInput(dt.feature.title, function (v) { dt.feature.title = v; })));
    container.appendChild(featWrap);

    document.querySelector('[data-save="home-twin"]').addEventListener("click", function () { commit("home-twin"); });
  }

  /* ---------- TESTIMONIALS ---------- */
  function initTestimonialsEditor() {
    var container = document.getElementById("testimonialsEditor");
    function render() {
      container.innerHTML = "";
      draft.testimonials.forEach(function (t, idx) {
        var wrap = el("div", { class: "admin-list-item" });
        var head = el("div", { class: "admin-list-item__head" }, [el("span", { class: "admin-list-item__tag", text: "Testimonial " + (idx + 1) })]);
        var removeBtn = el("button", { type: "button", class: "admin-remove-btn", text: "Remove" });
        head.appendChild(moveButtons(draft.testimonials, idx, render));
        removeBtn.addEventListener("click", function () { draft.testimonials.splice(idx, 1); render(); });
        head.appendChild(removeBtn);
        wrap.appendChild(head);
        wrap.appendChild(field("Quote", textArea(t.quote, function (v) { t.quote = v; })));
        var row = el("div", { class: "admin-grid-2" });
        row.appendChild(field("Attributed to", textInput(t.by, function (v) { t.by = v; })));
        row.appendChild(field("Organization", textInput(t.org, function (v) { t.org = v; })));
        wrap.appendChild(row);
        container.appendChild(wrap);
      });
    }
    render();
    document.querySelector('[data-save="home-testi"]').addEventListener("click", function () { commit("home-testi"); });
  }

  /* ---------- MARQUEE ---------- */
  function initMarqueeEditor() {
    var ta = document.getElementById("marqueeList");
    ta.value = draft.toolsMarquee.join("\n");
    document.querySelector('[data-save="home-marquee"]').addEventListener("click", function () {
      draft.toolsMarquee = ta.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      commit("home-marquee");
    });
  }

  /* ---------- CLOSING CTA ---------- */
  function initClosingCtaEditor() {
    bindText("ctaEyebrow", draft.closingCta, "eyebrow");
    bindText("ctaHeading", draft.closingCta, "heading");
    bindText("ctaButton", draft.closingCta, "buttonLabel");
    document.querySelector('[data-save="home-cta"]').addEventListener("click", function () { commit("home-cta"); });
  }

  /* ---------- ABOUT: STORY ---------- */
  function initAboutStory() {
    var a = draft.about;
    bindText("aHeading", a, "heading");
    while (a.story.length < 3) a.story.push("");
    var t1 = document.getElementById("aStory1"); t1.value = a.story[0] || ""; t1.addEventListener("input", function () { a.story[0] = t1.value; });
    var t2 = document.getElementById("aStory2"); t2.value = a.story[1] || ""; t2.addEventListener("input", function () { a.story[1] = t2.value; });
    var t3 = document.getElementById("aStory3"); t3.value = a.story[2] || ""; t3.addEventListener("input", function () { a.story[2] = t3.value; });
    var cvBox = el("div", { class: "field" }, [el("label", { text: "CV file for the Download CV button (PDF)" })]);
    cvBox.appendChild(fileUploadRow(a.cvFile, function (url) { a.cvFile = url; }));
    insertBeforeSaveRow("about-story", cvBox);
    document.querySelector('[data-save="about-story"]').addEventListener("click", function () { commit("about-story"); });
  }

  /* ---------- ABOUT: FACTS ---------- */
  function initFactsEditor() {
    var container = document.getElementById("factsEditor");
    draft.about.facts.forEach(function (f) {
      var row = el("div", { class: "admin-grid-2" });
      row.appendChild(field("Label", textInput(f.label, function (v) { f.label = v; })));
      row.appendChild(field("Value", textInput(f.value, function (v) { f.value = v; })));
      container.appendChild(row);
    });
    document.querySelector('[data-save="about-facts"]').addEventListener("click", function () { commit("about-facts"); });
  }

  /* ---------- ABOUT: MILESTONES ---------- */
  function initMilestonesEditor() {
    var container = document.getElementById("milestonesEditor");
    function render() {
      container.innerHTML = "";
      draft.about.milestones.forEach(function (m, idx) {
        var wrap = el("div", { class: "admin-list-item" });
        var head = el("div", { class: "admin-list-item__head" }, [el("span", { class: "admin-list-item__tag", text: "Milestone " + (idx + 1) })]);
        var removeBtn = el("button", { type: "button", class: "admin-remove-btn", text: "Remove" });
        head.appendChild(moveButtons(draft.about.milestones, idx, render));
        removeBtn.addEventListener("click", function () { draft.about.milestones.splice(idx, 1); render(); });
        head.appendChild(removeBtn);
        wrap.appendChild(head);
        var row = el("div", { class: "admin-grid-2" });
        row.appendChild(field("Year / date label", textInput(m.year, function (v) { m.year = v; })));
        row.appendChild(field("Title", textInput(m.title, function (v) { m.title = v; })));
        wrap.appendChild(row);
        wrap.appendChild(field("Description", textArea(m.desc, function (v) { m.desc = v; })));
        wrap.appendChild(checkboxRow(m.current, function (v) { m.current = v; }, "Mark as current / in-progress (highlighted in blue)"));
        container.appendChild(wrap);
      });
    }
    render();
    document.getElementById("addMilestoneBtn").addEventListener("click", function () {
      draft.about.milestones.push({ year: "", title: "New Milestone", desc: "", current: false });
      render();
    });
    document.querySelector('[data-save="about-milestones"]').addEventListener("click", function () { commit("about-milestones"); });
  }

  /* ---------- ABOUT: SKILLS ---------- */
  function initSkillsEditor() {
    var container = document.getElementById("skillsEditor");
    function render() {
      container.innerHTML = "";
      draft.about.skills.forEach(function (s, idx) {
        var wrap = el("div", { class: "admin-list-item" });
        var head = el("div", { class: "admin-list-item__head" }, [el("span", { class: "admin-list-item__tag", text: "Skill " + (idx + 1) })]);
        var removeBtn = el("button", { type: "button", class: "admin-remove-btn", text: "Remove" });
        head.appendChild(moveButtons(draft.about.skills, idx, render));
        removeBtn.addEventListener("click", function () { draft.about.skills.splice(idx, 1); render(); });
        head.appendChild(removeBtn);
        wrap.appendChild(head);
        var row = el("div", { class: "admin-grid-2" });
        row.appendChild(field("Skill name", textInput(s.name, function (v) { s.name = v; })));
        row.appendChild(field("Percent (0-100)", numberInput(s.pct, function (v) { s.pct = Math.max(0, Math.min(100, v)); }, 0, 100)));
        wrap.appendChild(row);
        container.appendChild(wrap);
      });
    }
    render();
    document.getElementById("addSkillBtn").addEventListener("click", function () {
      draft.about.skills.push({ name: "New Skill", pct: 50 });
      render();
    });
    document.querySelector('[data-save="about-skills"]').addEventListener("click", function () { commit("about-skills"); });
  }

  /* ---------- SERVICES (CRUD + deliverables + price) ---------- */
  function initServicesEditor() {
    var container = document.getElementById("servicesEditor");
    function render() {
      container.innerHTML = "";
      draft.services.forEach(function (s, idx) {
        var wrap = el("div", { class: "admin-list-item" });
        var head = el("div", { class: "admin-list-item__head" }, [el("span", { class: "admin-list-item__tag", text: "Service " + (idx + 1) })]);
        var removeBtn = el("button", { type: "button", class: "admin-remove-btn", text: "Remove" });
        head.appendChild(moveButtons(draft.services, idx, render));
        removeBtn.addEventListener("click", function () { draft.services.splice(idx, 1); render(); });
        head.appendChild(removeBtn);
        wrap.appendChild(head);
        wrap.appendChild(field("Title", textInput(s.title, function (v) { s.title = v; })));
        wrap.appendChild(field("Description", textArea(s.desc, function (v) { s.desc = v; })));

        var delWrap = el("div", { class: "field" }, [el("label", { text: "Deliverables (one per line)" })]);
        var delTa = el("textarea", {});
        delTa.style.minHeight = "90px";
        delTa.value = (s.deliverables || []).join("\n");
        delTa.addEventListener("input", function () {
          s.deliverables = delTa.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
        });
        delWrap.appendChild(delTa);
        wrap.appendChild(delWrap);

        var row = el("div", { class: "admin-grid-2" });
        row.appendChild(field("Price amount (e.g. $100)", textInput(s.priceAmount, function (v) { s.priceAmount = v; })));
        row.appendChild(field("Price unit (e.g. / project)", textInput(s.priceUnit, function (v) { s.priceUnit = v; })));
        wrap.appendChild(row);

        var colorField = el("div", { class: "field" }, [el("label", { text: "Accent color" })]);
        var sel = el("select", {});
        ["blue", "orange"].forEach(function (c) {
          var opt = el("option", { value: c, text: c === "blue" ? "Electric Blue" : "Vibrant Orange" });
          if (s.color === c) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener("change", function () { s.color = sel.value; });
        colorField.appendChild(sel);
        wrap.appendChild(colorField);

        container.appendChild(wrap);
      });
    }
    render();
    document.getElementById("addServiceBtn").addEventListener("click", function () {
      draft.services.push({ id: "svc-" + Date.now(), color: "blue", title: "New Service", desc: "", deliverables: [], priceAmount: "$0", priceUnit: "/ project" });
      render();
    });
    document.querySelector('[data-save="services"]').addEventListener("click", function () { commit("services"); });
  }

  /* ---------- PORTFOLIO (CRUD + image + category) ---------- */
  function initPortfolioEditor() {
    var container = document.getElementById("portfolioEditor");
    function render() {
      container.innerHTML = "";
      draft.portfolio.forEach(function (p, idx) {
        var wrap = el("div", { class: "admin-list-item" });
        var head = el("div", { class: "admin-list-item__head" }, [el("span", { class: "admin-list-item__tag", text: "Project " + (idx + 1) })]);
        var removeBtn = el("button", { type: "button", class: "admin-remove-btn", text: "Remove" });
        head.appendChild(moveButtons(draft.portfolio, idx, render));
        removeBtn.addEventListener("click", function () { draft.portfolio.splice(idx, 1); render(); });
        head.appendChild(removeBtn);
        wrap.appendChild(head);
        wrap.appendChild(imageUploadRow(p.image, false, function (dataUrl) { p.image = dataUrl; }));
        wrap.appendChild(field("Title", textInput(p.title, function (v) { p.title = v; })));
        wrap.appendChild(field("Kicker label", textInput(p.kicker, function (v) { p.kicker = v; })));
        wrap.appendChild(field("Description", textArea(p.desc, function (v) { p.desc = v; })));

        var catField = el("div", { class: "field" }, [el("label", { text: "Category" })]);
        var sel = el("select", {});
        (draft.portfolioCategories || []).map(function (k) { return [k.id, k.label]; }).forEach(function (pair) {
          var opt = el("option", { value: pair[0], text: pair[1] });
          if (p.category === pair[0]) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener("change", function () { p.category = sel.value; });
        catField.appendChild(sel);
        wrap.appendChild(catField);

        if (!p.gallery) p.gallery = [];
        var galField = el("div", { class: "field" }, [el("label", { text: "Extra photos for this project (shown in the lightbox)" })]);
        var galContainer = el("div", {});
        multiImageEditor(galContainer, p.gallery);
        galField.appendChild(galContainer);
        wrap.appendChild(galField);

        container.appendChild(wrap);
      });
    }
    render();
    renderPortfolioList = render;
    document.getElementById("addProjectBtn").addEventListener("click", function () {
      draft.portfolio.push({ id: "pf-" + Date.now(), category: ((draft.portfolioCategories || [])[0] || { id: "bim" }).id, kicker: "Project type", title: "New Project", desc: "", image: "images/placeholders/pf-bim-axo.svg", gallery: [] });
      render();
    });
    document.querySelector('[data-save="portfolio"]').addEventListener("click", function () { commit("portfolio"); });
  }

  /* ---------- AWARDS ---------- */
  function initAwardsEditor() {
    var container = document.getElementById("awardsEditor");
    function render() {
      container.innerHTML = "";
      draft.about.awards.forEach(function (a, idx) {
        var wrap = el("div", { class: "admin-list-item" });
        var head = el("div", { class: "admin-list-item__head" }, [el("span", { class: "admin-list-item__tag", text: "Award " + (idx + 1) })]);
        var removeBtn = el("button", { type: "button", class: "admin-remove-btn", text: "Remove" });
        head.appendChild(moveButtons(draft.about.awards, idx, render));
        removeBtn.addEventListener("click", function () { draft.about.awards.splice(idx, 1); render(); });
        head.appendChild(removeBtn);
        wrap.appendChild(head);
        wrap.appendChild(field("Title", textInput(a.title, function (v) { a.title = v; })));
        wrap.appendChild(field("Subtitle / detail", textInput(a.sub, function (v) { a.sub = v; })));
        container.appendChild(wrap);
      });
    }
    render();
    document.getElementById("addAwardBtn").addEventListener("click", function () {
      draft.about.awards.push({ title: "New Award", sub: "" });
      render();
    });
    document.querySelector('[data-save="awards"]').addEventListener("click", function () { commit("awards"); });
  }

  /* ---------- CONTACT ---------- */
  function initContactEditor() {
    var c = draft.contact;
    bindText("cHeading", c, "heading");
    bindTextArea("cLede", c, "lede");
    bindText("cEmail", c, "email");
    bindText("cWhatsapp", c, "whatsapp");
    bindText("cWhatsappLink", c, "whatsappLink");
    bindText("cAddress", c, "address");
    bindText("cLinkedin", c, "linkedin");
    bindText("cScholar", c, "scholar");
    var typesTa = textArea((c.projectTypes || []).join("\n"), function (v) {
      c.projectTypes = v.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    });
    typesTa.style.minHeight = "96px";
    insertBeforeSaveRow("contact", field("Contact form: project type choices (one per line)", typesTa));
    var hintP = el("p", { class: "hint", text: "Links can be typed without https://, for example linkedin.com/in/your-name. Leave a link empty to hide it from the site." });
    insertBeforeSaveRow("contact", hintP);
    document.querySelector('[data-save="contact"]').addEventListener("click", function () { commit("contact"); });
  }

  /* ---------- THEME ---------- */
  function initThemePicker() {
    var THEMES = [
      { id: "neon-green", name: "Neon Green", colors: ["#040807", "#35f5a0", "#ffb324"] },
      { id: "neon-cyan", name: "Neon Cyan", colors: ["#03070d", "#2ee3ff", "#ff5ad9"] },
      { id: "charcoal-orange", name: "Charcoal Orange", colors: ["#0a0c0f", "#ff5a1f", "#2fa8ff"] },
      { id: "midnight-blue", name: "Midnight Blue", colors: ["#070a14", "#3b82f6", "#22d3ee"] },
      { id: "slate-purple", name: "Slate Purple", colors: ["#0c0a13", "#a855f7", "#818cf8"] },
      { id: "emerald-dark", name: "Emerald Dark", colors: ["#090f0c", "#10b981", "#f59e0b"] }
    ];
    var grid = document.getElementById("themeGrid");
    var current = draft.theme || "neon-green";

    function render() {
      grid.innerHTML = "";
      THEMES.forEach(function (t) {
        var swatch = el("button", { type: "button", class: "theme-swatch" + (t.id === current ? " is-selected" : "") });
        var preview = el("div", { class: "theme-swatch__preview" });
        t.colors.forEach(function (c) { preview.appendChild(el("span", { class: "theme-swatch__dot", style: "background:" + c })); });
        swatch.appendChild(preview);
        swatch.appendChild(el("div", { class: "theme-swatch__name", text: t.name }));
        swatch.appendChild(el("div", { class: "theme-swatch__check", text: "\u2713 Active on live site" }));
        swatch.addEventListener("click", function () {
          current = t.id;
          draft.theme = t.id;
          document.documentElement.setAttribute("data-theme", t.id);
          render();
          commit(document.createElement("span"));   // the theme applies to the live site right away
        });
        grid.appendChild(swatch);
      });
    }
    render();
  }

  /* ---------- EXPERIENCE GALLERIES ---------- */
  function initExperienceEditor() {
    var container = document.getElementById("experienceEditor");
    function render() {
      container.innerHTML = "";
      draft.experienceGalleries.items.forEach(function (exp, idx) {
        var card = el("div", { class: "admin-section-card" });
        var head = el("div", { class: "admin-list-item__head", style: "margin-bottom:4px;" }, [el("h2", { text: exp.title, style: "margin:0;" })]);
        head.appendChild(moveButtons(draft.experienceGalleries.items, idx, render));
        card.appendChild(head);
        card.appendChild(el("p", { class: "hint", text: exp.subtitle }));
        var galContainer = el("div", { style: "margin-top:16px;" });
        if (!exp.images) exp.images = [];
        multiImageEditor(galContainer, exp.images);
        card.appendChild(galContainer);
        var saveRow = el("div", { class: "admin-save-row" });
        var saveBtn = el("button", { class: "btn btn--primary", text: "Save Changes" });
        var toastEl = el("span", { class: "admin-toast", text: "Saved \u00b7 live on your site" });
        saveBtn.addEventListener("click", function () { commit(toastEl); });
        saveRow.appendChild(saveBtn); saveRow.appendChild(toastEl);
        card.appendChild(saveRow);
        container.appendChild(card);
      });
    }
    render();
  }

  /* ---------- PUBLICATIONS ---------- */
  function initPublicationsEditor() {
    var p = draft.publications;
    bindText("pubHeadingInput", p, "heading");
    bindTextArea("pubLedeInput", p, "lede");
    bindText("pubScholarInput", p, "scholarLink");
    document.querySelector('[data-save="pub-meta"]').addEventListener("click", function () { commit("pub-meta"); });

    var container = document.getElementById("papersEditor");
    function render() {
      container.innerHTML = "";
      p.papers.forEach(function (paper, idx) {
        var wrap = el("div", { class: "admin-list-item" });
        var head = el("div", { class: "admin-list-item__head" }, [el("span", { class: "admin-list-item__tag", text: "Paper " + (idx + 1) })]);
        var removeBtn = el("button", { type: "button", class: "admin-remove-btn", text: "Remove" });
        head.appendChild(moveButtons(p.papers, idx, render));
        removeBtn.addEventListener("click", function () { p.papers.splice(idx, 1); render(); });
        head.appendChild(removeBtn);
        wrap.appendChild(head);
        wrap.appendChild(field("Title", textInput(paper.title, function (v) { paper.title = v; })));
        wrap.appendChild(field("Venue / journal", textInput(paper.venue, function (v) { paper.venue = v; })));
        wrap.appendChild(field("Description", textArea(paper.description, function (v) { paper.description = v; })));
        wrap.appendChild(field("Link (if published online)", textInput(paper.externalLink, function (v) { paper.externalLink = v; })));
        wrap.appendChild(el("label", { text: "Upload PDF" }));
        wrap.appendChild(fileUploadRow(paper.fileUrl, function (dataUrl) { paper.fileUrl = dataUrl; }));
        container.appendChild(wrap);
      });
    }
    render();
    document.getElementById("addPaperBtn").addEventListener("click", function () {
      p.papers.push({ title: "New Paper", venue: "", description: "", fileUrl: "", externalLink: "#" });
      render();
    });
    document.querySelector('[data-save="pub-papers"]').addEventListener("click", function () { commit("pub-papers"); });
  }

  /* ---------- CERTIFICATIONS ---------- */
  function initCertificationsEditor() {
    var c = draft.certifications;
    bindText("certHeadingInput", c, "heading");
    bindTextArea("certLedeInput", c, "lede");
    document.querySelector('[data-save="cert-meta"]').addEventListener("click", function () { commit("cert-meta"); });

    function buildGroup(containerId, arr, addBtnId, saveKey, defaultTitle) {
      var container = document.getElementById(containerId);
      function render() {
        container.innerHTML = "";
        arr.forEach(function (item, idx) {
          var wrap = el("div", { class: "admin-list-item" });
          var head = el("div", { class: "admin-list-item__head" }, [el("span", { class: "admin-list-item__tag", text: "#" + (idx + 1) })]);
          var removeBtn = el("button", { type: "button", class: "admin-remove-btn", text: "Remove" });
          head.appendChild(moveButtons(arr, idx, render));
          removeBtn.addEventListener("click", function () { arr.splice(idx, 1); render(); });
          head.appendChild(removeBtn);
          wrap.appendChild(head);
          var row = el("div", { class: "admin-grid-2" });
          row.appendChild(field("Title", textInput(item.title, function (v) { item.title = v; })));
          row.appendChild(field("Issuer", textInput(item.issuer, function (v) { item.issuer = v; })));
          wrap.appendChild(row);
          wrap.appendChild(field("Date (optional)", textInput(item.date, function (v) { item.date = v; })));
          wrap.appendChild(el("label", { text: "Upload Image or PDF" }));
          wrap.appendChild(fileUploadRow(item.fileUrl, function (dataUrl) { item.fileUrl = dataUrl; }));
          container.appendChild(wrap);
        });
      }
      render();
      document.getElementById(addBtnId).addEventListener("click", function () {
        arr.push({ title: defaultTitle, issuer: "", date: "", fileUrl: "" });
        render();
      });
      document.querySelector('[data-save="' + saveKey + '"]').addEventListener("click", function () { commit(saveKey); });
    }

    buildGroup("certJobEditor", c.jobExperience, "addCertJobBtn", "cert-job", "New Certificate");
    buildGroup("certAcademicEditor", c.academic, "addCertAcademicBtn", "cert-academic", "New Certificate");
    buildGroup("certScholarshipsEditor", c.scholarships, "addCertScholarshipBtn", "cert-scholarships", "New Scholarship");
  }

  /* ---------- SECURITY ---------- */
  function initSecurity() {
    var userInput = document.getElementById("secUser");
    if (AUKStore.getMode() === "server") userInput.placeholder = "Choose your login name";
    else userInput.value = "BIM Engineer";
    var btn = document.getElementById("saveCredsBtn");
    var err = document.getElementById("credsError");
    btn.addEventListener("click", function () {
      var u = userInput.value.trim();
      var p = document.getElementById("secPass").value;
      var p2 = document.getElementById("secPassConfirm").value;
      function fail(msg) { err.textContent = msg; err.classList.add("is-visible"); }
      if (!u || !p) return fail("Username and password can't be empty.");
      if (p.length < 6) return fail("Use at least 6 characters for the password.");
      if (p !== p2) return fail("Passwords do not match.");
      err.classList.remove("is-visible");
      AUKStore.setCredentials(u, p).then(function () {
        document.getElementById("secPass").value = "";
        document.getElementById("secPassConfirm").value = "";
        flash(document.getElementById("credsToast"), "Saved \u00b7 use the new login next time", false);
      }).catch(handleError);
    });
  }

  /* ---------- RESET ---------- */
  function initResetAll() {
    document.getElementById("resetAllBtn").addEventListener("click", function () {
      if (!window.confirm("This replaces everything on the live site with the original default content and theme. Continue?")) return;
      AUKStore.resetContent().then(function () { window.location.reload(); }).catch(handleError);
    });
  }

  /* ============================================================
     NEW EDITORS
     ============================================================ */
  function getPath(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function setPath(obj, path, val) {
    var keys = path.split("."), last = keys.pop();
    var o = keys.reduce(function (acc, k) { if (!acc[k] || typeof acc[k] !== "object") acc[k] = {}; return acc[k]; }, obj);
    o[last] = val;
  }

  /* Adds a titled card with its own Save button to an existing panel. */
  function addCard(panelId, opts) {
    var panel = document.getElementById("panel-" + panelId);
    var card = el("div", { class: "admin-section-card" });
    card.appendChild(el("h2", { text: opts.title }));
    if (opts.hint) card.appendChild(el("p", { class: "hint", text: opts.hint }));
    var body = el("div", {});
    card.appendChild(body);
    var row = el("div", { class: "admin-save-row" });
    var btn = el("button", { class: "btn btn--primary", type: "button", text: "Save Changes" });
    var t = el("span", { class: "admin-toast", text: "Saved" });
    btn.addEventListener("click", function () {
      if (opts.onSave) opts.onSave();
      commit(t).then(function (ok) { if (ok && opts.afterSave) opts.afterSave(); });
    });
    row.appendChild(btn); row.appendChild(t); card.appendChild(row);
    if (opts.top) panel.insertBefore(card, panel.children[1] || null); else panel.appendChild(card);
    return body;
  }

  function insertBeforeSaveRow(saveKey, node) {
    var btn = document.querySelector('[data-save="' + saveKey + '"]');
    var row = btn && btn.closest(".admin-save-row");
    if (row) row.parentNode.insertBefore(node, row);
  }

  /* ---------- Site & page text (brand, footer, every page heading) ---------- */
  function initSiteTextEditor() {
    var GROUPS = [
      { title: "Brand & footer", hint: "Shown in the top menu and the footer of every page.", fields: [
        ["site.brandFirst", "Name, first part"], ["site.brandLast", "Name, highlighted part"],
        ["site.footerTag", "Footer tagline", "area"], ["site.copyright", "Copyright line"] ] },
      { title: "Home page text", hint: "Section headings on the Home page.", fields: [
        ["pages.home.scrubHeading", "Video section heading"], ["pages.home.scrubLede", "Video section text", "area"],
        ["servicesTeaserHeading", "Services heading"], ["servicesTeaserLede", "Services text", "area"],
        ["pages.home.workHeading", "Featured work heading"], ["pages.home.workLede", "Featured work text", "area"],
        ["pages.home.workButton", "Featured work button label"], ["pages.home.testiHeading", "Testimonials heading"] ] },
      { title: "About page text", hint: "Section headings on the About page.", fields: [
        ["pages.about.eyebrow", "Small label above the page heading"],
        ["pages.about.milestonesHeading", "Milestones heading"], ["pages.about.milestonesLede", "Milestones text", "area"],
        ["pages.about.skillsHeading", "Skills heading"], ["pages.about.skillsLede", "Skills text", "area"],
        ["pages.about.awardsHeading", "Awards heading"], ["pages.about.awardsLede", "Awards text", "area"],
        ["experienceGalleries.heading", "Field experience heading"], ["experienceGalleries.lede", "Field experience text", "area"] ] },
      { title: "Services page text", fields: [
        ["pages.services.eyebrow", "Small label"], ["pages.services.heading", "Page heading"], ["pages.services.lede", "Intro text", "area"] ] },
      { title: "Projects page text", fields: [
        ["pages.projects.eyebrow", "Small label"], ["pages.projects.heading", "Page heading"],
        ["pages.projects.lede", "Intro text", "area"], ["pages.projects.allLabel", "Label of the show-everything filter"] ] },
      { title: "Credentials page text", fields: [
        ["pages.credentials.eyebrow", "Small label"], ["pages.credentials.scholarPrompt", "Text above the Google Scholar button"],
        ["pages.credentials.jobHeading", "Job experience group title"], ["pages.credentials.academicHeading", "Academic group title"],
        ["pages.credentials.scholarshipsHeading", "Scholarships group title"] ] }
    ];
    GROUPS.forEach(function (g) {
      var body = addCard("site", { title: g.title, hint: g.hint });
      g.fields.forEach(function (f) {
        var val = getPath(draft, f[0]);
        var input = f[2] === "area" ? textArea(val, function (v) { setPath(draft, f[0], v); }) : textInput(val, function (v) { setPath(draft, f[0], v); });
        body.appendChild(field(f[1], input));
      });
    });
  }

  /* ---------- Home: the four service cards ---------- */
  function initServiceCardsEditor() {
    var body = addCard("home", { title: "Services cards (Home page)", hint: "The short service cards under the services heading." });
    function render() {
      body.innerHTML = "";
      draft.serviceCards.forEach(function (c, idx) {
        var wrap = el("div", { class: "admin-list-item" });
        var head = el("div", { class: "admin-list-item__head" }, [el("span", { class: "admin-list-item__tag", text: "Card " + (idx + 1) })]);
        var rm = el("button", { type: "button", class: "admin-remove-btn", text: "Remove" });
        head.appendChild(moveButtons(draft.serviceCards, idx, render));
        rm.addEventListener("click", function () { draft.serviceCards.splice(idx, 1); render(); });
        head.appendChild(rm); wrap.appendChild(head);
        wrap.appendChild(field("Title", textInput(c.title, function (v) { c.title = v; })));
        wrap.appendChild(field("Description", textArea(c.desc, function (v) { c.desc = v; })));
        body.appendChild(wrap);
      });
      var add = el("button", { type: "button", class: "admin-add-btn", text: "+ Add Card" });
      add.addEventListener("click", function () { draft.serviceCards.push({ title: "New service", desc: "" }); render(); });
      body.appendChild(add);
    }
    render();
  }

  /* ---------- Portfolio: filter categories ---------- */
  function initCategoriesEditor() {
    var body = addCard("portfolio", {
      title: "Categories (filter tabs)", top: true,
      hint: "These become the filter tabs on the Projects page. Each project picks one of them below.",
      afterSave: function () { if (renderPortfolioList) renderPortfolioList(); }
    });
    function slug(t) { return (t || "cat").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat"; }
    function render() {
      body.innerHTML = "";
      draft.portfolioCategories.forEach(function (c, idx) {
        var row = el("div", { class: "admin-grid-2", style: "align-items:end;" });
        row.appendChild(field("Tab " + (idx + 1) + " label", textInput(c.label, function (v) { c.label = v; })));
        var btnWrap = el("div", { style: "display:flex;gap:8px;align-items:center;margin-bottom:18px;" });
        btnWrap.appendChild(moveButtons(draft.portfolioCategories, idx, render));
        var rm = el("button", { type: "button", class: "admin-remove-btn", text: "Remove" });
        rm.addEventListener("click", function () {
          if (draft.portfolioCategories.length < 2) { setStatus("Keep at least one category.", "warn", 3500); return; }
          var fallback = draft.portfolioCategories.filter(function (k) { return k !== c; })[0].id;
          draft.portfolio.forEach(function (p) { if (p.category === c.id) p.category = fallback; });
          draft.portfolioCategories.splice(idx, 1);
          render();
        });
        btnWrap.appendChild(rm);
        row.appendChild(btnWrap);
        body.appendChild(row);
      });
      var add = el("button", { type: "button", class: "admin-add-btn", text: "+ Add Category" });
      add.addEventListener("click", function () {
        var label = "New category", id = slug(label + "-" + Date.now().toString(36));
        draft.portfolioCategories.push({ id: id, label: label });
        render();
      });
      body.appendChild(add);
    }
    render();
  }

  /* ---------- Overview: connection status + one-time import ---------- */
  function initStatusPill() {
    var sub = document.querySelector(".admin-sidebar__sub");
    var live = AUKStore.getMode() === "server";
    var pill = el("div", { class: "admin-mode " + (live ? "admin-mode--live" : "admin-mode--local") },
      [el("i"), el("span", { text: live ? "Live: saves reach every visitor" : "Preview: saves stay in this browser" })]);
    sub.parentNode.insertBefore(pill, sub.nextSibling);

    if (!live) {
      var banner = el("div", { class: "admin-not-live-banner", role: "alert" }, [
        el("span", { text: "\u26a0 Preview only \u2014 nothing here is saved to the internet yet. Deploy the site first, or anything you upload can be lost." })
      ]);
      document.body.insertBefore(banner, document.body.firstChild);
      document.body.classList.add("has-not-live-banner");
    }
  }

  function externalizeMedia(root) {
    var jobs = [];
    (function walk(parent, key) {
      var v = parent[key];
      if (typeof v === "string" && v.indexOf("data:") === 0) {
        jobs.push(function () {
          return fetch(v).then(function (r) { return r.blob(); }).then(function (b) { return AUKStore.uploadFile(b); }).then(function (url) { parent[key] = url; });
        });
      } else if (v && typeof v === "object") {
        Object.keys(v).forEach(function (k) { walk(v, k); });
      }
    })({ root: root }, "root");
    return jobs.reduce(function (p, job) { return p.then(job); }, Promise.resolve());
  }

  function initOverviewExtras() {
    var host = document.getElementById("overviewExtras");
    if (!host) return;
    host.innerHTML = "";
    var mode = AUKStore.getMode();

    if (mode !== "server") {
      var warn = el("div", { class: "admin-notice" }, [
        el("h2", { text: "Preview mode: no server connected" }),
        el("p", { text: "This page could not reach the site's server, so saves stay in this browser only. That is normal when you open the files straight from your computer. Once the site is deployed on Netlify with the /api function (see READ-ME-FIRST.txt), the same panel saves for every visitor." })
      ]);
      host.appendChild(warn);
      return;
    }

    var legacy = AUKStore.getLegacyLocalContent();
    if (legacy && Object.keys(legacy).length) {
      var btn = el("button", { class: "btn btn--primary", type: "button", text: "Publish these edits to the live site" });
      var note = el("div", { class: "admin-notice" }, [
        el("h2", { text: "Edits found in this browser" }),
        el("p", { text: "You made changes here before the site had a server, and they only exist in this browser. Publish them so every visitor sees them. Photos are uploaded as files. Anything you have already saved on the live site will be replaced by these edits." }),
        btn
      ]);
      btn.addEventListener("click", function () {
        btn.disabled = true;
        setStatus("Uploading your saved photos and publishing...", "info");
        var merged = AUKStore.mergeWithDefaults(JSON.parse(JSON.stringify(legacy)));
        merged.theme = draft.theme || "neon-green";
        externalizeMedia(merged).then(function () { return AUKStore.saveContent(merged); }).then(function () {
          AUKStore.clearLegacyLocalContent();
          setStatus("Published. Reloading...", "ok");
          setTimeout(function () { window.location.reload(); }, 900);
        }).catch(function (e) { btn.disabled = false; handleError(e); });
      });
      host.appendChild(note);
    }
  }

})();
