/* ============================================================
   HOME PAGE INTERACTIVE EFFECTS
   Cursor-scrubbed build video + hero portrait tilt-on-cursor.
   Runs independently of content rendering (static DOM hooks).
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHoverFine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Cursor-scrub build video ---------- */
  function initScrub() {
    var panel = document.getElementById("scrubPanel");
    var video = document.getElementById("scrubVideo");
    var dot = document.getElementById("scrubDot");
    var progressFill = document.getElementById("scrubProgress");
    if (!panel || !video) return;

    var duration = 0;
    video.addEventListener("loadedmetadata", function () { duration = video.duration || 0; });

    if (reduceMotion) return; // keep the ambient autoplay loop only; skip pointer scrubbing

    if (!canHoverFine) {
      // Touch devices: let it autoplay; allow touch-drag scrub as a bonus, no cursor dot.
      panel.addEventListener("touchmove", function (e) {
        if (!duration) return;
        var t = e.touches[0];
        var rect = panel.getBoundingClientRect();
        var frac = Math.min(Math.max((t.clientX - rect.left) / rect.width, 0), 1);
        video.pause();
        video.currentTime = frac * duration;
        progressFill.style.width = (frac * 100) + "%";
      }, { passive: true });
      panel.addEventListener("touchend", function () { video.play(); });
      return;
    }

    function setFrac(clientX) {
      var rect = panel.getBoundingClientRect();
      var frac = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      if (duration) video.currentTime = frac * duration;
      progressFill.style.width = (frac * 100) + "%";
      dot.style.left = (frac * 100) + "%";
      dot.style.top = "50%";
    }

    panel.addEventListener("mouseenter", function () {
      panel.classList.add("is-engaged");
      video.pause();
    });
    panel.addEventListener("mousemove", function (e) {
      setFrac(e.clientX);
      var rect = panel.getBoundingClientRect();
      dot.style.top = ((e.clientY - rect.top) / rect.height * 100) + "%";
    });
    panel.addEventListener("mouseleave", function () {
      panel.classList.remove("is-engaged");
      video.play();
    });
  }

  /* ---------- Hero portrait cursor tilt ---------- */
  function initHeroTilt() {
    if (!canHoverFine || reduceMotion) return;
    var portrait = document.getElementById("heroPortrait");
    if (!portrait) return;
    portrait.addEventListener("mousemove", function (e) {
      var rect = portrait.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width - 0.5;
      var py = (e.clientY - rect.top) / rect.height - 0.5;
      portrait.style.setProperty("--tiltY", (px * 10).toFixed(2) + "deg");
      portrait.style.setProperty("--tiltX", (-py * 10).toFixed(2) + "deg");
    });
    portrait.addEventListener("mouseleave", function () {
      portrait.style.setProperty("--tiltX", "0deg");
      portrait.style.setProperty("--tiltY", "0deg");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initScrub();
    initHeroTilt();
  });
  if (document.readyState !== "loading") { initScrub(); initHeroTilt(); }
})();
