/* ============================================================
   SITE DATA LAYER  (v2, server-backed)
   Single source of truth for every editable piece of content.

   LIVE MODE  (deployed on Netlify with the /api function)
     Content is stored on the server, so an Admin save is seen by
     every visitor on every device. Uploaded photos and PDFs are
     stored as separate files and referenced by URL.

   LOCAL MODE (opening the files directly / no server)
     Falls back to this browser's localStorage so you can still
     preview edits offline. Only that browser sees them.
   ============================================================ */
(function (global) {
  "use strict";

  var CACHE_KEY = "auk:cache:v2";       // last content received from the server (instant first paint)
  var THEME_KEY = "auk:theme:v2";       // read by the tiny inline script in every <head>
  var LOCAL_KEY = "auk:content:v1";     // OLD local edits, read-only here (one-time import into the server)
  var IDB_KEY = "auk:content:v2";       // CURRENT local/preview-mode edits, held in IndexedDB (room for hundreds of photos)
  var TOKEN_KEY = "auk:token:v2";
  var LOCAL_SESSION = "auk:session:v1";
  var LOCAL_AUTH = "auk:credentials:v1";
  var DEFAULT_LOCAL_CREDENTIALS = { username: "BIM Engineer", password: "TUM@123" };

  var DEFAULT_CONTENT = {
    theme: "neon-green",

    site: {
      brandFirst: "Amir Ullah",
      brandLast: "Khan",
      footerTag: "Civil Engineer & BIM Engineer, based in Pakistan, available for on-site and remote engagements.",
      copyright: "\u00a9 2026 Amir Ullah Khan. All rights reserved."
    },

    pages: {
      home: {
        scrubHeading: "Watch a model come together.",
        scrubLede: "Move your cursor across the frame to scrub through a 2D drawing becoming a fully coordinated 3D BIM model.",
        workHeading: "A few structures I\u2019ve helped model and build.",
        workLede: "Selected work spanning BIM coordination, structural QA/QC, and research-grade FEM modeling.",
        workButton: "View Full Portfolio",
        testiHeading: "What teams say after working with me."
      },
      about: {
        eyebrow: "About",
        milestonesHeading: "Milestones along the way.",
        milestonesLede: "From graduation to the field, to the model, to the next degree.",
        skillsHeading: "Core skills, measured honestly.",
        skillsLede: "Where I'm strongest today, and where I'm still building depth.",
        awardsHeading: "Awards & achievements.",
        awardsLede: "Recognition along the way, from university through research."
      },
      services: {
        eyebrow: "Services",
        heading: "BIM modeling and coordination, done to spec.",
        lede: "Core services covering architectural modeling, structural modeling, and cross-discipline clash detection, each delivered to full LOD and ISO 19650 information standards."
      },
      projects: {
        eyebrow: "Portfolio",
        heading: "Selected work across BIM, structure, and site.",
        lede: "Projects spanning 3D BIM modeling, structural analysis, and site engineering & QA/QC. Filter by discipline or browse everything.",
        allLabel: "All Work"
      },
      credentials: {
        eyebrow: "Research",
        scholarPrompt: "See the full record, citations, and metrics on Google Scholar.",
        jobHeading: "Job Experience Certificates",
        academicHeading: "Academic Certificates",
        scholarshipsHeading: "Scholarships"
      }
    },

    serviceCards: [
      { title: "3D BIM Modeling", desc: "Federated architectural and structural models in Revit, built to LOD spec and ISO 19650 information standards." },
      { title: "Structural Analysis", desc: "Modeling and verification in ETABS, SAFE, and SAP2000, from gravity systems to full seismic checks." },
      { title: "Site Coordination & QC", desc: "Field QA/QC, material testing, and contractor coordination to keep execution aligned with design intent." },
      { title: "Clash Detection", desc: "Navisworks-driven coordination that catches conflicts between disciplines before they reach the field." }
    ],

    portfolioCategories: [
      { id: "bim", label: "BIM & 3D Modeling" },
      { id: "structural", label: "Structural Analysis" },
      { id: "site", label: "Site Engineering & QA/QC" }
    ],
    hero: {
      eyebrow: "Civil Engineer & BIM Engineer",
      titleLead: "Amir Ullah Khan",
      titleRest: "builds",
      titleEm: "digital twins",
      titleTail: "of the structures you rely on.",
      tagline: "Transforming complex structures into precise digital twin models across BIM coordination, structural analysis, and on-site quality control.",
      primaryCta: "View My Projects",
      secondaryCta: "Get in Touch",
      portraitImage: "images/placeholders/hero-portrait.svg",
      portraitTag: "Available for new projects"
    },

    digitalTwin: {
      heading: "One building, modeled in every layer.",
      lede: "From bare frame to finished facade, this is what a coordinated BIM workflow actually looks like.",
      layers: [
        { step: "Layer 01 \u00b7 Structure", title: "Reinforced concrete frame, columns & stair core", image: "images/digital-twin/structure-frame.jpg" },
        { step: "Layer 02 \u00b7 MEP", title: "HVAC, electrical & plumbing coordination", image: "images/digital-twin/mep-systems.jpg" },
        { step: "Layer 03 \u00b7 Facade", title: "Architectural cladding & exterior shell", image: "images/digital-twin/facade-complete.jpg" }
      ],
      feature: { tag: "Full Assembly \u00b7 Digital Twin", title: "Every layer traced back to a single coordinated model.", image: "images/digital-twin/exploded-assembly.jpg" }
    },

    stats: [
      { value: 10, decimals: 0, suffix: "+", label: "Major projects completed (architecture & structure)" },
      { value: 2, decimals: 0, suffix: "+", label: "Years combined industry experience" },
      { value: 1.5, decimals: 1, suffix: " yrs", label: "Site engineering expertise" },
      { value: 1, decimals: 0, suffix: "+ yr", label: "BIM & 3D modeling specialization" }
    ],

    servicesTeaserHeading: "Where I add the most value on site.",
    servicesTeaserLede: "Four disciplines, one coordinated workflow, from first model to final clash report.",

    featuredWork: [
      { id: "fw1", kicker: "Revit \u00b7 BIM Coordination", title: "Mumbai Tower B: Residential BIM Model", image: "images/placeholders/work-mumbai.svg", gallery: [] },
      { id: "fw2", kicker: "ETABS \u00b7 Structural Coordination", title: "Dera Ismail Khan Flyover: Pile Cap & Girder Works", image: "images/placeholders/work-flyover.svg", gallery: [] },
      { id: "fw3", kicker: "QA/QC \u00b7 Diaphragm Wall", title: "Jeddah Airport Sewage Plant: Panel Verticality & Testing", image: "images/placeholders/work-jeddah.svg", gallery: [] },
      { id: "fw4", kicker: "FEM \u00b7 AI Research", title: "Interstate I-40 Bridge: AI Damage Detection Model", image: "images/placeholders/work-i40.svg", gallery: [] }
    ],

    testimonials: [
      { quote: "Amir caught clash issues between MEP and structure before they ever reached the field. That saved us real time on-site.", by: "Project Director", org: "Design & Build Firm" },
      { quote: "His QA/QC documentation on the diaphragm wall works was some of the most precise I\u2019ve reviewed on a foundation package.", by: "Site Consultant", org: "Infrastructure Project" },
      { quote: "Amir moves easily between hand calculations and full BIM coordination. That range is rare this early in a career.", by: "Supervising Engineer", org: "Structural Design Team" }
    ],

    toolsMarquee: ["Autodesk Revit", "Navisworks", "Synchro 4D", "AutoCAD", "ETABS", "SAFE", "SAP2000", "Tekla Structures", "Primavera P6", "Robot Structural Analysis"],

    closingCta: { eyebrow: "Let\u2019s build something precise", heading: "Ready to collaborate on your next structure?", buttonLabel: "Get in Touch" },

    services: [
      {
        id: "svc-arch",
        color: "blue",
        title: "Architectural BIM Modeling",
        desc: "Creation of detailed 3D architectural building information models from 2D CAD drafts and sketches, using Autodesk Revit, complete with floor plans, elevations, and 3D views.",
        deliverables: [
          "Full 3D Revit model built from your 2D drawings",
          "Coordinated floor plans, elevations & sections",
          "Rendered 3D views for design review",
          "Editable native Revit (.rvt) file handover"
        ],
        priceAmount: "$100",
        priceUnit: "/ project"
      },
      {
        id: "svc-struct",
        color: "orange",
        title: "Structural BIM Modeling",
        desc: "High-accuracy 3D modeling of structural elements, including concrete framing, beams, columns, slabs, and rebar details, aligned with architectural geometry using Autodesk Revit Structure.",
        deliverables: [
          "Framing, beams, columns & slabs modeled to LOD spec",
          "Rebar detailing aligned to structural drawings",
          "Model aligned & linked to architectural geometry",
          "Structural schedules & quantity takeoffs"
        ],
        priceAmount: "$120",
        priceUnit: "/ project"
      },
      {
        id: "svc-clash",
        color: "blue",
        title: "Navisworks Clash Detection",
        desc: "Comprehensive interdisciplinary model coordination, hard and soft clash identification, matrix setup, and conflict resolution reports using Navisworks Manage to ensure a buildable, collision-free design.",
        deliverables: [
          "Federated multi-discipline model coordination",
          "Hard & soft clash identification with test matrix",
          "Prioritized conflict resolution report",
          "Buildable, collision-free sign-off model"
        ],
        priceAmount: "$80",
        priceUnit: "/ model set"
      }
    ],

    portfolio: [
      { id: "pf1", category: "bim", kicker: "BIM & 3D Modeling \u00b7 Revit", title: "Mumbai Tower B: Residential BIM Model", desc: "Modeled walls, doors, windows, columns, floors, roofs, stairs, and railings; extracted schedules and sheets.", image: "images/placeholders/pf-bim-axo.svg", gallery: [] },
      { id: "pf2", category: "bim", kicker: "BIM & 3D Modeling \u00b7 Revit", title: "NLC Flyover: Piling & Girder BIM Coordination", desc: "Developed precise 3D structural models for pile caps and girder works to full LOD specification.", image: "images/placeholders/pf-bim-axo.svg", gallery: [] },
      { id: "pf3", category: "bim", kicker: "BIM & 3D Modeling \u00b7 Navisworks", title: "Multi-Discipline Clash Detection Report", desc: "Executed clash detection in Navisworks to proactively identify and resolve design conflicts.", image: "images/placeholders/pf-bim-clash.svg", gallery: [] },
      { id: "pf4", category: "bim", kicker: "BIM & 3D Modeling \u00b7 ISO 19650", title: "As-Built Drawing Package: ISO 19650 Compliance", desc: "Generated and managed 2D drawings with standardized naming conventions across disciplines.", image: "images/placeholders/pf-bim-asbuilt.svg", gallery: [] },
      { id: "pf5", category: "structural", kicker: "Structural Analysis \u00b7 ETABS / SAFE", title: "15-Story Building: ETABS Structural Model", desc: "Designed and analyzed a 15-story building system using ETABS, SAFE, and SAP2000.", image: "images/placeholders/pf-structural-frame.svg", gallery: [] },
      { id: "pf6", category: "structural", kicker: "Structural Analysis \u00b7 Design", title: "Four-Story Building: Gravity & Seismic Design", desc: "Performed structural analysis and design, improving stability and reducing material cost by 8.3%.", image: "images/placeholders/pf-structural-frame.svg", gallery: [] },
      { id: "pf7", category: "structural", kicker: "Structural Analysis \u00b7 FEM / AI Research", title: "I-40 Bridge: AI-Based Damage Detection Model", desc: "Built a validated 3D FEM model integrating AI to simulate and localize structural damage.", image: "images/placeholders/pf-structural-fem.svg", gallery: [] },
      { id: "pf8", category: "structural", kicker: "Structural Analysis \u00b7 STAAD Pro", title: "Industrial Steel Warehouse Design", desc: "Completed comprehensive structural design for an industrial steel warehouse, end to end.", image: "images/placeholders/pf-structural-warehouse.svg", gallery: [] },
      { id: "pf9", category: "site", kicker: "Site Engineering & QA/QC", title: "Jeddah Airport Sewage Plant: Diaphragm Wall QA/QC", desc: "Performed QA/QC on a 100m-deep diaphragm wall, handling DPRs, MIRs, and site audits.", image: "images/placeholders/pf-site-qc.svg", gallery: [] },
      { id: "pf10", category: "site", kicker: "Site Engineering & QA/QC", title: "Bentonite & Koden Shape Testing: Panel Verticality", desc: "Conducted bentonite, Koden shape, and concrete testing to verify construction quality.", image: "images/placeholders/pf-site-qc.svg", gallery: [] },
      { id: "pf11", category: "site", kicker: "Site Engineering & QA/QC", title: "Dera Ismail Khan Flyover: Site Supervision", desc: "Coordinated with client and consultant on WIRs, DPRs, and execution compliance.", image: "images/placeholders/pf-site-supervision.svg", gallery: [] },
      { id: "pf12", category: "site", kicker: "Site Engineering & QA/QC", title: "Progress Tracking Dashboard: Primavera P6 & Power BI", desc: "Built interactive dashboards for project performance, scheduling, and weekly reporting.", image: "images/placeholders/pf-site-dashboard.svg", gallery: [] }
    ],

    about: {
      heading: "From site execution to precise digital coordination.",
      story: [
        "I graduated with a Bachelor of Science in Civil Engineering from Ghulam Ishaq Khan Institute (GIKI) in 2024, earning Dean's Honor Roll distinctions and placing 1st in our Final Year Project on intelligent bridge health monitoring.",
        "I began my career as a Site Engineer, gaining hands-on ground experience supervising complex geotechnical projects, including 100-meter deep diaphragm wall quality control for an international airport sewage treatment plant.",
        "Recognizing the massive transformation happening in digital construction, I transitioned into Building Information Modeling (BIM). What sets me apart is my ability to bridge field execution reality with precise 3D digital coordination, ensuring designs are not just visually impressive, but fully constructible, clash-free, and structural-code compliant."
      ],
      facts: [
        { label: "Based in", value: "Dera Ismail Khan, Pakistan" },
        { label: "Focus", value: "BIM & Structural Engineering" },
        { label: "Experience", value: "2+ years, site & BIM" },
        { label: "Education", value: "BSc GIKI \u00b7 MSc TUM" },
        { label: "Languages", value: "English, Urdu, Pashto" }
      ],
      cvFile: "assets/Amir-Ullah-Khan-CV.pdf",
      milestones: [
        { year: "2024", title: "Graduated from GIKI", desc: "Completed a BS in Civil Engineering with Dean's Honor Roll distinctions and 1st Place in the Final Year Project, backed by a PEC Research Grant.", current: false },
        { year: "2024 \u2013 2026", title: "Site Engineer Experience", desc: "Supervised field quality control and execution on high-depth diaphragm wall panels and infrastructure projects across Saudi Arabia and Pakistan.", current: false },
        { year: "2025 \u2013 Present", title: "Specialization in BIM & Structural Analysis", desc: "Mastered 3D architectural and structural modeling, clash detection, and finite element analysis across live coordination projects.", current: false },
        { year: "Winter 2026/27", title: "Master's Candidate at TUM", desc: "Enrolled in the M.Sc. Civil Engineering program at the Technical University of Munich, specializing in BIM & Construction Management.", current: true }
      ],
      skills: [
        { name: "3D BIM Architecture Modeling (Autodesk Revit)", pct: 90 },
        { name: "3D BIM Structure Modeling (Autodesk Revit)", pct: 90 },
        { name: "Clash Detection (Navisworks)", pct: 85 },
        { name: "Site Supervision & Quality Control", pct: 90 },
        { name: "Technical Drafting (AutoCAD & ReCap Pro)", pct: 60 }
      ],
      awards: [
        { title: "1st Place, Final Year Project", sub: "Bridge Health Monitoring" },
        { title: "Dean's Honor List", sub: "3 Semesters, GIKI" },
        { title: "Scholarship Award", sub: "Ghulam Ishaq Khan Institute" },
        { title: "PEC Research Grant", sub: "100,000 PKR" }
      ]
    },

    contact: {
      heading: "Have a project, a coordination problem, or a role in mind? Let\u2019s talk.",
      lede: "Whether you\u2019re a client, a collaborator, or a recruiter, I\u2019m open to BIM modeling work, clash detection and coordination, or structural engineering consulting. Reach out directly or use the form.",
      email: "iamirullah777@gmail.com",
      whatsapp: "+92 347 0895288",
      whatsappLink: "https://wa.me/923470895288",
      linkedin: "#",
      scholar: "#",
      address: "Hanif Town, Dera Ismail Khan, Pakistan",
      projectTypes: ["Architectural BIM Modeling", "Structural BIM Modeling", "Clash Detection & Coordination", "General Inquiry"]
    },

    publications: {
      heading: "Research & Publications",
      lede: "Published research in structural health monitoring, alongside my day-to-day BIM and site work.",
      scholarLink: "#",
      papers: [
        {
          title: "Damage Detection in Steel Bridges Using Modal Strain Energy and Improved \u03b2-Index Method",
          venue: "Elsevier, Results in Engineering (Q1, Impact Factor 7.9)",
          description: "A quantitative severity-prediction method for steel bridge damage using a Modal Strain Energy-based Damage Index.",
          fileUrl: "",
          externalLink: "#"
        },
        {
          title: "Integration of Modal Strain Energy-Based Damage Index and Artificial Neural Networks for Damage Severity Prediction in Single-Span Steel Bridges",
          venue: "Fusion Journal",
          description: "Combines a Modal Strain Energy-based Damage Index with ANN models to predict damage severity in single-span steel bridges.",
          fileUrl: "",
          externalLink: "#"
        }
      ]
    },

    certifications: {
      heading: "Certifications & Credentials",
      lede: "Training, academic credentials, and scholarships, organized so anyone reviewing my background can verify them at a glance.",
      jobExperience: [
        { title: "Autodesk Certified Professional: Revit for Structural Design", issuer: "Coursera", date: "", fileUrl: "" },
        { title: "Primavera P6 & Power BI Training", issuer: "", date: "", fileUrl: "" }
      ],
      academic: [
        { title: "BSc Civil Engineering", issuer: "Ghulam Ishaq Khan Institute (GIKI)", date: "2020 \u2013 2024", fileUrl: "" },
        { title: "Design of a 15-Story Building", issuer: "Udemy", date: "", fileUrl: "" },
        { title: "Industrial Steel Warehouse Design From A to Z", issuer: "Udemy", date: "", fileUrl: "" }
      ],
      scholarships: [
        { title: "Scholarship Award", issuer: "Ghulam Ishaq Khan Institute (GIKI)", date: "", fileUrl: "" },
        { title: "PEC Research Grant", issuer: "100,000 PKR", date: "", fileUrl: "" },
        { title: "TU Munich Tuition Fee Waiver (Erlassstipendium)", issuer: "Technical University of Munich", date: "Winter 2026/27", fileUrl: "" }
      ]
    },

    experienceGalleries: {
      heading: "Field experience, in pictures.",
      lede: "Photos from the roles behind the résumé, on-site and in the model.",
      items: [
        {
          id: "exp-ksa",
          title: "QA/QC Civil Engineer",
          subtitle: "Ammico International \u00b7 Jeddah & Madina, Saudi Arabia",
          images: []
        },
        {
          id: "exp-dikhan",
          title: "Site Engineer, Dera Ismail Khan Flyover",
          subtitle: "NLC (National Logistic Cell) \u00b7 Dera Ismail Khan, Pakistan",
          images: []
        },
        {
          id: "exp-bim",
          title: "BIM Engineer",
          subtitle: "Gyrfalcon Design & Build / MH BIMElite Services \u00b7 Dubai",
          images: []
        }
      ]
    }
  };

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function deepMerge(base, override) {
    if (Array.isArray(base)) return Array.isArray(override) ? override : base;
    if (typeof base !== "object" || base === null) return override !== undefined && override !== null ? override : base;
    var out = {};
    Object.keys(base).forEach(function (k) {
      out[k] = deepMerge(base[k], override ? override[k] : undefined);
    });
    if (override && typeof override === "object") {
      Object.keys(override).forEach(function (k) {
        if (!(k in out)) out[k] = override[k];
      });
    }
    return out;
  }

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  /* IndexedDB holds the local/preview-mode content when there is no server yet. Browsers give it
     hundreds of MB to several GB (vs. ~5-10MB for localStorage), which is what "no space for more
     pictures" was hitting. Objects are stored as-is (no JSON stringify needed). */
  var idbHandle = null;
  function idbOpen() {
    if (idbHandle) return idbHandle;
    idbHandle = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("indexedDB unavailable")); return; }
      var req = indexedDB.open("auk-portfolio", 1);
      req.onupgradeneeded = function () { req.result.createObjectStore("kv"); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("could not open storage")); };
    });
    return idbHandle;
  }
  function idbGet(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var rq = db.transaction("kv", "readonly").objectStore("kv").get(key);
        rq.onsuccess = function () { resolve(rq.result === undefined ? null : rq.result); };
        rq.onerror = function () { reject(rq.error); };
      });
    }).catch(function () { return null; });
  }
  function idbSet(key, val) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(val, key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error("could not write storage")); };
      });
    });
  }

  function timeoutFetch(url, opts, ms) {
    opts = opts || {};
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 6000) : null;
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (r) { if (timer) clearTimeout(timer); return r; },
                                 function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  var override = safeParse(lsGet(CACHE_KEY), null);   // what the server (or local mode) says
  var mode = "unknown";                                // "server" | "local"
  var initPromise = null;
  var lastSignature = JSON.stringify(override);

  var Store = {
    /* ---------- reading ---------- */
    getContent: function () {
      return override ? deepMerge(deepClone(DEFAULT_CONTENT), override) : deepClone(DEFAULT_CONTENT);
    },
    getDefaultContent: function () { return deepClone(DEFAULT_CONTENT); },
    mergeWithDefaults: function (o) { return deepMerge(deepClone(DEFAULT_CONTENT), o); },
    getTheme: function () {
      var t = Store.getContent().theme;
      return t || "neon-green";
    },
    hasCache: function () { return !!lsGet(CACHE_KEY); },
    getMode: function () { return mode; },

    /* Ask the server for the latest content. Resolves with the mode. */
    refresh: function () {
      return timeoutFetch("/api/content", { cache: "no-store" }, 6000)
        .then(function (res) {
          if (!res.ok) throw new Error("no api");
          return res.json();
        })
        .then(function (data) {
          if (!data || typeof data !== "object" || !("content" in data)) throw new Error("no api");
          mode = "server";
          override = data.content || null;
          lsSet(CACHE_KEY, JSON.stringify(override));
          Store._syncTheme();
          Store._emitIfChanged();
          return mode;
        })
        .catch(function () {
          mode = "local";
          return idbGet(IDB_KEY).then(function (v) {
            override = v != null ? v : (override || safeParse(lsGet(LOCAL_KEY), null));
            Store._syncTheme();
            Store._emitIfChanged();
            return mode;
          });
        });
    },
    init: function () {
      if (!initPromise) initPromise = Store.refresh();
      return initPromise;
    },

    _syncTheme: function () {
      var t = Store.getContent().theme;
      if (t) lsSet(THEME_KEY, t);
    },
    _emitIfChanged: function () {
      var sig = JSON.stringify(override);
      if (sig !== lastSignature) { lastSignature = sig; Store._notify(); }
    },

    /* ---------- writing (admin only) ---------- */
    saveContent: function (content) {
      if (mode === "server") {
        return Store._authFetch("/api/content", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(content)
        }).then(function () {
          override = deepClone(content);
          lsSet(CACHE_KEY, JSON.stringify(override));
          Store._syncTheme();
          lastSignature = JSON.stringify(override);
          Store._notify();
          return { where: "server" };
        });
      }
      return idbSet(IDB_KEY, content).then(function () {
        override = deepClone(content);
        Store._syncTheme();
        lastSignature = JSON.stringify(override);
        Store._notify();
        return { where: "local" };
      }).catch(function () {
        // Very old browser with no IndexedDB: fall back to localStorage as a last resort.
        var ok = lsSet(LOCAL_KEY, JSON.stringify(content));
        if (!ok) throw new Error("This browser can't store that many photos in preview mode. Deploying the site (see READ-ME-FIRST.txt) removes this limit, since photos are then stored on the server instead of the browser.");
        override = deepClone(content);
        Store._syncTheme();
        lastSignature = JSON.stringify(override);
        Store._notify();
        return { where: "local" };
      });
    },

    /* Local edits made before the server existed (for the one-time import) */
    getLegacyLocalContent: function () { return safeParse(lsGet(LOCAL_KEY), null); },
    clearLegacyLocalContent: function () { lsDel(LOCAL_KEY); },

    resetContent: function () {
      var defaults = Store.getDefaultContent();
      return Store.saveContent(defaults);
    },

    /* Upload an image Blob or a PDF File. Resolves with a URL. */
    uploadFile: function (blob) {
      if (mode === "server") {
        return Store._authFetch("/api/media", {
          method: "POST",
          headers: { "content-type": blob.type || "application/octet-stream" },
          body: blob
        }).then(function (res) { return res.json(); }).then(function (data) { return data.url; });
      }
      return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onload = function () { resolve(r.result); };
        r.onerror = function () { reject(new Error("Could not read that file.")); };
        r.readAsDataURL(blob);
      });
    },

    /* ---------- auth ---------- */
    isLoggedIn: function () {
      if (mode === "server") return !!ssGet(TOKEN_KEY);
      return ssGet(LOCAL_SESSION) === "1";
    },
    login: function (username, password) {
      if (mode === "server") {
        return timeoutFetch("/api/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: username, password: password })
        }, 10000).then(function (res) {
          if (res.status === 401) return false;
          if (!res.ok) throw new Error("Login service is unavailable. Try again in a moment.");
          return res.json().then(function (d) { ssSet(TOKEN_KEY, d.token); return true; });
        });
      }
      var creds = safeParse(lsGet(LOCAL_AUTH), DEFAULT_LOCAL_CREDENTIALS);
      var ok = username === creds.username && password === creds.password;
      if (ok) ssSet(LOCAL_SESSION, "1");
      return Promise.resolve(ok);
    },
    logout: function () { ssDel(TOKEN_KEY); ssDel(LOCAL_SESSION); },
    setCredentials: function (username, password) {
      if (mode === "server") {
        return Store._authFetch("/api/credentials", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: username, password: password })
        });
      }
      lsSet(LOCAL_AUTH, JSON.stringify({ username: username, password: password }));
      return Promise.resolve();
    },

    _authFetch: function (url, opts) {
      opts = opts || {};
      opts.headers = opts.headers || {};
      opts.headers["authorization"] = "Bearer " + (ssGet(TOKEN_KEY) || "");
      return timeoutFetch(url, opts, 60000).then(function (res) {
        if (res.status === 401) {
          ssDel(TOKEN_KEY);
          var e = new Error("Your login expired. Please log in again.");
          e.code = "auth";
          throw e;
        }
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (d) {
            throw new Error(d.error || ("Server responded with " + res.status));
          });
        }
        return res;
      });
    },

    /* ---------- change notifications ---------- */
    version: 0,
    _listeners: [],
    onChange: function (fn) { Store._listeners.push(fn); },
    _notify: function () {
      Store.version++;
      Store._listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    }
  };

  /* Another tab saved something: pick it up. */
  window.addEventListener("storage", function (e) {
    if (e.key === CACHE_KEY || e.key === LOCAL_KEY) {
      override = safeParse(lsGet(e.key), override);
      Store._emitIfChanged();
    }
  });
  /* Coming back to a tab: check the server for newer content (public pages only). */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && mode === "server" && !document.getElementById("adminShell")) Store.refresh();
  });

  global.AUKStore = Store;
})(window);
