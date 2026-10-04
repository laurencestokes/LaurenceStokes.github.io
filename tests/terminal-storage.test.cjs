const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto, createHash } = require("node:crypto");

const source = fs.readFileSync(
  path.join(__dirname, "../scripts/terminal-storage.js"),
  "utf8",
);
const engine = fs.readFileSync(
  path.join(__dirname, "../scripts/ctf.js"),
  "utf8",
);
function setup(storageDescriptor) {
  const window = {
    crypto: webcrypto,
    dispatchEvent() {},
    LozCTFData: {
      checks: [
        {
          id: "sample",
          group: "example",
          units: 1,
          title: "Sample",
          digest: createHash("sha256").update("synthetic").digest("hex"),
        },
      ],
      groups: [
        { id: "example", title: "Example", badge: "EXAMPLE", hints: [] },
      ],
      files: {},
      caseRoot: "/cases/example",
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    ...storageDescriptor,
  });
  const before = Object.getOwnPropertyDescriptor(window, "localStorage");
  const jQuery = {};
  const context = vm.createContext({
    window,
    jQuery,
    TextEncoder,
    CustomEvent: function () {},
  });
  vm.runInContext(engine, context);
  vm.runInContext(source, context);
  // This is the vendor's initialization pattern: property read outside try.
  assert.doesNotThrow(() => {
    const storage = window.localStorage;
    try {
      storage.setItem("test", "1");
      storage.removeItem("test");
    } catch (_) {}
  });
  const vendorStorage = { vendor: true };
  jQuery.Storage = vendorStorage;
  window.LozTerminalStorage.finish();
  window.LozTerminalStorage.finish();
  assert.deepEqual(
    Object.getOwnPropertyDescriptor(window, "localStorage"),
    before,
  );
  return { window, jQuery, vendorStorage };
}

test("throwing storage getter is restored while terminal history stays in memory", async () => {
  const app = setup({
    get() {
      throw new Error("Blocked storage getter");
    },
  });
  assert.throws(() => app.window.localStorage, /Blocked storage getter/);
  assert.equal(app.window.LozCTF.snapshot().persistent, false);
  const result = await app.window.LozCTF.submit("synthetic");
  assert.equal(result.ok, true);
  assert.equal(app.window.LozCTF.snapshot().count, 1);
  assert.match(result.message, /this visit only/);
  app.jQuery.Storage.set("history", '["pwd"]');
  assert.equal(app.jQuery.Storage.get("history"), '["pwd"]');
  app.jQuery.Storage.set({ prompt: "meterpreter> ", mode: "shell" });
  assert.equal(app.jQuery.Storage.get("mode"), "shell");
  app.jQuery.Storage.remove("history");
  assert.equal(app.jQuery.Storage.get("history"), undefined);
});

test("denied storage methods use the same isolated terminal fallback", () => {
  for (const denied of ["getItem", "setItem", "removeItem"]) {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    storage[denied] = () => {
      throw new Error("Blocked method");
    };
    const app = setup({ value: storage });
    assert.equal(app.window.localStorage, storage);
    assert.equal(app.window.LozCTF.snapshot().persistent, false);
    app.jQuery.Storage.set("history", "[]");
    assert.equal(app.jQuery.Storage.get("history"), "[]");
    assert.equal(values.has("history"), false);
  }
});

test("working browser storage and the vendor adapter are left untouched", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const app = setup({ value: storage });
  assert.equal(app.window.localStorage, storage);
  assert.equal(app.jQuery.Storage, app.vendorStorage);
  assert.equal(app.window.LozCTF.snapshot().persistent, true);
  assert.equal(values.size, 0, "temporary probes were removed");
});
