/* A text-only, read-only virtual machine. Never evaluates command input. */
(function (window) {
  "use strict";
  window.LozShell = function (
    content,
    visitor,
    originalFiles,
    ctf,
    onEvidence,
  ) {
    var home = "/home/visitor";
    var cwd = home,
      previous = home,
      mode = "meterpreter",
      connected = true;
    var started = Date.now();
    var commands =
      "help whoami getuid id sysinfo hostname uname pwd cd ls cat head tail tree grep echo env date uptime ps ip ipconfig ifconfig netstat history clear shell exit background sessions exploit git case challenges hint submit base64".split(
        " ",
      );
    var fs = Object.create(null);
    [
      "/",
      "/home",
      home,
      home + "/blog",
      home + "/projects",
      "/etc",
      "/var",
      "/var/www",
      "/var/www/site",
      "/tmp",
    ].forEach(function (path) {
      fs[path] = null;
    });
    fs[home + "/about.txt"] =
      "Laurence Stokes\nSoftware/Web Developer from the UK\nSoftware development, computer security and networking.\n/about/\n";
    fs[home + "/secretfile.txt"] = "This is a secret file.\n";
    fs[home + "/secretfile2.txt"] = "This is another secret file.\n";
    fs[home + "/.profile"] = "USER=root\nHOME=" + home + "\nSHELL=/bin/bash\n";
    fs["/etc/hostname"] = "visitor\n";
    fs["/etc/os-release"] =
      'NAME="Debian GNU/Linux"\nVERSION_ID="12"\nPRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\n';
    fs["/etc/motd"] = "Welcome. Look around.\n";
    fs["/var/www/site/README.md"] =
      "# lozstokes.co.uk\n\nBuilt with Jekyll. Hosted on GitHub Pages.\nSource: https://github.com/LaurenceStokes/LaurenceStokes.github.io\n";
    fs["/var/www/site/REVISION"] = content.revision + "\n";
    Object.keys(originalFiles).forEach(function (name) {
      fs[home + "/" + name] = originalFiles[name];
    });
    if (ctf)
      Object.keys(ctf.files).forEach(function (path) {
        var parts = path.split("/");
        for (var i = 2; i < parts.length; i++)
          fs[parts.slice(0, i).join("/")] = null;
        fs[path] = ctf.files[path];
      });
    ["posts", "projects"].forEach(function (group) {
      (content[group] || []).forEach(function (item) {
        fs[
          home + "/" + (group === "posts" ? "blog" : group) + "/" + item.name
        ] = item.title + "\n" + item.url + "\n\n" + item.summary + "\n";
      });
    });
    function has(path) {
      return Object.prototype.hasOwnProperty.call(fs, path);
    }
    function resolve(path) {
      var value = path || cwd;
      if (value === "~" || value.indexOf("~/") === 0)
        value = home + value.slice(1);
      if (value[0] !== "/") value = cwd + "/" + value;
      var parts = [];
      value.split("/").forEach(function (part) {
        if (part === "..") parts.pop();
        else if (part && part !== ".") parts.push(part);
      });
      return "/" + parts.join("/");
    }
    function basename(path) {
      return path.split("/").pop() || "/";
    }
    function isChallengeFile(path) {
      return /^\.?secretfile\d*\.txt$/.test(basename(path));
    }
    function children(path, all, revealChallenge) {
      var prefix = path === "/" ? "/" : path + "/";
      return Object.keys(fs)
        .filter(function (p) {
          var tail = p.slice(prefix.length);
          return (
            p.indexOf(prefix) === 0 &&
            tail &&
            tail.indexOf("/") === -1 &&
            (all || tail[0] !== ".") &&
            (revealChallenge || !isChallengeFile(p))
          );
        })
        .sort();
    }
    function read(path, command) {
      var full = resolve(path);
      if (!has(full))
        return command + ": " + path + ": No such file or directory";
      if (fs[full] === null) return command + ": " + path + ": Is a directory";
      discover(full);
      return fs[full].replace(/\n$/, "");
    }
    function discover(path) {
      if (
        typeof onEvidence === "function" &&
        ctf &&
        path.indexOf(ctf.caseRoot + "/") === 0 &&
        Object.prototype.hasOwnProperty.call(ctf.files, path)
      ) {
        // Observers receive a canonical path, never file contents or answers.
        // A presentation failure must not stop an otherwise valid shell read.
        try {
          onEvidence({ path: path });
        } catch (_) {}
      }
    }
    function save() {
      try {
        sessionStorage.setItem("loz-lab-cwd", cwd);
      } catch (_) {}
    }
    try {
      var saved = sessionStorage.getItem("loz-lab-cwd");
      if (has(saved) && fs[saved] === null) cwd = saved;
    } catch (_) {}
    function prompt() {
      if (mode === "msf") return "msf exploit(web_delivery) > ";
      if (mode === "shell")
        return (
          "root@visitor:" + cwd.replace(/^\/home\/visitor(?=\/|$)/, "~") + "# "
        );
      return "meterpreter> ";
    }
    function network() {
      return (
        "lo: 127.0.0.1/8\nLocal address: " +
        visitor.local +
        "\nPublic address: " +
        visitor.ip +
        "\nProvider: " +
        visitor.provider +
        "\nSimulated handler: 192.168.0.1:89"
      );
    }
    function tokenize(raw) {
      var words = [],
        word = "",
        quote = "",
        active = false;
      for (var i = 0; i < raw.length; i++) {
        var char = raw[i];
        if (quote) {
          if (char === quote) quote = "";
          else word += char;
        } else if (char === '"' || char === "'") {
          quote = char;
          active = true;
        } else if (/\s/.test(char)) {
          if (active) {
            words.push(word);
            word = "";
            active = false;
          }
        } else {
          word += char;
          active = true;
        }
      }
      if (quote)
        throw new Error("Unclosed quote. Close the quote and try again.");
      if (active) words.push(word);
      return words;
    }
    function execute(raw, history) {
      var words;
      try {
        words = tokenize(raw);
      } catch (error) {
        return error.message;
      }
      if (!words.length) return "";
      var command = words[0],
        args = words.slice(1);
      if (command === "help")
        return "Session\n  shell  exit  background  sessions [-i 1]  exploit\n\nFiles\n  pwd  cd <path>  ls [-la] [path]  tree [path]\n  cat <file>  head [-n count] <file>  tail [-n count] <file>\n  grep [-i] <text> <file>\n\nSystem\n  whoami  getuid  id  hostname  sysinfo  uname [-a]\n  env  ps  date  uptime  ip addr  ipconfig  ifconfig  netstat\n  git rev-parse [--short] HEAD\n\nChallenges\n  case  challenges  hint <original|open-door>  submit <answer>\n  base64 -d <file-or-encoded-value>\n  Collect badges at /ctf/\n\nConsole\n  echo <text>  history  clear\n  Enter executes. Up/Down history. Tab completes. Ctrl+L clears.\n  Press Escape, then Tab to leave the terminal.\n\nTry: shell, ls -la, cd blog, ls\nThis is a read-only simulation; there are no real shell processes.";
      if (
        ["case", "challenges", "hint", "submit"].indexOf(command) >= 0 &&
        !ctf
      )
        return "Challenges are unavailable. Reload the page to try again.";
      if (command === "challenges") return ctf.status();
      if (command === "hint") return ctf.hint(args[0]);
      if (command === "submit")
        return ctf.submit(args.join(" ")).then(function (result) {
          return (
            result.message +
            (result.ok ? "\nCollect your rewards at /ctf/" : "")
          );
        });
      if (command === "clear") return null;
      if (command === "echo") return args.join(" ");
      if (command === "history")
        return history
          .map(function (line, i) {
            return String(i + 1).padStart(4) + "  " + line;
          })
          .join("\n");
      if (command === "git")
        return /^rev-parse (?:--short )?HEAD$/.test(args.join(" "))
          ? args.indexOf("--short") >= 0
            ? content.revision.slice(0, 8)
            : content.revision
          : "Usage: git rev-parse [--short] HEAD";
      if (command === "sessions") {
        if (args.length && args.join(" ") !== "-i 1")
          return "Usage: sessions [-i 1]";
        if (args.length) {
          if (!connected)
            return "Session 1 is closed. Run exploit to open a new session.";
          mode = "meterpreter";
          return "[*] Starting interaction with 1...";
        }
        return connected
          ? "Active sessions\n\nId  Type                   Connection\n1   meterpreter x64/linux  192.168.0.1:89 -> " +
              visitor.ip +
              ":89"
          : "No active sessions.";
      }
      if (command === "exit") {
        if (mode === "shell") {
          mode = "meterpreter";
          return "Channel 1 closed.";
        }
        if (mode === "meterpreter") {
          mode = "msf";
          connected = false;
          return "[*] Meterpreter session 1 closed.";
        }
        return "Console stays open. Run exploit to start a session.";
      }
      if (command === "background") {
        if (mode === "msf") return "No foreground session.";
        mode = "msf";
        return "[*] Backgrounding session 1...";
      }
      if (command === "exploit") {
        if (mode !== "msf")
          return "Background the session to return to msfconsole.";
        if (connected) return "Session 1 is already open. Use sessions -i 1.";
        connected = true;
        mode = "meterpreter";
        return (
          "[*] Started reverse handler\n[*] Meterpreter session 1 opened (192.168.0.1:89 -> " +
          visitor.ip +
          ":89)"
        );
      }
      if (mode === "msf")
        return (
          "Select a session first: sessions -i 1" +
          (connected ? "" : "\nRun exploit to open a new session.")
        );
      if (command === "shell") {
        if (mode === "shell") return "Already in /bin/bash.";
        mode = "shell";
        return "Process 2481 created.\nChannel 1 created.\n/bin/bash";
      }
      if (command === "case") {
        if (args.length) return "Usage: case (opens the current investigation)";
        previous = cwd;
        cwd = ctf.caseRoot;
        save();
        return read("brief.txt", "case");
      }
      if (command === "base64") {
        if (args.length !== 2 || ["-d", "--decode"].indexOf(args[0]) < 0)
          return "Usage: base64 -d <file-or-encoded-value>";
        var sourcePath = resolve(args[1]);
        var fromFile = has(sourcePath);
        var source = fromFile ? fs[sourcePath] : args[1];
        if (source === null) return "base64: " + args[1] + ": Is a directory";
        source = source.replace(/\s/g, "");
        if (
          !source ||
          source.length > 100000 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(source)
        )
          return "base64: Invalid encoded input. Use a file or paste only the encoded value.";
        try {
          var bytes = Uint8Array.from(atob(source), function (char) {
            return char.charCodeAt(0);
          });
          var decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          if (fromFile) discover(sourcePath);
          return decoded;
        } catch (_) {
          return "base64: Invalid Base64 or UTF-8 text.";
        }
      }
      if (command === "whoami") return "root";
      if (command === "getuid") return "Server username: root";
      if (command === "id") return "uid=0(root) gid=0(root) groups=0(root)";
      if (command === "hostname") return read("/etc/hostname", command);
      if (command === "sysinfo")
        return "Computer     : visitor\nOS           : Debian GNU/Linux 12\nArchitecture : x86_64\nMeterpreter  : x64/linux\nSession      : 1 (simulated)";
      if (command === "uname")
        return args.indexOf("-a") >= 0
          ? "Linux visitor 6.1.0 x86_64 GNU/Linux"
          : "Linux";
      if (command === "pwd") return cwd;
      if (command === "cd") {
        var dest = args[0] === "-" ? previous : resolve(args[0] || "~");
        if (!has(dest)) return "cd: " + args[0] + ": No such file or directory";
        if (fs[dest] !== null) return "cd: " + args[0] + ": Not a directory";
        previous = cwd;
        cwd = dest;
        save();
        return args[0] === "-" ? cwd : "";
      }
      if (command === "ls") {
        var all = args.some(function (a) {
          return a === "--all" || /^-[al]*a[al]*$/.test(a);
        });
        var long = args.some(function (a) {
          return /^-[al]*l[al]*$/.test(a);
        });
        var path = resolve(
          args.find(function (a) {
            return a[0] !== "-";
          }) || cwd,
        );
        if (!has(path))
          return "ls: cannot access path: No such file or directory";
        var revealChallenge = all && long;
        var list =
          fs[path] === null
            ? children(path, all, revealChallenge)
            : revealChallenge || !isChallengeFile(path)
              ? [path]
              : [];
        var rows = list.map(function (p) {
          var dir = fs[p] === null;
          return (
            (long
              ? (dir ? "drwxr-xr-x" : "-rw-r--r--") +
                "  root root " +
                String(dir ? 4096 : fs[p].length).padStart(5) +
                "  "
              : "") +
            basename(p) +
            (dir ? "/" : "")
          );
        });
        if (all && fs[path] === null) rows.unshift("./", "../");
        return rows.join(long ? "\n" : "  ");
      }
      if (command === "cat")
        return args.length
          ? args
              .map(function (p) {
                return read(p, command);
              })
              .join("\n")
          : "Usage: cat <filename>";
      if (command === "head" || command === "tail") {
        var count = 10;
        if (args[0] === "-n") {
          count = Number(args[1]);
          args = args.slice(2);
        }
        if (args.length !== 1 || !Number.isInteger(count) || count < 0)
          return "Usage: " + command + " [-n count] <filename>";
        if (!has(resolve(args[0])) || fs[resolve(args[0])] === null)
          return read(args[0], command);
        var lines = read(args[0], command).split("\n");
        return count === 0
          ? ""
          : (command === "head"
              ? lines.slice(0, count)
              : lines.slice(-count)
            ).join("\n");
      }
      if (command === "grep") {
        var insensitive = args[0] === "-i";
        if (insensitive) args.shift();
        if (args.length !== 2) return "Usage: grep [-i] <text> <filename>";
        if (!has(resolve(args[1])) || fs[resolve(args[1])] === null)
          return read(args[1], command);
        return read(args[1], command)
          .split("\n")
          .filter(function (line) {
            return (
              (insensitive ? line.toLowerCase() : line).indexOf(
                insensitive ? args[0].toLowerCase() : args[0],
              ) >= 0
            );
          })
          .join("\n");
      }
      if (command === "tree") {
        var start = resolve(args[0] || cwd);
        if (!has(start) || fs[start] !== null)
          return "tree: directory not found";
        var output = [start];
        function walk(path, prefix) {
          var list = children(path, false);
          list.forEach(function (p, i) {
            var last = i === list.length - 1;
            output.push(prefix + (last ? "└── " : "├── ") + basename(p));
            if (fs[p] === null) walk(p, prefix + (last ? "    " : "│   "));
          });
        }
        walk(start, "");
        return output.join("\n");
      }
      if (command === "env")
        return (
          "USER=root\nHOME=" +
          home +
          "\nSHELL=/bin/bash\nPWD=" +
          cwd +
          "\nTERM=xterm-256color\nLANG=en_GB.UTF-8"
        );
      if (command === "date")
        return new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          dateStyle: "full",
          timeStyle: "long",
        }).format(new Date());
      if (command === "uptime")
        return (
          "up " +
          Math.floor((Date.now() - started) / 1000) +
          " seconds, 1 user, load average: 0.00, 0.00, 0.00"
        );
      if (command === "ps")
        return (
          "  PID USER  COMMAND\n    1 root  /sbin/init\n 2470 root  meterpreter" +
          (mode === "shell" ? "\n 2481 root  /bin/bash" : "")
        );
      if (
        command === "ipconfig" ||
        command === "ifconfig" ||
        (command === "ip" && /^(addr|a)$/.test(args[0]))
      )
        return network();
      if (command === "ip") return "Usage: ip addr";
      if (command === "netstat")
        return (
          "Proto Local Address      Foreign Address  State\ntcp   " +
          visitor.ip +
          ":89  192.168.0.1:89  ESTABLISHED (simulated)"
        );
      if (["rm", "touch", "mkdir", "mv", "chmod"].indexOf(command) >= 0)
        return command + ": Read-only file system";
      return (
        (mode === "shell" ? "bash: " : "") + command + ": command not found"
      );
    }
    function complete(raw) {
      var words = raw.split(/\s+/),
        last = words.pop();
      if (!words.length)
        return commands.filter(function (command) {
          return command.indexOf(last) === 0;
        });
      if (words[0] === "submit") return [];
      if (words[0] === "hint")
        return ["original", "open-door"].filter(function (id) {
          return id.indexOf(last) === 0;
        });
      var slash = last.lastIndexOf("/"),
        prefix = slash < 0 ? "" : last.slice(0, slash + 1),
        partial = last.slice(slash + 1);
      return children(resolve(prefix || cwd), true)
        .filter(function (path) {
          return (
            basename(path).indexOf(partial) === 0 &&
            (words[0] !== "cd" || fs[path] === null)
          );
        })
        .map(function (path) {
          return prefix + basename(path) + (fs[path] === null ? "/" : "");
        });
    }
    return {
      execute: execute,
      isSubmission: function (raw) {
        try {
          return tokenize(raw)[0] === "submit";
        } catch (_) {
          return /^\s*submit(?:\s|$)/.test(raw);
        }
      },
      prompt: prompt,
      complete: complete,
      status: function () {
        return !connected
          ? "SESSION CLOSED"
          : mode === "msf"
            ? "SESSION 1 · BACKGROUNDED"
            : mode === "shell"
              ? "SESSION 1 · /BIN/BASH"
              : "SESSION 1 · CONNECTED";
      },
      connected: function () {
        return connected;
      },
      reconnect: function () {
        mode = "meterpreter";
        connected = true;
      },
    };
  };
})(window);
