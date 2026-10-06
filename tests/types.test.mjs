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

// 2026-10-02: module.json may carry the name and the summary in other languages (`locales`); the
// app shows them from 1.3.0 and falls back to the English ones.
test("the manifest's translations are typed", () => {
  const locale = body("PluginLocale");
  assert.match(locale, /\n  name\?: string;/);
  assert.match(locale, /\n  summary\?: string;/);
  assert.match(types, /\nexport type PluginLocales = Record<string, PluginLocale>;/);
  const at = types.indexOf("export type PluginLocales");
  const doc = types.slice(types.lastIndexOf("/**", at), at);
  assert.match(doc, /zh-CN/, "it names the codes");
  assert.match(doc, /English/, "it says what is shown without one");
});

test("the README says how to translate a plugin's name and summary", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.match(readme, /"locales"/, "with an example");
  for (const code of ["es", "pt", "fr", "de", "it", "ro", "ru", "uk", "pl", "tr", "ar", "hi", "bn", "id", "vi", "th", "ja", "ko", "zh-CN", "zh-TW"]) {
    assert.ok(readme.includes(`\`${code}\``), `${code} is listed`);
  }
  assert.match(readme, /1\.3\.0/, "and from which app");
});

// 2026-10-02: the app tells the plugin its window is closing (the app's ✕, Android's Back, leaving
// the chat), so a live session can say goodbye to its twin. Additive: an older app does not have
// it, so it is optional and the plugin asks for it first.
test("onClose lets a plugin say goodbye when its window closes, on an app that has it", () => {
  const api = body("FlickerTalk");
  assert.match(api, /\n  onClose\?\(handler: \(\) => void \| Promise<void>\): void;/, "an optional method taking a handler");
  const doc = api.slice(api.lastIndexOf("/**", api.indexOf("onClose?(")), api.indexOf("onClose?("));
  assert.match(doc, /tenths of a second/i, "it says how little time there is");
  assert.match(doc, /saving|save/i, "it says to keep saving at once, as always");
  assert.match(doc, /goodbye/i, "it says what it is for");
  assert.match(doc, /if \(ft\.onClose\)/, "it says how to ask for it");
  assert.match(doc, /1\.3\.0/, "and from which app");
});

test("the README tells how to say goodbye when the window closes", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.ok(readme.includes("`ft.onClose(fn)`"), "it is in the table");
  assert.match(readme, /if \(ft\.onClose\)/, "with the way to ask for it");
});

// 2026-10-06: a plugin may ask the app to open the phone's camera app, so the user takes the photo
// directly instead of looking for it in the gallery. Additive: an app before 1.4.1 does not have
// it, so it is optional and the plugin asks for it first.
test("takePhoto opens the phone's camera app, on an app that has it", () => {
  const api = body("FlickerTalk");
  assert.match(api, /\n  takePhoto\?\(\): Promise<PluginFile \| null>;/, "an optional method that resolves like pickFile");
  assert.ok(api.indexOf("takePhoto?(") > api.indexOf("pickFile("), "it sits next to pickFile");
  const doc = api.slice(api.lastIndexOf("/**", api.indexOf("takePhoto?(")), api.indexOf("takePhoto?("));
  assert.match(doc, /camera app/i, "it says it is the phone's own camera app");
  assert.match(doc, /`null`/, "it says what backing out gives");
  assert.match(doc, /no camera/i, "it says a phone without a camera gives null too");
  assert.match(doc, /typeof ft\.takePhoto === "function"/, "it says how to ask for it");
  assert.match(doc, /1\.4\.1/, "and from which app");
});

test("the README lists takePhoto and how to ask for it", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.ok(readme.includes("`ft.takePhoto()`"), "it is in the table");
  assert.match(readme, /typeof ft\.takePhoto === "function"/, "with the way to ask for it");
  assert.match(readme, /1\.4\.1/, "and from which app");
});

// 2026-10-06: a plugin or a game hands the app a short notice and the app shows it as a toast.
// The app owns the toast (one at a time, at the top, over the content), so no plugin builds its
// own. Additive: an app before 1.4.1 does not have it, so it is optional and asked for first.
test("notify hands the app a notice to show as a single toast at the top", () => {
  const api = body("FlickerTalk");
  assert.match(
    api,
    /\n  notify\?\(text: string, options\?: \{ sticky\?: boolean \}\): void;/,
    "an optional fire-and-forget method with an optional sticky flag",
  );
  assert.ok(api.indexOf("notify?(") > api.indexOf("say("), "it sits next to say");
  const doc = api.slice(api.lastIndexOf("/**", api.indexOf("notify?(")), api.indexOf("notify?("));
  assert.match(doc, /toast/i, "it says the app shows a toast");
  assert.match(doc, /top/i, "at the top of the screen");
  assert.match(doc, /replac/i, "replacing the previous notice");
  assert.match(doc, /sticky/, "it says what sticky does");
  assert.match(doc, /notify\(""\)/, "and how to clear a sticky notice");
  assert.match(doc, /no permission/i, "it needs no permission");
  assert.match(doc, /typeof ft\.notify === "function"/, "it says how to ask for it");
  assert.match(doc, /1\.4\.1/, "and from which app");
});

test("the README lists notify and how to ask for it", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.ok(readme.includes("`ft.notify(text, options)`"), "it is in the table");
  assert.match(readme, /typeof ft\.notify === "function"/, "with the way to ask for it");
  assert.match(readme, /notify\(""\)/, "and how to clear a sticky notice");
});
