/* Storage compatibility for the unchanged jQuery Terminal 1.0.12 library.
 * Load after the CTF engine, before the vendor; call finish() just after it.
 */
(function (window, $) {
  "use strict";
  var original = Object.getOwnPropertyDescriptor(window, "localStorage");
  var unavailable = false;
  var shadowed = false;
  var finished = false;
  var values = Object.create(null);
  var probe = "loz-terminal-storage-probe";
  try {
    var storage = window.localStorage;
    storage.setItem(probe, "1");
    if (storage.getItem(probe) !== "1") throw new Error("Storage unavailable");
    storage.removeItem(probe);
  } catch (_) {
    unavailable = true;
    // The vendor reads this property outside its own try/catch. This shadow
    // exists only during that script's initialization, never during app use.
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        setItem: function () {},
        removeItem: function () {},
      },
    });
    shadowed = true;
  }
  window.LozTerminalStorage = {
    finish: function () {
      if (finished) return;
      finished = true;
      if (shadowed) {
        if (original) Object.defineProperty(window, "localStorage", original);
        else delete window.localStorage;
      }
      if (!unavailable) return;
      // Keep only terminal history/state in memory. Avoid the vendor's cookie
      // fallback; the CTF engine still sees the real blocked browser storage
      // and accurately reports that challenge progress lasts for this visit.
      $.Storage = {
        set: function (key, value) {
          if (typeof key === "string" && typeof value === "string") {
            values[key] = value;
            return true;
          }
          if (key && typeof key === "object" && value === undefined) {
            Object.keys(key).forEach(function (name) {
              values[name] = key[name];
            });
            return true;
          }
          return false;
        },
        get: function (key) {
          return values[key];
        },
        remove: function (key) {
          return delete values[key];
        },
      };
    },
  };
})(window, jQuery);
