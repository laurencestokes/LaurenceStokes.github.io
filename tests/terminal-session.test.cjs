const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise the presentation lifecycle with a small terminal adapter. Browser
// acceptance checks cover the real jQuery Terminal editing/focus integration.
function start({ workspace = true, submit } = {}) {
  const events = [],
    timers = new Map();
  let timerId = 0,
    terminalCount = 0,
    terminal;
  const document = { activeElement: null };
  function element() {
    return {
      dataset: {},
      style: {},
      hidden: false,
      children: [],
      textContent: "",
      listeners: {},
      append(...nodes) {
        this.children.push(...nodes);
      },
      appendChild(node) {
        this.children.push(node);
      },
      replaceChildren() {
        this.children = [];
      },
      querySelectorAll() {
        return [];
      },
      setAttribute() {},
      getClientRects() {
        return this.hidden ? [] : [{}];
      },
      addEventListener(name, handler) {
        this.listeners[name] = handler;
      },
      focus() {
        document.activeElement = this;
        this.listeners.focus?.();
      },
    };
  }
  const nodes = Object.fromEntries(
    [
      "terminal-window",
      "terminal-intro",
      "meterpreter",
      "intro-control",
      "terminal-status",
    ].map((id) => [id, element()]),
  );
  nodes["lab-content"] = {
    textContent: JSON.stringify({
      revision: "synthetic",
      posts: [],
      projects: [],
    }),
  };
  if (workspace) nodes["lab-workspace"] = element();
  Object.assign(document, {
    getElementById: (id) => nodes[id],
    createElement: element,
    createTextNode: (textContent) => ({ textContent }),
  });
  const chain = {
    attr() {
      return this;
    },
  };
  function $(host) {
    return {
      find: () => chain,
      terminal(interpreter, settings) {
        terminalCount++;
        const history = [];
        terminal = {
          output: [],
          enabledValue: false,
          pausedValue: false,
          settings,
          echo(value) {
            this.output.push(value);
          },
          clear() {
            this.output = [];
            settings.onClear();
          },
          history() {
            return { data: () => history };
          },
          set_prompt(value) {
            this.prompt = value;
          },
          resize() {},
          enable() {
            this.enabledValue = true;
          },
          disable() {
            this.enabledValue = false;
          },
          enabled() {
            return this.enabledValue;
          },
          focus() {
            this.enable();
            host.focus();
          },
          exec(input) {
            if (settings.historyFilter(input)) history.push(input);
            const result = interpreter.call(this, input);
            if (result?.then) this.pausedValue = true;
            return Promise.resolve(result).then(() => {
              this.pausedValue = false;
              settings.onResume.call(this);
            });
          },
        };
        return terminal;
      },
    };
  }
  $.terminal = {
    escape_brackets: (value) =>
      value.replace(/\[/g, "&#91;").replace(/\]/g, "&#93;"),
  };
  const window = {
    dispatchEvent: (event) => events.push(event),
    location: { search: "" },
    LozLocalAddress: (callback) => callback("Hidden by browser (mDNS)"),
    LozCTF: {
      caseRoot: "/cases/example",
      files: { "/cases/example/brief.txt": "Synthetic case\n" },
      submit: submit || (async () => ({ message: "Checked synthetic answer" })),
    },
  };
  const context = {
    window,
    document,
    jQuery: $,
    navigator: { userAgent: "Test browser" },
    screen: { width: 1000, height: 800 },
    URLSearchParams,
    Promise,
    sessionStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    XMLHttpRequest: function () {
      this.open = function () {};
      this.send = function () {};
    },
    CustomEvent: function (type, options) {
      this.type = type;
      this.detail = options.detail;
    },
    setTimeout: (handler) => {
      timers.set(++timerId, handler);
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
    Intl,
    Date,
    atob,
    TextDecoder,
  };
  for (const file of ["lab-shell.js", "cssterm.js"])
    vm.runInNewContext(
      fs.readFileSync(path.join(__dirname, "../scripts", file), "utf8"),
      context,
    );
  window.LozLab.start({ "legacy.txt": "Synthetic legacy text" });
  return {
    session: window.LozLab.session,
    window,
    nodes,
    events,
    timers,
    get terminal() {
      return terminal;
    },
    get terminalCount() {
      return terminalCount;
    },
  };
}

test("workspace starts immediately and controls keep one session and its shell state", async () => {
  const app = start();
  assert.equal(app.nodes["terminal-intro"].hidden, true);
  assert.equal(app.terminalCount, 1);
  assert.equal(
    app.events.filter((event) => event.type === "loz:terminal-ready").length,
    1,
  );
  await app.session.run("shell");
  await app.session.run("cd blog");
  app.session.blur();
  app.nodes.meterpreter.hidden = true;
  app.session.resize();
  app.session.focus();
  assert.equal(
    app.terminal.enabled(),
    false,
    "hidden terminal cannot take focus",
  );
  app.nodes.meterpreter.hidden = false;
  app.session.focus();
  app.session.settle();
  assert.equal(app.terminal.prompt, "root@visitor:~/blog# ");
  await app.session.run("exit");
  await app.session.run("exit");
  app.session.settle();
  app.session.resize();
  assert.equal(app.terminal.prompt, "msf exploit(web_delivery) > ");
  assert.equal(app.nodes["terminal-window"].dataset.state, "closed");
  assert.equal(app.terminalCount, 1);
});

test("API commands safely settle the homepage intro without restarting it later", async () => {
  const app = start({ workspace: false });
  assert.equal(app.nodes["terminal-window"].dataset.state, "connecting");
  assert.equal(app.terminalCount, 0);
  await app.session.run("case");
  assert.equal(app.terminalCount, 1);
  assert.equal(app.timers.size, 0, "typing timeline is cancelled");
  assert.equal(
    app.events.find((event) => event.type === "loz:case-evidence").detail.path,
    "/cases/example/brief.txt",
  );
  await app.session.run("pwd");
  assert.equal(app.terminal.output.at(-1), "/cases/example");
  await assert.rejects(app.session.run(null), /must be text/);
  await app.session.run("pwd");
  assert.equal(app.terminal.output.at(-1), "/cases/example");
});

test("API commands wait for native submissions, redact answers and keep suspended input disabled", async () => {
  let finish;
  const app = start({
    submit: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  app.session.focus();
  const submission = app.terminal.exec("submit synthetic-secret");
  const command = app.session.run("case");
  await Promise.resolve();
  assert.equal(
    app.terminal.output.length,
    1,
    "case waits for the native submission",
  );
  assert.equal(app.nodes["intro-control"].disabled, true);
  app.session.blur();
  app.nodes.meterpreter.hidden = true;
  finish({ message: "Checked synthetic answer" });
  await Promise.all([submission, command]);
  assert.equal(app.terminal.enabled(), false);
  assert.equal(app.nodes["intro-control"].disabled, false);
  assert.equal(
    app.terminal.history().data().includes("submit synthetic-secret"),
    false,
  );
  assert.doesNotMatch(app.terminal.output.join("\n"), /synthetic-secret/);
  assert.equal(app.terminal.output.at(-1), "Synthetic case");
  assert.doesNotMatch(
    JSON.stringify(app.events),
    /synthetic-secret|Synthetic case/,
  );
  assert.equal(
    app.events.filter((event) => event.type === "loz:terminal-state").at(-1)
      .detail.busy,
    false,
  );
});

test("a failed async submission settles the run queue and leaves the terminal usable", async () => {
  const app = start({
    submit: async () => {
      throw new Error("Synthetic failure");
    },
  });
  await app.session.run("submit synthetic-secret");
  assert.match(app.terminal.output.at(-1), /Could not check/);
  await app.session.run("pwd");
  assert.equal(app.terminal.output.at(-1), "/home/visitor");
  assert.equal(app.nodes["intro-control"].disabled, false);
});
