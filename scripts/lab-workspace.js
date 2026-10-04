(function () {
  "use strict";
  var workspace = document.getElementById("lab-workspace"),
    ctf = window.LozCTF;
  if (!workspace || !ctf) return;
  var work = document.getElementById("lab-work"),
    casePanel = document.getElementById("lab-case-panel"),
    rewards = document.getElementById("lab-rewards-panel"),
    feedback = document.getElementById("lab-workspace-feedback"),
    form = document.getElementById("lab-submit"),
    answer = document.getElementById("lab-answer"),
    resultLine = document.getElementById("lab-feedback"),
    evidence = document.getElementById("lab-evidence-list"),
    discovered = Object.create(null),
    caseOpened = false,
    caseOpening = false,
    view;
  function session() {
    return window.LozLab && window.LozLab.session;
  }
  function terminalWindow() {
    return window.LozTerminalWindow;
  }
  function renderProgress() {
    var state = ctf.snapshot();
    workspace.querySelectorAll("[data-lab-progress]").forEach(function (node) {
      node.textContent = state.count + " / " + state.total + " flags";
    });
    document.getElementById("lab-reward-count").textContent =
      state.count + " / " + state.total;
    var caseCount = 0,
      caseTotal = 0;
    state.checks.forEach(function (check) {
      if (check.group === "open-door") {
        caseTotal += check.units;
        if (check.solved) caseCount += check.units;
      }
      var node = workspace.querySelector('[data-lab-check="' + check.id + '"]');
      if (!node) return;
      node.classList.toggle("captured", check.solved);
      node.querySelector(".lab-check-symbol").textContent = check.solved
        ? "✓"
        : "○";
      node.querySelector(".lab-check-status").textContent = check.solved
        ? "Captured"
        : "Open";
    });
    document.getElementById("lab-case-count").textContent =
      caseCount + " / " + caseTotal + " flags recovered";
    workspace.querySelectorAll("[data-lab-badge]").forEach(function (node) {
      var id = node.dataset.labBadge,
        earned =
          id === "all"
            ? state.count === state.total
            : state.groups.some(function (group) {
                return group.id === id && group.complete;
              }),
        button = node.querySelector("button");
      if (!button.dataset.lockedLabel)
        button.dataset.lockedLabel = button.textContent;
      node.classList.toggle("earned", earned);
      button.disabled = !earned;
      button.textContent = earned
        ? "Download badge ↓"
        : button.dataset.lockedLabel;
    });
    document.getElementById("lab-storage").textContent = state.persistent
      ? "Progress stays in this browser and is shared with the Challenges page. No account needed."
      : "Browser storage is unavailable. Progress lasts for this visit only.";
  }
  function run(command) {
    var active = session();
    if (!active)
      return Promise.reject(new Error("Terminal is still connecting."));
    return Promise.resolve(active.run(command));
  }
  function openCase() {
    if (caseOpened || caseOpening || view !== "case" || !session()) return;
    caseOpening = true;
    feedback.textContent = "";
    run("case")
      .catch(function () {
        feedback.textContent =
          "Could not open the case. Type case in the terminal to try again.";
      })
      .finally(function () {
        caseOpening = false;
        if (!caseOpened && view === "case" && !feedback.textContent)
          feedback.textContent =
            "The case has not opened. Select an active session in the terminal, then reopen Case files.";
      });
  }
  function selectedView() {
    var value = new URL(window.location.href).searchParams.get("view");
    return ["terminal", "case", "rewards"].indexOf(value) === -1
      ? "case"
      : value;
  }
  function setView(next, focus) {
    if (["terminal", "case", "rewards"].indexOf(next) === -1) next = "case";
    var controls = terminalWindow(),
      previousView = view;
    if (controls) {
      controls.collapse();
      controls.blur();
    }
    view = next;
    workspace.dataset.view = view;
    work.hidden = view === "rewards";
    casePanel.hidden = view !== "case";
    rewards.hidden = view !== "rewards";
    work.classList.toggle("has-case", view === "case");
    workspace
      .querySelectorAll(".lab-dock [data-lab-view]")
      .forEach(function (link) {
        if (link.dataset.labView === view)
          link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    if (view !== "rewards" && controls) {
      // Changing panes leaves the existing terminal, output and working directory intact.
      if (focus || previousView === "rewards") controls.show(false);
      controls.resize();
    }
    openCase();
    if (focus) {
      if (view === "terminal" && controls) controls.show(true);
      else
        document
          .getElementById(
            view === "rewards" ? "lab-rewards-title" : "lab-case-title",
          )
          .focus({ preventScroll: true });
    }
  }
  function navigate(next) {
    var url = new URL(window.location.href);
    if (selectedView() !== next) {
      url.searchParams.set("view", next);
      url.hash = "";
      window.history.pushState(null, "", url.href);
    }
    setView(next, true);
  }
  window.LozWorkspace = { navigate: navigate };
  workspace.addEventListener("click", function (event) {
    var link = event.target.closest("[data-lab-view]");
    if (
      !link ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(link.dataset.labView);
  });
  window.addEventListener("popstate", function () {
    setView(selectedView(), true);
  });
  window.addEventListener("loz:terminal-ready", function () {
    openCase();
    if (
      view === "rewards" ||
      (terminalWindow() && terminalWindow().isMinimised())
    )
      session().blur();
  });
  window.addEventListener("loz:case-evidence", function (event) {
    var path = event.detail && event.detail.path;
    if (
      typeof path !== "string" ||
      path.indexOf(ctf.caseRoot + "/") !== 0 ||
      !Object.prototype.hasOwnProperty.call(ctf.files, path)
    )
      return;
    if (path === ctf.caseRoot + "/brief.txt") {
      caseOpened = true;
      feedback.textContent = "";
    }
    if (discovered[path]) return;
    discovered[path] = true;
    var item = document.createElement("li"),
      button = document.createElement("button");
    button.type = "button";
    button.textContent = path.slice(ctf.caseRoot.length + 1);
    button.title = "Read " + button.textContent + " again";
    button.addEventListener("click", function () {
      // The shell has no escapes inside quotes. Select a delimiter absent from this known path.
      var quote =
        path.indexOf('"') === -1 ? '"' : path.indexOf("'") === -1 ? "'" : null;
      if (!quote) return;
      if (terminalWindow()) terminalWindow().show(true);
      run("cat " + quote + path + quote).catch(function () {
        feedback.textContent =
          "Could not reopen that file. Try reading it in the terminal.";
      });
    });
    item.appendChild(button);
    evidence.appendChild(item);
    document.getElementById("lab-evidence-empty").hidden = true;
  });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (form.dataset.busy) return;
    form.dataset.busy = "true";
    var button = form.querySelector("button"),
      startedInForm = form.contains(document.activeElement),
      focusMoved = false;
    function trackFocus(event) {
      // Disabling the submit button can move focus to body without user action.
      if (event.type === "focusin" && event.target === document.body) return;
      if (!form.contains(event.target)) focusMoved = true;
    }
    document.addEventListener("focusin", trackFocus, true);
    document.addEventListener("pointerdown", trackFocus, true);
    button.disabled = true;
    resultLine.textContent = "Checking…";
    resultLine.className = "";
    try {
      var result = await ctf.submit(answer.value);
      resultLine.textContent = result.message;
      resultLine.className = result.ok ? "accepted" : "";
      answer.setAttribute("aria-invalid", result.ok ? "false" : "true");
      if (result.ok) answer.value = "";
      renderProgress();
    } catch (_) {
      resultLine.textContent = "Could not check that submission. Try again.";
    } finally {
      document.removeEventListener("focusin", trackFocus, true);
      document.removeEventListener("pointerdown", trackFocus, true);
      delete form.dataset.busy;
      button.disabled = false;
      if (
        view === "rewards" &&
        startedInForm &&
        !focusMoved &&
        (document.activeElement === document.body ||
          form.contains(document.activeElement))
      )
        answer.focus();
    }
  });
  workspace.querySelectorAll("[data-lab-download]").forEach(function (button) {
    button.addEventListener("click", function () {
      try {
        var svg = ctf.badge(button.dataset.labDownload);
        if (!svg) return;
        var url = URL.createObjectURL(
            new Blob([svg], { type: "image/svg+xml" }),
          ),
          link = document.createElement("a");
        link.href = url;
        link.download =
          "lozstokes-" + button.dataset.labDownload + "-badge.svg";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
      } catch (_) {
        resultLine.textContent =
          "Could not download the badge. Please try again.";
      }
    });
  });
  window.addEventListener("loz:ctf-progress", renderProgress);
  window.addEventListener("storage", function (event) {
    if (event.key === "loz-ctf-v1" || event.key === null) renderProgress();
  });
  renderProgress();
  setView(selectedView(), false);
  answer.disabled = false;
  form.querySelector("button").disabled = false;
})();
