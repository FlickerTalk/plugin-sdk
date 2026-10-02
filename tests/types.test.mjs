// The types of the Plugin API (`index.d.ts`) are the other half of the contract (Plan §53): what a
// plugin is handed and may call. These tests keep in step with the app what plugins rely on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const types = readFileSync(join(root, "index.d.ts"), "utf8");

/** The body of one interface of `index.d.ts`. */
const body = (name) => {
  const start = types.indexOf(`export interface ${name} {`);
  assert.ok(start >= 0, `${name} is declared`);
  return types.slice(start, types.indexOf("\n}\n", start));
};

// 2026-10-02: a plugin opened in a conversation is told an opaque id of it, so what it keeps per
// conversation (a match, a list) stays with that conversation. Absent when there is none.
test("onOpen says which chat the plugin was opened in, when there is one", () => {
  const open = body("PluginOpen");
  assert.match(open, /\n  chat\?: string;/, "an optional string");
  const doc = open.slice(open.lastIndexOf("/**", open.indexOf("chat?:")), open.indexOf("chat?:"));
  assert.match(doc, /absent/i, "it says when it is not there");
  assert.match(doc, /this phone/i, "it says it is this phone's own");
  assert.match(doc, /never send/i, "it says not to send it to the other side");
  assert.match(doc, /key/i, "it says to key what is kept per conversation by it");
});

// 2026-10-03: the app hands every plugin its colours as Ionic's variables on the frame's root, and
// says truthfully whether it is dark. A plugin reads them with a fallback: an older app has none.
const COLOURS = [
  "--ion-background-color",
  "--ion-text-color",
  "--ion-color-medium",
  "--ion-item-background",
  "--ion-border-color",
  "--ion-color-primary",
  "--ion-color-primary-contrast",
  "--ion-color-success",
  "--ion-color-danger",
];

test("onOpen says whether the app is dark and hands its colours", () => {
  const open = body("PluginOpen");
  assert.match(open, /\n  theme\?: Record<string, string>;/, "an optional map of name to colour");
  const doc = (field) => open.slice(open.lastIndexOf("/**", open.indexOf(`${field}:`)), open.indexOf(`${field}:`));
  assert.match(doc("theme?"), /--ion-text-color/, "it names the variables");
  assert.match(doc("theme?"), /canvas/i, "it says who needs them as values");
  assert.match(doc("dark"), /true when the app is dark/i);
});

test("the README lists the colours a plugin may use, with a fallback", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  for (const name of COLOURS) assert.ok(readme.includes(`\`${name}\``), `${name} is listed`);
  assert.match(readme, /var\(--ion-text-color, /, "with a fallback");
  assert.match(readme, /1\.3\.0/, "and from which app");
});
