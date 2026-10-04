(function () {
  "use strict";
  function session() {
    return window.LozLab && window.LozLab.session;
  }
  function resize() {
    requestAnimationFrame(function () {
      var active = session();
      if (active) active.resize();
    });
  }
  var frame = document.getElementById("terminal-window");
  if (frame) {
    var mount = frame.parentElement,
      stack = frame.closest(".container"),
      minimised = mount.querySelector(".terminal-minimised"),
      expand = frame.querySelector('[data-terminal-action="expand"]'),
      restore = mount.querySelector('[data-terminal-action="restore"]'),
      expanded = false,
      previousFocus,
      previousScroll,
      inertNodes = [],
      previousOverflow;
    function blur() {
      var active = session();
      if (active && active.blur) active.blur();
    }
    function focus() {
      var active = session();
      if (active) active.focus();
    }
    function inertOutside() {
      for (
        var node = frame;
        node && node !== document.body;
        node = node.parentElement
      ) {
        Array.prototype.forEach.call(
          node.parentElement.children,
          function (sibling) {
            if (
              sibling === node ||
              sibling.tagName === "SCRIPT" ||
              sibling.tagName === "STYLE"
            )
              return;
            inertNodes.push({ node: sibling, value: sibling.inert });
            sibling.inert = true;
          },
        );
      }
    }
    function setExpanded(value, returnFocus) {
      if (expanded === value) return;
      if (value) {
        show(false);
        previousFocus = document.activeElement;
        previousScroll = { left: window.scrollX, top: window.scrollY };
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        frame.setAttribute("role", "dialog");
        frame.setAttribute("aria-modal", "true");
        inertOutside();
      } else {
        inertNodes.forEach(function (item) {
          item.node.inert = item.value;
        });
        inertNodes = [];
        document.body.style.overflow = previousOverflow;
        frame.removeAttribute("role");
        frame.removeAttribute("aria-modal");
      }
      expanded = value;
      if (stack) stack.classList.toggle("has-expanded-terminal", value);
      frame.classList.toggle("terminal-expanded", value);
      expand.setAttribute("aria-pressed", String(value));
      expand.setAttribute(
        "aria-label",
        value ? "Restore terminal size" : "Expand terminal",
      );
      expand.title = value ? "Restore terminal size" : "Expand terminal";
      if (value) expand.focus({ preventScroll: true });
      else {
        if (
          returnFocus !== false &&
          previousFocus &&
          previousFocus.isConnected &&
          !previousFocus.closest("[hidden]")
        )
          previousFocus.focus({ preventScroll: true });
        if (previousScroll)
          window.scrollTo({
            left: previousScroll.left,
            top: previousScroll.top,
            behavior: "instant",
          });
      }
      resize();
    }
    function show(activate) {
      frame.hidden = false;
      minimised.hidden = true;
      mount.classList.remove("is-minimised");
      resize();
      if (activate) focus();
    }
    function minimise() {
      setExpanded(false, false);
      blur();
      frame.hidden = true;
      minimised.hidden = false;
      mount.classList.add("is-minimised");
      restore.focus({ preventScroll: true });
    }
    mount.querySelectorAll("[data-terminal-action]").forEach(function (button) {
      button.hidden = false;
      button.addEventListener("click", function () {
        var action = button.dataset.terminalAction;
        if (action === "minimise") minimise();
        else if (action === "restore") show(true);
        else if (action === "expand") {
          blur();
          setExpanded(!expanded);
        }
      });
    });
    document.addEventListener(
      "keydown",
      function (event) {
        if (!expanded) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          blur();
          setExpanded(false);
        } else if (event.key === "Tab") {
          // The terminal group and its internal editor both receive native
          // completion keys. Escape leaves this editor and closes expansion.
          var editor = document.getElementById("meterpreter");
          if (editor && editor.contains(event.target)) return;
          var items = Array.prototype.filter.call(
            frame.querySelectorAll(
              'button, a[href], input, textarea, [tabindex="0"]',
            ),
            function (node) {
              return (
                !node.disabled &&
                node.tabIndex >= 0 &&
                !node.closest("[hidden]") &&
                node.getClientRects().length &&
                node.getAttribute("aria-hidden") !== "true"
              );
            },
          );
          if (!items.length) return;
          var first = items[0],
            last = items[items.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              !frame.contains(document.activeElement))
          ) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      },
      true,
    );
    window.LozTerminalWindow = {
      show: show,
      blur: blur,
      collapse: function () {
        setExpanded(false, false);
      },
      resize: resize,
      isMinimised: function () {
        return frame.hidden;
      },
    };
  }

  var launcher = document.querySelector(".lab-launcher");
  if (!launcher) return;
  var fallback = launcher.querySelector("[data-lab-launch]"),
    panel = launcher.querySelector(".lab-launcher-panel"),
    toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = fallback.className;
  toggle.setAttribute("data-lab-launch", "");
  while (fallback.firstChild) toggle.appendChild(fallback.firstChild);
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", panel.id);
  fallback.replaceWith(toggle);
  function close(returnFocus) {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener("click", function () {
    var opening = panel.hidden;
    panel.hidden = !opening;
    toggle.setAttribute("aria-expanded", String(opening));
    if (opening && window.LozTerminalWindow) window.LozTerminalWindow.blur();
  });
  launcher.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  });
  document.addEventListener("click", function (event) {
    if (!launcher.contains(event.target)) close(false);
  });
  launcher.addEventListener("focusout", function (event) {
    if (event.relatedTarget && !launcher.contains(event.relatedTarget))
      close(false);
  });
  panel.addEventListener("click", function (event) {
    var link = event.target.closest("[data-lab-destination]");
    if (
      !link ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    close(false);
    var destination = link.dataset.labDestination;
    if (window.LozWorkspace) {
      event.preventDefault();
      window.LozWorkspace.navigate(destination);
    } else if (
      destination === "terminal" &&
      frame &&
      !document.getElementById("lab-workspace")
    ) {
      event.preventDefault();
      window.LozTerminalWindow.show(true);
      frame.scrollIntoView({ block: "center", behavior: "instant" });
    }
  });
  function progress() {
    if (!window.LozCTF) return;
    var state = window.LozCTF.snapshot();
    launcher.querySelector("[data-lab-progress]").textContent =
      state.count + " / " + state.total + " flags";
  }
  window.addEventListener("loz:ctf-progress", progress);
  window.addEventListener("storage", function (event) {
    if (event.key === "loz-ctf-v1" || event.key === null) progress();
  });
  progress();
})();
