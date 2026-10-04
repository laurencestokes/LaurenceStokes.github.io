/* Shared, local-only challenge progress and answer verification. */
(function (root) {
  "use strict";
  function createChallenges(data, storage, crypto, changed) {
    var key = "loz-ctf-v1",
      memory = { solved: {}, hints: {} },
      persistent = true;
    function empty() {
      return { solved: {}, hints: {} };
    }
    function read() {
      if (!storage || !persistent) return memory;
      try {
        var saved = JSON.parse(storage.getItem(key) || "null"),
          clean = empty();
        if (saved && saved.solved)
          data.checks.forEach(function (check) {
            var value = saved.solved[check.id];
            if (
              typeof value === "string" &&
              /^\d{4}-\d{2}-\d{2}T/.test(value) &&
              !isNaN(Date.parse(value))
            )
              clean.solved[check.id] = value;
          });
        if (saved && saved.hints)
          data.groups.forEach(function (group) {
            var value = saved.hints[group.id];
            if (Number.isInteger(value) && value >= 0)
              clean.hints[group.id] = Math.min(value, group.hints.length);
          });
        memory = clean;
      } catch (_) {
        persistent = false;
      }
      return memory;
    }
    function write(value) {
      memory = value;
      if (storage && persistent) {
        try {
          storage.setItem(key, JSON.stringify(value));
        } catch (_) {
          persistent = false;
        }
      }
      if (changed) changed();
    }
    // Detect blocked storage before promising that progress will survive a reload.
    if (!storage) persistent = false;
    else {
      try {
        storage.setItem(key + "-probe", "1");
        storage.removeItem(key + "-probe");
      } catch (_) {
        persistent = false;
      }
    }
    function normalize(value) {
      return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
    }
    function snapshot() {
      var state = read();
      var checks = data.checks.map(function (check) {
        return {
          id: check.id,
          group: check.group,
          title: check.title,
          units: check.units,
          solved: !!state.solved[check.id],
        };
      });
      return {
        checks: checks,
        groups: data.groups.map(function (group) {
          var items = checks.filter(function (check) {
            return check.group === group.id;
          });
          return {
            id: group.id,
            title: group.title,
            badge: group.badge,
            complete: items.every(function (check) {
              return check.solved;
            }),
            hints: (group.hints || []).slice(0, state.hints[group.id] || 0),
          };
        }),
        count: checks.reduce(function (sum, check) {
          return sum + (check.solved ? check.units : 0);
        }, 0),
        total: checks.reduce(function (sum, check) {
          return sum + check.units;
        }, 0),
        persistent: persistent,
      };
    }
    async function submit(input) {
      if (typeof input !== "string" || !input.trim() || input.length > 256)
        return {
          ok: false,
          message:
            "Enter a flag or the complete original phrase (up to 256 characters).",
        };
      if (!crypto || !crypto.subtle)
        return {
          ok: false,
          message:
            "Answer checking needs HTTPS. Open the secure version of the site and try again.",
        };
      var buffer;
      try {
        buffer = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(normalize(input)),
        );
      } catch (_) {
        return {
          ok: false,
          message:
            "Could not check that submission. Your progress is unchanged; try again.",
        };
      }
      var digest = Array.from(new Uint8Array(buffer))
        .map(function (byte) {
          return byte.toString(16).padStart(2, "0");
        })
        .join("");
      var check = data.checks.find(function (item) {
        return item.digest === digest;
      });
      if (!check)
        return {
          ok: false,
          message:
            "No match yet. Check the flag format and keep following the evidence.",
        };
      var state = read();
      if (state.solved[check.id])
        return {
          ok: true,
          duplicate: true,
          message:
            check.title +
            " is already captured. " +
            (persistent
              ? "Your progress is saved."
              : "Progress lasts for this visit only."),
        };
      state.solved[check.id] = new Date().toISOString();
      write(state);
      var progress = snapshot(),
        group = progress.groups.find(function (item) {
          return item.id === check.group;
        });
      var message =
        "Captured: " +
        check.title +
        ". " +
        progress.count +
        "/" +
        progress.total +
        " flags.";
      if (progress.count === progress.total)
        message += " Lab complete. Your FIELD AGENT badge is unlocked.";
      else if (group.complete)
        message += " " + group.badge + " badge unlocked.";
      if (!persistent)
        message +=
          " Progress is kept for this visit only because browser storage is unavailable.";
      return { ok: true, id: check.id, message: message };
    }
    function hint(id) {
      var group = data.groups.find(function (item) {
        return item.id === id;
      });
      if (!group) return "Choose a challenge: hint original or hint open-door";
      var state = read(),
        index = state.hints[id] || 0;
      if (index >= group.hints.length)
        return (
          "All hints revealed. Last hint: " +
          group.hints[group.hints.length - 1]
        );
      state.hints[id] = index + 1;
      write(state);
      return (
        "Hint " +
        (index + 1) +
        "/" +
        group.hints.length +
        ": " +
        group.hints[index]
      );
    }
    function status() {
      var progress = snapshot();
      return (
        "CHALLENGES / " +
        progress.count +
        " of " +
        progress.total +
        " flags\n\n" +
        progress.groups
          .map(function (group) {
            return (group.complete ? "[complete] " : "[open] ") + group.title;
          })
          .join("\n") +
        "\n\ncase                 Open the incident brief\nhint open-door       Get the next investigation hint\nhint original        Get a hint for the original hunt\nsubmit <answer>      Submit a flag or the original phrase\n\nSubmit answers and collect badges at /ctf/\nProgress " +
        (progress.persistent
          ? "is saved in this browser."
          : "lasts for this visit only.")
      );
    }
    function badge(id) {
      var progress = snapshot(),
        group = progress.groups.find(function (item) {
          return item.id === id;
        });
      var all = id === "all",
        earned = all
          ? progress.count === progress.total
          : group && group.complete;
      if (!earned) return null;
      var title = all ? "FIELD AGENT" : group.badge;
      var detail = all
        ? "All " + progress.total + " flags captured"
        : group.title;
      function escape(text) {
        return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/"/g, "&quot;");
      }
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440" viewBox="0 0 720 440"><title>Loz Stokes CTF: ' +
        escape(title) +
        '</title><rect width="720" height="440" rx="24" fill="#090b0d"/><rect x="24" y="24" width="672" height="392" rx="16" fill="#111a16" stroke="#476351"/><g fill="#94d8ad">' +
        Array.from({ length: 8 }, function (_, i) {
          return (
            '<rect x="' + (60 + i * 25) + '" y="65" width="16" height="16"/>'
          );
        }).join("") +
        '</g><text x="60" y="126" fill="#9ba69f" font-family="monospace" font-size="14" letter-spacing="3">LOZSTOKES / SECURITY LAB</text><text x="60" y="218" fill="#eef1ee" font-family="Arial,sans-serif" font-size="42" font-weight="bold">' +
        escape(title) +
        '</text><text x="60" y="264" fill="#94d8ad" font-family="monospace" font-size="18">' +
        escape(detail) +
        '</text><path d="M60 316H660" stroke="#304738"/><text x="60" y="357" fill="#aab6af" font-family="monospace" font-size="14">Curiosity followed through.</text><text x="60" y="384" fill="#aab6af" font-family="monospace" font-size="12">lozstokes.co.uk/ctf/ · Personal completion badge</text></svg>'
      );
    }
    return {
      submit: submit,
      snapshot: snapshot,
      hint: hint,
      status: status,
      badge: badge,
      reset: function () {
        write(empty());
      },
      files: data.files,
      caseRoot: data.caseRoot,
    };
  }
  if (typeof module !== "undefined" && module.exports)
    module.exports = createChallenges;
  else {
    var storage;
    try {
      storage = root.localStorage;
    } catch (_) {}
    root.LozCTF = createChallenges(
      root.LozCTFData,
      storage,
      root.crypto,
      function () {
        root.dispatchEvent(new CustomEvent("loz:ctf-progress"));
      },
    );
  }
})(typeof window !== "undefined" ? window : globalThis);
