// The schema of `module.json` is the contract a plugin is packed against (Plan §49): what the app
// reads, and what a plugin author writes. These tests keep it in step with `ft-plugins`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(join(root, "module.schema.json"), "utf8"));
const validate = new Ajv({ strict: false }).compile(schema);

const manifest = {
  id: "com.example.translator",
  name: "Translator",
  version: "1.2.0",
  minCoreVersion: "0.1.0",
  components: ["ft-translator"],
  summary: "Translates a message you hand it.",
  permissions: { messages: "given", send: "propose", network: ["api.example.com"], print: false },
};

// 2026-09-27: the board, the notes and the drive ask for the live channel, reminders, the cloud
// and room, and say which kinds of file they open.
const board = {
  id: "com.flickertalk.board",
  name: "Board",
  version: "1.0.0",
  minCoreVersion: "1.1.0",
  components: ["ft-board"],
  opens: ["application/x-ftboard", "image/*"],
  permissions: { send: "propose", live: true, remind: false, drive: true, storage: "large" },
};

test("a plugin may ask for the live channel, reminders, the cloud and room, and say what it opens", () => {
  assert.ok(validate(board), JSON.stringify(validate.errors));
  assert.ok(validate({ ...board, opens: ["*/*"] }), JSON.stringify(validate.errors));
  for (const wrong of [
    { ...board, opens: ["png"] },
    { ...board, opens: ["*/png"] },
    { ...board, opens: ["image/*; q=1"] },
    { ...board, permissions: { storage: "huge" } },
    { ...board, permissions: { live: "yes" } },
  ]) {
    assert.ok(!validate(wrong), `${JSON.stringify(wrong)} should be refused`);
  }
});

test("a manifest with everything it may say is valid", () => {
  assert.ok(validate(manifest), JSON.stringify(validate.errors));
});

test("a plugin that asks for nothing is valid too", () => {
  const plain = { ...manifest };
  delete plain.permissions;
  delete plain.summary;
  assert.ok(validate(plain), JSON.stringify(validate.errors));
});

test("what the app would refuse, the schema refuses first", () => {
  for (const wrong of [
    { ...manifest, id: "Not An Id" },
    { ...manifest, version: "1.2" },
    { ...manifest, components: [] },
    { ...manifest, components: ["translator"] },
    { ...manifest, permissions: { network: ["*"] } },
    { ...manifest, permissions: { network: ["https://api.example.com"] } },
    { ...manifest, permissions: { send: "whatever" } },
    { ...manifest, permissions: { messages: true } },
    (({ id, ...rest }) => rest)(manifest),
    { ...manifest, extra: "no" },
  ]) {
    assert.ok(!validate(wrong), `${JSON.stringify(wrong)} should be refused`);
  }
});

// 2026-09-27: a viewer names exact kinds it also opens; the app refuses one with the network.
test("a viewer names exact kinds of file", () => {
  const viewer = { ...board, id: "com.flickertalk.pdfviewer", components: ["ft-pdf-viewer"], permissions: {}, opens: ["application/pdf"], views: ["application/pdf"] };
  assert.ok(validate(viewer), JSON.stringify(validate.errors));
  for (const wrong of [{ ...viewer, views: ["application/*"] }, { ...viewer, views: ["*/*"] }, { ...viewer, views: ["pdf"] }]) {
    assert.equal(validate(wrong), false, JSON.stringify(wrong.views));
  }
});

// 2026-10-02: the location plugin asks for the phone's current position, once, while the app is
// open. A yes or a no: there is no "always", no background and no live sharing to ask for.
test("a plugin may ask for the phone's current position, and only as a yes or a no", () => {
  const location = {
    id: "com.flickertalk.location",
    name: "Location",
    version: "1.0.0",
    minCoreVersion: "1.3.0",
    components: ["ft-location"],
    permissions: { location: true, send: "propose" },
  };
  assert.ok(validate(location), JSON.stringify(validate.errors));
  for (const wrong of [
    { ...location, permissions: { location: "always" } },
    { ...location, permissions: { location: "background" } },
    { ...location, permissions: { location: 1 } },
  ]) {
    assert.equal(validate(wrong), false, JSON.stringify(wrong.permissions));
  }
});
