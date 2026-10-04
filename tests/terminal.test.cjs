const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function createShell() {
  const context = {
    window: {},
    sessionStorage: { getItem: () => null, setItem: () => {} },
    Intl,
    Date,
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../scripts/lab-shell.js"), "utf8"),
    context,
  );
  return context.window.LozShell(
    {
      revision: "test-build",
      posts: [
        {
          name: "note.txt",
          title: "A note",
          url: "/blog/note/",
          summary: "A real route.",
        },
      ],
      projects: [],
    },
    { ip: "Unavailable", local: "Unavailable", provider: "Unavailable" },
    { "legacy.txt": "Preserved content" },
  );
}

test("paths, file readers and completion use the same filesystem", () => {
  const shell = createShell(),
    run = (command) => shell.execute(command, []);
  assert.equal(run("pwd"), "/home/visitor");
  assert.match(run("ls -la"), /legacy.txt/);
  assert.equal(run("cat legacy.txt"), "Preserved content");
  assert.deepEqual(Array.from(shell.complete("cd bl")), ["blog/"]);
  run("cd blog");
  assert.equal(run("cat ../about.txt"), run("cat /home/visitor/about.txt"));
  assert.equal(run("head -n 1 note.txt"), "A note");
  assert.equal(run("tail -n 1 note.txt"), "A real route.");
  assert.equal(run("grep -i ROUTE note.txt"), "A real route.");
  assert.equal(run("head -n 0 note.txt"), "");
  assert.match(run("cat missing"), /No such file/);
  assert.match(run("cd note.txt"), /Not a directory/);
  assert.match(run("cat ."), /Is a directory/);
  run("cd ../../..");
  assert.equal(run("pwd"), "/");
  assert.match(run("tree /home/visitor"), /note.txt/);
  run("cd ~");
  assert.equal(run("pwd"), "/home/visitor");
});

test("session transitions preserve cwd and do not expose a closed shell", () => {
  const shell = createShell(),
    run = (command) => shell.execute(command, []);
  run("shell");
  run("cd blog");
  assert.equal(shell.prompt(), "root@visitor:~/blog# ");
  run("exit");
  assert.equal(shell.prompt(), "meterpreter> ");
  assert.equal(run("pwd"), "/home/visitor/blog");
  run("background");
  assert.equal(shell.prompt(), "msf exploit(web_delivery) > ");
  assert.match(run("pwd"), /Select a session/);
  run("sessions -i 1");
  run("exit");
  assert.equal(shell.connected(), false);
  assert.equal(run("sessions"), "No active sessions.");
  assert.match(run("sessions -i 1"), /closed/);
  run("exploit");
  assert.equal(shell.connected(), true);
  assert.equal(run("pwd"), "/home/visitor/blog");
});

test("challenge files require both long and all listing flags", () => {
  const shell = createShell(),
    run = (command) => shell.execute(command, []);
  for (const command of ["ls", "ls -l", "ls -a", "tree", "tree /home"])
    assert.doesNotMatch(run(command), /secretfile/);
  for (const command of ["ls -la", "ls -al", "ls -l -a", "ls --all -l"]) {
    assert.match(run(command), /secretfile\.txt/);
    assert.match(run(command), /secretfile2\.txt/);
  }
  assert.doesNotMatch(shell.complete("cat ").join(" "), /secretfile/);
  assert.deepEqual(Array.from(shell.complete("cat secr")), []);
  assert.match(run("cat secretfile.txt"), /This is a secret file/);
  assert.match(run("cat secretfile2.txt"), /This is another secret file/);
  run("cd blog");
  assert.doesNotMatch(run("ls .."), /secretfile/);
  assert.match(run("ls -al .."), /secretfile2\.txt/);
});

test("input remains text and system output agrees with virtual files", () => {
  const shell = createShell(),
    run = (command) => shell.execute(command, []);
  assert.equal(run('echo "<img onerror=alert(1)>"'), "<img onerror=alert(1)>");
  assert.equal(run('echo "$(whoami)"'), "$(whoami)");
  assert.match(run('echo "unfinished'), /Unclosed quote/);
  assert.match(run("rm /etc/hostname"), /Read-only/);
  assert.equal(run("hostname"), run("cat /etc/hostname"));
  assert.equal(run("git rev-parse HEAD"), run("cat /var/www/site/REVISION"));
  assert.match(run("ip addr"), /Unavailable/);
  assert.equal(
    shell.execute("history", ["pwd", "history"]),
    "   1  pwd\n   2  history",
  );
  assert.equal(run("clear"), null);
});
