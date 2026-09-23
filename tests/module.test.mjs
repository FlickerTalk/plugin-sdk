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
