const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../scripts/local-address.js"),
  "utf8",
);
const flush = () => new Promise(setImmediate);

function lookup(options = {}) {
  const results = [],
    timers = new Map();
  let peer;
  class Peer {
    constructor(configuration) {
      if (options.constructorError) throw new Error("Disabled");
      peer = this;
      this.configuration = configuration;
      this.closes = 0;
      this.descriptions = 0;
    }
    createDataChannel() {}
    createOffer() {
      if (options.pending)
        return new Promise((resolve) => {
          this.resolveOffer = resolve;
        });
      return options.offerError
        ? Promise.reject(new Error("Offer failed"))
        : Promise.resolve({});
    }
    setLocalDescription() {
      this.descriptions++;
      return options.descriptionError
        ? Promise.reject(new Error("Description failed"))
        : Promise.resolve();
    }
    close() {
      this.closes++;
    }
  }
  const window = options.unsupported
    ? {}
    : {
        [options.legacy ? "webkitRTCPeerConnection" : "RTCPeerConnection"]:
          Peer,
      };
  vm.runInNewContext(source, {
    window,
    URL,
    setTimeout(callback) {
      const id = {};
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  window.LozLocalAddress((value) => results.push(value));
  return {
    peer,
    results,
    timers,
    emit(candidate) {
      peer.onicecandidate?.({ candidate });
    },
    timeout() {
      for (const callback of [...timers.values()]) callback();
    },
  };
}

function assertClosed(run, expected) {
  assert.deepEqual(run.results, [expected]);
  assert.equal(run.timers.size, 0);
  if (run.peer) {
    assert.equal(run.peer.closes, 1);
    assert.equal(run.peer.onicecandidate, null);
    assert.equal(run.peer.onicegatheringstatechange, null);
  }
}

test("mDNS is distinguished from lookup failures on completion or timeout", () => {
  for (const end of ["candidate", "gathering", "timeout"]) {
    const run = lookup();
    assert.deepEqual(Array.from(run.peer.configuration.iceServers), []);
    run.emit({ type: "host", address: "example.LOCAL." });
    assert.deepEqual(run.results, []);
    if (end === "candidate") run.emit(null);
    if (end === "gathering") {
      run.peer.iceGatheringState = "complete";
      run.peer.onicegatheringstatechange();
    }
    if (end === "timeout") run.timeout();
    assertClosed(run, "Hidden by browser (mDNS)");
  }
});

test("numeric IPv4 and IPv6 remain visible after an mDNS candidate", () => {
  for (const address of ["192.0.2.42", "2001:db8::42", "::ffff:192.0.2.42"]) {
    const run = lookup();
    run.emit({ type: "host", address: "example.local" });
    run.emit({ type: "host", address });
    assertClosed(run, address);
  }
});

test("legacy SDP candidates work with whitespace and the prefixed constructor", () => {
  for (const address of ["192.0.2.42", "example.local"]) {
    const run = lookup({ legacy: true });
    run.emit({ candidate: `candidate:1  1 udp 123 ${address} 12345 typ host` });
    run.emit({ candidate: "" });
    assertClosed(
      run,
      address.endsWith("local") ? "Hidden by browser (mDNS)" : address,
    );
  }
});

test("non-host, unspecified and malformed candidates are never shown as local IPs", () => {
  const run = lookup();
  run.emit({ type: "srflx", address: "192.0.2.42" });
  run.emit({ type: "relay", address: "192.0.2.43" });
  for (const address of [
    "0.0.0.0",
    "::",
    "0:0:0:0:0:0:0:0",
    "999.2.3.4",
    "::::",
    "abcdef",
    "example.com",
    "",
  ]) {
    run.emit({ type: "host", address });
  }
  run.emit(null);
  assertClosed(run, "Unavailable (no address exposed)");
});

test("unsupported, failed and timed-out lookups do not claim mDNS protection", async () => {
  assertClosed(
    lookup({ unsupported: true }),
    "Unavailable (WebRTC not supported)",
  );
  for (const options of [
    { constructorError: true },
    { offerError: true },
    { descriptionError: true },
  ]) {
    const run = lookup(options);
    await flush();
    assertClosed(run, "Unavailable (WebRTC error)");
  }
  const run = lookup({ pending: true });
  run.timeout();
  assertClosed(run, "Unavailable (lookup timed out)");
  run.peer.resolveOffer({});
  await flush();
  assert.equal(run.peer.descriptions, 0);
});

test("late ICE events and promise failures cannot overwrite a resolved address", async () => {
  const run = lookup({ offerError: true });
  const onCandidate = run.peer.onicecandidate;
  run.emit({ type: "host", address: "192.0.2.42" });
  onCandidate({ candidate: { type: "host", address: "example.local" } });
  onCandidate({ candidate: null });
  await flush();
  assertClosed(run, "192.0.2.42");
});
