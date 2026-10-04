const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash, webcrypto } = require("node:crypto");
const create = require("../scripts/ctf.js");

// Synthetic answers only. Real challenge solutions stay outside the repository.
const hash = (value) => createHash("sha256").update(value).digest("hex");
const data = {
  checks: [
    {
      id: "original",
      group: "original",
      units: 5,
      title: "Original",
      digest: hash("sample phrase"),
    },
    ...["entry", "exposure", "receipt"].map((id) => ({
      id,
      group: "open-door",
      units: 1,
      title: id,
      digest: hash("fixture{" + id + "}"),
    })),
  ],
  groups: [
    {
      id: "original",
      title: "Original",
      badge: "SOURCE SEEKER",
      hints: ["Look", "Think", "Try"],
    },
    {
      id: "open-door",
      title: "Case",
      badge: "INCIDENT RESPONDER",
      hints: ["Read", "Compare", "Decode"],
    },
  ],
  files: {},
  caseRoot: "/cases/fixture",
};
function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("answers normalize, wrong answers do not count, and duplicates never double count", async () => {
  const saved = storage(),
    ctf = create(data, saved, webcrypto);
  assert.equal((await ctf.submit("incorrect")).ok, false);
  assert.equal((await ctf.submit(" ＳＡＭＰＬＥ  \n PHRASE ")).ok, true);
  assert.equal(ctf.snapshot().count, 5);
  assert.equal((await ctf.submit("sample phrase")).duplicate, true);
  assert.equal(ctf.snapshot().count, 5);
  assert.doesNotMatch(saved.getItem("loz-ctf-v1"), /sample|phrase|digest/i);
  assert.equal(create(data, saved, webcrypto).snapshot().count, 5);
  assert.equal(ctf.badge("open-door"), null);
  assert.equal(ctf.badge("all"), null);
  assert.match(ctf.badge("original"), /SOURCE SEEKER/);
});

test("out-of-order concurrent submissions preserve all flags and unlock group and overall rewards", async () => {
  const ctf = create(data, storage(), webcrypto);
  await Promise.all(
    ["receipt", "exposure", "entry"].map((id) =>
      ctf.submit("fixture{" + id + "}"),
    ),
  );
  assert.equal(ctf.snapshot().count, 3);
  assert.match(ctf.badge("open-door"), /INCIDENT RESPONDER/);
  assert.equal(ctf.badge("all"), null);
  assert.match((await ctf.submit("sample phrase")).message, /FIELD AGENT/);
  assert.equal(ctf.snapshot().count, 8);
  assert.match(ctf.badge("all"), /All 8 flags captured/);
});

test("hints progress one at a time, synchronize across clients, and reset with flags", async () => {
  const saved = storage(),
    first = create(data, saved, webcrypto),
    second = create(data, saved, webcrypto);
  assert.match(first.hint("missing"), /Choose a challenge/);
  assert.match(first.hint("original"), /Hint 1\/3: Look/);
  assert.deepEqual(second.snapshot().groups[0].hints, ["Look"]);
  second.hint("original");
  second.hint("original");
  assert.match(first.hint("original"), /All hints revealed/);
  await second.submit("fixture{entry}");
  assert.equal(first.snapshot().count, 1);
  first.reset();
  assert.equal(second.snapshot().count, 0);
  assert.deepEqual(second.snapshot().groups[0].hints, []);
});

test("blocked storage still allows session progress, hints, rewards and reset", async () => {
  const blocked = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  const ctf = create(data, blocked, webcrypto);
  assert.equal(ctf.snapshot().persistent, false);
  assert.match((await ctf.submit("sample phrase")).message, /visit only/);
  assert.match(ctf.badge("original"), /SOURCE SEEKER/);
  assert.match((await ctf.submit("sample phrase")).message, /visit only/);
  ctf.hint("open-door");
  assert.equal(ctf.snapshot().groups[1].hints.length, 1);
  ctf.reset();
  assert.equal(ctf.snapshot().count, 0);
});

test("corrupt progress and crypto failures recover without accepting answers", async () => {
  const saved = storage();
  saved.setItem(
    "loz-ctf-v1",
    JSON.stringify({
      solved: { original: "bad", entry: {}, unknown: new Date().toISOString() },
      hints: { original: -1, "open-door": 99 },
    }),
  );
  const ctf = create(data, saved, webcrypto);
  assert.equal(ctf.snapshot().count, 0);
  assert.equal(ctf.snapshot().groups[1].hints.length, 3);
  const noCrypto = create(data, storage(), {});
  assert.match((await noCrypto.submit("sample phrase")).message, /HTTPS/);
  const brokenCrypto = create(data, storage(), {
    subtle: {
      digest: async () => {
        throw Error("unavailable");
      },
    },
  });
  assert.equal((await brokenCrypto.submit("sample phrase")).ok, false);
  assert.equal(brokenCrypto.snapshot().count, 0);
  assert.equal((await ctf.submit(" ")).ok, false);
  assert.equal((await ctf.submit("x".repeat(257))).ok, false);
  saved.setItem("loz-ctf-v1", "invalid JSON");
  assert.equal(ctf.snapshot().count, 0);
  assert.equal(ctf.snapshot().persistent, false);
  assert.equal((await ctf.submit("sample phrase")).ok, true);
});
