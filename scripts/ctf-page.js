(function () {
  "use strict";
  var app = document.getElementById("ctf-app"),
    ctf = window.LozCTF;
  if (!app || !ctf) return;
  var form = document.getElementById("ctf-submit"),
    input = document.getElementById("ctf-answer"),
    feedback = document.getElementById("ctf-feedback");
  function render() {
    var state = ctf.snapshot();
    document.getElementById("ctf-count").textContent =
      state.count + " / " + state.total + " flags captured";
    app.querySelectorAll(".ctf-pixels i").forEach(function (node, i) {
      node.classList.toggle("captured", i < state.count);
    });
    state.checks.forEach(function (check) {
      var node = app.querySelector('[data-check="' + check.id + '"]');
      if (!node) return;
      node.classList.toggle("captured", check.solved);
      node.querySelector(".ctf-check").textContent = check.solved ? "✓" : "○";
      node.querySelector(".ctf-state").textContent = check.solved
        ? "Captured"
        : "Open";
    });
    state.groups.forEach(function (group) {
      var list = app.querySelector('[data-hints="' + group.id + '"]');
      list.replaceChildren();
      group.hints.forEach(function (hint) {
        var item = document.createElement("li");
        item.textContent = hint;
        list.appendChild(item);
      });
    });
    app.querySelectorAll("[data-badge]").forEach(function (node) {
      var id = node.dataset.badge,
        earned =
          id === "all"
            ? state.count === state.total
            : state.groups.some(function (g) {
                return g.id === id && g.complete;
              });
      var button = node.querySelector("button");
      if (!button.dataset.lockedLabel)
        button.dataset.lockedLabel = button.textContent;
      node.classList.toggle("earned", earned);
      button.disabled = !earned;
      button.textContent = earned
        ? "Download badge ↓"
        : button.dataset.lockedLabel;
    });
    document.getElementById("ctf-storage").textContent = state.persistent
      ? "Progress stays in this browser. No account needed."
      : "Browser storage is unavailable. Progress lasts for this visit only.";
  }
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (form.dataset.busy) return;
    form.dataset.busy = "true";
    var button = form.querySelector("button");
    button.disabled = true;
    feedback.textContent = "Checking…";
    try {
      var result = await ctf.submit(input.value);
      feedback.textContent = result.message;
      feedback.className = result.ok ? "accepted" : "";
      input.setAttribute("aria-invalid", result.ok ? "false" : "true");
      if (result.ok) input.value = "";
      render();
    } catch (_) {
      feedback.textContent = "Could not check that submission. Try again.";
      feedback.className = "";
    } finally {
      delete form.dataset.busy;
      button.disabled = false;
      input.focus();
    }
  });
  app.querySelectorAll("[data-hint]").forEach(function (button) {
    button.addEventListener("click", function () {
      feedback.textContent = ctf.hint(button.dataset.hint);
      feedback.className = "";
      render();
    });
  });
  app.querySelectorAll("[data-download]").forEach(function (button) {
    button.addEventListener("click", function () {
      var svg = ctf.badge(button.dataset.download);
      if (!svg) return;
      var url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })),
        link = document.createElement("a");
      link.href = url;
      link.download = "lozstokes-" + button.dataset.download + "-badge.svg";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
    });
  });
  var confirm = document.getElementById("ctf-reset-confirm");
  document.getElementById("ctf-reset").addEventListener("click", function () {
    confirm.hidden = false;
    document.getElementById("ctf-reset-no").focus();
  });
  document
    .getElementById("ctf-reset-no")
    .addEventListener("click", function () {
      confirm.hidden = true;
      document.getElementById("ctf-reset").focus();
    });
  document
    .getElementById("ctf-reset-yes")
    .addEventListener("click", function () {
      ctf.reset();
      confirm.hidden = true;
      feedback.textContent = "Progress reset. A fresh start.";
      feedback.className = "";
      render();
      document.getElementById("ctf-reset").focus();
    });
  window.addEventListener("loz:ctf-progress", render);
  window.addEventListener("storage", function (event) {
    if (event.key === "loz-ctf-v1" || event.key === null) render();
  });
  render();
  input.disabled = false;
  form.querySelector("button").disabled = false;
})();
