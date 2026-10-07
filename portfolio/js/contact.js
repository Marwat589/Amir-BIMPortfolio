/* ============================================================
   CONTACT FORM - validation + mailto composition
   ============================================================ */
(function () {
  "use strict";

  var form = document.getElementById("contactForm");
  if (!form) return;

  var status = document.getElementById("formStatus");

  function setError(field, hasError) {
    field.closest(".field").classList.toggle("field--error", hasError);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var name = form.elements["name"];
    var email = form.elements["email"];
    var projectType = form.elements["projectType"];
    var message = form.elements["message"];

    var valid = true;
    [name, email, projectType, message].forEach(function (f) { setError(f, false); });

    if (!name.value.trim()) { setError(name, true); valid = false; }
    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setError(email, true); valid = false; }
    if (!projectType.value) { setError(projectType, true); valid = false; }
    if (!message.value.trim()) { setError(message, true); valid = false; }

    if (!valid) {
      status.textContent = "Please fill in the highlighted fields before sending.";
      status.classList.add("is-visible");
      return;
    }

    var budget = form.elements["budget"] ? form.elements["budget"].value.trim() : "";
    var subject = "Project inquiry: " + projectType.value + " (from " + name.value.trim() + ")";
    var bodyLines = [
      "Name: " + name.value.trim(),
      "Email: " + email.value.trim(),
      "Project Type: " + projectType.value,
      "Budget / Timeline: " + (budget || "Not specified"),
      "",
      message.value.trim()
    ];
    var destEmail = (window.AUKStore ? AUKStore.getContent().contact.email : "iamirullah777@gmail.com");
    var mailto = "mailto:" + destEmail +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(bodyLines.join("\n"));

    window.location.href = mailto;

    status.textContent = "Opening your email app with this message pre-filled. Hit send there to reach me.";
    status.classList.add("is-visible");
  });

  form.querySelectorAll("input, select, textarea").forEach(function (el) {
    el.addEventListener("input", function () { setError(el, false); });
  });
})();
