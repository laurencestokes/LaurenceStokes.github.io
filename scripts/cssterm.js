/* CSSTerm presentation, with the site's original Typed.js and jQuery Terminal. */
(function (window, $) {
  "use strict";
  var unavailable = "Unavailable";
  function visitorInfo(onChange) {
    var ua = navigator.userAgent;
    var browser =
      ua.match(/(Edg|OPR)\/([\d.]+)/) ||
      ua.match(/(Firefox|Chrome|Version)\/([\d.]+)/);
    var os = /Windows/.test(ua)
      ? "Windows"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod/.test(ua)
          ? "iOS"
          : /Mac/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : unavailable;
    var info = {
      ip: "Looking up…",
      local: "Looking up…",
      location: "Looking up…",
      provider: "Looking up…",
      device: /Mobile|Android|iPhone|iPad/.test(ua)
        ? "Mobile / Tablet"
        : "Computer/Laptop",
      os: os,
      browser: browser
        ? ({ Edg: "Microsoft Edge", OPR: "Opera", Version: "Safari" }[
            browser[1]
          ] || browser[1]) +
          " " +
          browser[2]
        : unavailable,
      screen: screen.width + " x " + screen.height,
    };
    // Keep the existing lookup provider. It is independent of the intro timeline.
    var xhr = new XMLHttpRequest();
    function failed() {
      info.ip = info.location = info.provider = unavailable;
      onChange(info);
    }
    xhr.open("GET", "https://ipinfo.io/json", true);
    xhr.timeout = 4500;
    xhr.onload = function () {
      if (xhr.status !== 200) {
        failed();
        return;
      }
      try {
        var data = JSON.parse(xhr.responseText);
        info.ip =
          typeof data.ip === "string" && /^[a-f\d.:]+$/i.test(data.ip)
            ? data.ip
            : unavailable;
        info.location =
          [data.city, data.region, data.country]
            .filter(function (value) {
              return typeof value === "string" && value;
            })
            .join(", ") || unavailable;
        info.provider = typeof data.org === "string" ? data.org : unavailable;
        onChange(info);
      } catch (_) {
        failed();
      }
    };
    xhr.onerror = xhr.ontimeout = xhr.onabort = failed;
    try {
      xhr.send();
    } catch (_) {
      failed();
    }
    // Modern browsers may hide the local address behind mDNS; never invent one.
    var Peer = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    var peer, timeout;
    function closePeer() {
      clearTimeout(timeout);
      if (peer) {
        peer.onicecandidate = null;
        peer.close();
        peer = null;
      }
      if (info.local === "Looking up…")
        info.local = "Unavailable (browser privacy)";
      onChange(info);
    }
    if (Peer) {
      try {
        peer = new Peer({ iceServers: [] });
        peer.createDataChannel("local-address");
        peer.onicecandidate = function (event) {
          if (!event.candidate) {
            closePeer();
            return;
          }
          var parts = event.candidate.candidate.split(" "),
            address = parts[4];
          if (
            parts[7] === "host" &&
            address &&
            /^[a-f\d.:]+$/i.test(address) &&
            address !== "0.0.0.0"
          ) {
            info.local = address;
            closePeer();
          }
        };
        timeout = setTimeout(closePeer, 3000);
        peer
          .createOffer()
          .then(function (offer) {
            if (peer) return peer.setLocalDescription(offer);
          })
          .catch(closePeer);
      } catch (_) {
        closePeer();
      }
    } else {
      info.local = "Unavailable (browser privacy)";
    }
    return info;
  }
  window.LozLab = {
    start: function (originalFiles) {
      var frame = document.getElementById("terminal-window");
      if (!frame || frame.dataset.initialized) return;
      frame.dataset.initialized = "true";
      var boot = document.getElementById("terminal-intro");
      var host = document.getElementById("meterpreter");
      var control = document.getElementById("intro-control");
      var status = document.getElementById("terminal-status");
      var reduced = matchMedia("(prefers-reduced-motion: reduce)");
      var timer,
        typer,
        generation = 0,
        booting = false,
        terminal,
        leaving = false;
      var content = JSON.parse(
        document.getElementById("lab-content").textContent,
      );
      function refresh(info) {
        boot.querySelectorAll("[data-visitor]").forEach(function (node) {
          if (!node.closest("[data-typing]"))
            node.textContent = info[node.dataset.visitor];
        });
      }
      var visitor = visitorInfo(refresh);
      var shell = new window.LozShell(
        content,
        visitor,
        originalFiles,
        window.LozCTF,
      );
      var openCase =
        new URLSearchParams(window.location.search).get("case") === "open-door";
      function row(text, className) {
        var node = document.createElement("p");
        node.className = className || "";
        node.textContent = text;
        boot.appendChild(node);
        return node;
      }
      function command(prefix, text, className) {
        var node = row("", className),
          label = document.createElement("span"),
          target = document.createElement("span");
        label.textContent = prefix;
        label.className =
          className === "root-command" ? "term-red" : "term-label";
        target.textContent = text;
        target.dataset.command = text;
        target.className = "term-green";
        node.append(label, target);
        return node;
      }
      function data(label, key) {
        var node = row(""),
          name = document.createElement("span"),
          value = document.createElement("span");
        name.className = "term-label";
        name.textContent = label + ": ";
        value.dataset.visitor = key;
        value.textContent = visitor[key];
        node.append(name, value);
        return node;
      }
      function transcript() {
        boot.replaceChildren();
        command("[root@localhost]# ", "msfconsole", "root-command");
        row("Target identified...", "stage term-yellow");
        data("Interogating Public IPv4 Address", "ip");
        data("Interogating Local Address", "local");
        data("Location", "location");
        data("Internet Provider", "provider");
        data("Device", "device");
        data("Operating System", "os");
        data("Browser", "browser");
        data("Screen Size", "screen");
        command("msf exploit(web_delivery) > ", "exploit", "stage");
        [
          "Handler binding to LHOST 192.168.0.1:89",
          "Started reverse handler",
          "Triggering the vulnerability...",
          "Transmitting intermediate stager for over-sized stage...(191 bytes)",
          "Sending stage (2650 bytes)",
          "Sleeping before handling stage...",
          "Uploading DLL (75787 bytes)...",
          "Upload completed.",
        ].forEach(function (text) {
          var node = row("");
          var marker = document.createElement("span");
          marker.className = "term-cyan";
          marker.textContent = "[*] ";
          node.append(marker, document.createTextNode(text));
        });
        var session = row(
          "[*] Meterpreter session 1 opened (192.168.0.1:89 -> ",
          "session-open",
        );
        var endpoint = document.createElement("span");
        endpoint.dataset.visitor = "ip";
        endpoint.textContent = visitor.ip;
        session.append(endpoint, document.createTextNode(":89)"));
        command("msf exploit(web_delivery) > ", "sessions -i 1", "stage");
        row("[*] Starting interaction with 1...", "term-cyan");
        return Array.from(boot.children);
      }
      function stop() {
        generation++;
        clearTimeout(timer);
        if (typer) {
          typer.stop = true;
          typer.reset();
          typer = null;
        }
        boot
          .querySelectorAll(".typed-cursor,.transfer")
          .forEach(function (node) {
            node.remove();
          });
      }
      function update() {
        terminal.set_prompt(shell.prompt());
        frame.dataset.state = shell.connected() ? "connected" : "closed";
        status.textContent = shell.status();
      }
      function ready() {
        booting = false;
        host.hidden = false;
        shell.reconnect();
        if (!terminal) {
          terminal = $(host).terminal(
            function (input) {
              var term = this;
              var display = shell.isSubmission(input)
                ? "submit [answer]"
                : input;
              term.echo($.terminal.escape_brackets(shell.prompt() + display));
              var output = shell.execute(input, this.history().data());
              function print(value) {
                if (value === null) {
                  term.clear();
                  boot.hidden = true;
                } else if (value) term.echo($.terminal.escape_brackets(value));
                update();
              }
              if (output && typeof output.then === "function") {
                term.pause();
                control.disabled = true;
                output
                  .then(print, function () {
                    print("Could not check that submission. Try again.");
                  })
                  .finally(function () {
                    control.disabled = false;
                    term.resume();
                  });
              } else print(output);
            },
            {
              greetings:
                "GNU bash, version 4.3.42(5)-release (x86_64). Type 'help' to see available commands.",
              name: "loz_lab",
              prompt: shell.prompt(),
              enabled: false,
              exit: false,
              historySize: 100,
              historyFilter: function (input) {
                return !shell.isSubmission(input);
              },
              outputLimit: 250,
              convertLinks: false,
              echoCommand: false,
              completion: function (input, callback) {
                callback(shell.complete(this.before_cursor(false)));
              },
              onClear: function () {
                boot.hidden = true;
              },
              keydown: function (event) {
                if (event.key === "Escape") {
                  leaving = true;
                  terminal.disable();
                  host.focus();
                  leaving = false;
                  return false;
                }
              },
            },
          );
          $(host).find("textarea").attr({
            tabindex: -1,
            "aria-label": "Terminal command input",
            "aria-describedby": "terminal-help",
          });
          $(host).find("iframe").attr({
            tabindex: -1,
            "aria-hidden": "true",
            title: "Terminal resize sensor",
          });
          $(host)
            .find(".terminal-output")
            .attr({ role: "log", "aria-live": "polite" });
          // jQuery Terminal owns editing, history and completion. Escape releases focus.
          host.addEventListener("focus", function () {
            if (!booting && !leaving) terminal.enable();
          });
          if (document.fonts)
            document.fonts.ready.then(function () {
              terminal.resize();
            });
        }
        terminal.resize();
        update();
        control.textContent = "Replay intro ↻";
        control.setAttribute("aria-label", "Replay terminal intro");
        if (openCase) {
          openCase = false;
          boot.hidden = true;
          terminal.exec("case");
        }
      }
      function settle() {
        stop();
        transcript();
        ready();
      }
      function intro() {
        stop();
        booting = true;
        boot.hidden = false;
        host.hidden = true;
        if (terminal) terminal.disable();
        frame.dataset.state = "connecting";
        status.textContent = "INITIALIZING MSFCONSOLE";
        control.textContent = "Skip intro ↠";
        control.setAttribute("aria-label", "Skip terminal intro");
        if (reduced.matches) {
          settle();
          return;
        }
        var rows = transcript(),
          run = generation;
        rows.forEach(function (node) {
          node.style.visibility = "hidden";
        });
        var pauses = [
          500, 800, 500, 400, 300, 350, 250, 350, 300, 450, 850, 1000, 1200,
          1200, 1600, 900, 1600, 2400, 750, 1200, 850, 650,
        ];
        var stages = {
          1: "TARGET IDENTIFIED",
          11: "BINDING HANDLER · TCP/89",
          12: "REVERSE HANDLER STARTED",
          14: "DELIVERING STAGER",
          17: "UPLOADING PAYLOAD",
          19: "SESSION 1 · OPEN",
          21: "ATTACHING TO SESSION 1",
        };
        function next(index) {
          if (run !== generation) return;
          if (index === rows.length) {
            ready();
            return;
          }
          var node = rows[index],
            target = node.querySelector("[data-command]");
          var isVisitor = index >= 1 && index <= 9;
          node.style.visibility = "visible";
          if (stages[index]) status.textContent = stages[index];
          function advance() {
            if (run === generation)
              timer = setTimeout(function () {
                next(index + 1);
              }, pauses[index]);
          }
          if (target || isVisitor) {
            target = target || node;
            refresh(visitor);
            // Visitor values were inserted as text. Keep their escaped markup,
            // and escape Typed.js pause markers so provider data stays literal.
            var text = isVisitor
              ? target.innerHTML.replace(/\^/g, "&#94;")
              : target.dataset.command;
            if (isVisitor)
              target.style.minHeight =
                target.getBoundingClientRect().height + "px";
            target.dataset.typing = "true";
            target.textContent = "";
            target.id = "intro-typed-text";
            Typed.new("#intro-typed-text", {
              strings: [text],
              typeSpeed: isVisitor ? 0 : 35,
              contentType: isVisitor ? "html" : "text",
              showCursor: true,
              cursorChar: "▌",
              callback: function () {
                if (run !== generation) return;
                if (typer && typer.cursor) typer.cursor.remove();
                typer = null;
                target.removeAttribute("id");
                target.removeAttribute("data-typing");
                target.style.removeProperty("min-height");
                refresh(visitor);
                advance();
              },
            });
            typer = target._typed;
          } else if (index === 17) {
            var progress = document.createElement("span");
            progress.className = "transfer";
            progress.setAttribute("aria-hidden", "true");
            node.appendChild(progress);
            var began = performance.now();
            function upload() {
              if (run !== generation) return;
              var fraction = Math.min(1, (performance.now() - began) / 2200),
                blocks = Math.round(fraction * 16);
              progress.textContent =
                "[" +
                "=".repeat(blocks) +
                " ".repeat(16 - blocks) +
                "] " +
                Math.round(75787 * fraction) +
                " / 75787 bytes";
              if (fraction < 1) timer = setTimeout(upload, 100);
              else
                timer = setTimeout(function () {
                  progress.remove();
                  next(index + 1);
                }, 300);
            }
            upload();
          } else advance();
        }
        timer = setTimeout(function () {
          next(0);
        }, 350);
      }
      control.hidden = false;
      control.addEventListener("click", function () {
        if (booting) settle();
        else intro();
      });
      reduced.addEventListener("change", function () {
        if (reduced.matches && booting) settle();
      });
      if (openCase) settle();
      else intro();
    },
  };
})(window, jQuery);
