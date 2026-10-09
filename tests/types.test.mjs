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

// 2026-10-08 (plan of the Apps grid, decision 2): `icon` in module.json names the Ionicon the app
// shows for the plugin; without it the app shows a generic tool or game icon.
test("the manifest's icon is typed", () => {
  assert.match(types, /\nexport type PluginManifestIcon = string;/);
  const at = types.indexOf("export type PluginManifestIcon");
  const doc = types.slice(types.lastIndexOf("/**", at), at);
  assert.match(doc, /Ionicon/, "it says it is an Ionicon's name");
  assert.match(doc, /image-outline/, "with an example");
  assert.match(doc, /\^\[a-z0-9-\]\+\$/, "it gives the pattern");
  assert.match(doc, /generic/i, "it says what is shown without one");
});

test("the README says how to choose the plugin's icon", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.match(readme, /"icon": "[a-z0-9-]+"/, "with an example");
  assert.ok(readme.includes("`extension-puzzle-outline`"), "the tool's fallback");
  assert.ok(readme.includes("`game-controller-outline`"), "the game's fallback");
});

// 2026-10-08 (plan of the Apps grid, "a plugin's image"): a package may carry its own `icon.svg`;
// the manifest's `icon` stays as the fallback. The README gives the rules the app applies when it
// opens the package and the tool that makes and checks one.
const section = (readme, heading) => {
  const start = readme.indexOf(`\n## ${heading}\n`);
  assert.ok(start >= 0, `the README has a "${heading}" section`);
  const end = readme.indexOf("\n## ", start + 1);
  return readme.slice(start, end === -1 ? readme.length : end);
};

test("the manifest's icon type points at icon.svg", () => {
  const at = types.indexOf("export type PluginManifestIcon");
  const doc = types.slice(types.lastIndexOf("/**", at), at);
  assert.match(doc, /`icon\.svg`/, "it names the image");
  assert.match(doc, /fallback/i, "it says the name is the fallback");
});

test("the README's package layout lists icon.svg next to module.json and dist", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const layout = readme.slice(readme.indexOf("```\nmodule.json"), readme.indexOf("```", readme.indexOf("```\nmodule.json") + 3));
  assert.match(layout, /module\.json/);
  assert.match(layout, /dist\/index\.js/);
  assert.match(layout, /icon\.svg/);
});

test("the README gives the rules of icon.svg", () => {
  const icon = section(readFileSync(join(root, "README.md"), "utf8"), "The plugin's icon");
  assert.match(icon, /`icon\.svg`/);
  assert.match(icon, /signed/i, "it is signed with the rest");
  assert.match(icon, /64 px/, "the tile size");
  assert.match(icon, /radius (of )?18/i, "the rounded square");
  assert.match(icon, /4096 bytes/);
  assert.ok(icon.includes("`0 0 64 64`"), "the viewBox");
  for (const element of ["svg", "g", "title", "desc", "defs", "path", "rect", "circle", "ellipse", "line", "polyline",
    "polygon", "linearGradient", "radialGradient", "stop", "clipPath", "mask"]) {
    assert.ok(icon.includes(`\`${element}\``), `${element} is in the whitelist`);
  }
  for (const word of ["`on*`", "`href`", "`xlink:href`", "`style`", "CDATA", "DOCTYPE", "entit", "url(#"]) {
    assert.ok(icon.includes(word), `it mentions ${word}`);
  }
  assert.match(icon, /whole package/i, "a bad icon rejects the package");
  assert.match(icon, /fallback/i, "the Ionicon name stays as the fallback");
});

test("the README says how to make and check an icon with the tool", () => {
  const icon = section(readFileSync(join(root, "README.md"), "utf8"), "The plugin's icon");
  assert.ok(icon.includes("npm run icon -- image '#DB2777' icon.svg"));
  assert.ok(icon.includes("npm run icon -- --check icon.svg"));
  assert.ok(icon.includes("--ionicons"));
  assert.ok(icon.includes("tools/make-icon.mjs"));
});

test("the README suggests the twelve colours of the app's own icons", () => {
  const icon = section(readFileSync(join(root, "README.md"), "utf8"), "The plugin's icon");
  const palette = {
    red: "#DC2626", orange: "#EA580C", amber: "#D97706", green: "#16A34A", teal: "#0D9488", sky: "#0284C7",
    blue: "#2563EB", indigo: "#4F46E5", violet: "#7C3AED", fuchsia: "#C026D3", pink: "#DB2777", slate: "#475569",
  };
  for (const [name, hex] of Object.entries(palette)) {
    assert.match(icon, new RegExp(`${name}\\b[^\\n]*${hex}`, "i"), `${name} ${hex}`);
  }
  assert.match(icon, /suggest/i, "a suggestion, not a rule");
});

// 2026-10-09 (Ioan): the app lends its own Ionic to every frame, from app 1.6.0. A plugin is told
// which (`onOpen`'s `ionic`, and `data-ionic` on the frame's root) and finds the controllers on
// `ftIonic`; it targets the major version and never bundles Ionic itself.
test("onOpen says which Ionic the app lends the frame", () => {
  const open = body("PluginOpen");
  assert.match(open, /\n  ionic\?: PluginIonic;/, "an optional description of the lent Ionic");
  const doc = open.slice(open.lastIndexOf("/**", open.indexOf("ionic?:")), open.indexOf("ionic?:"));
  assert.match(doc, /1\.6\.0/, "from which app");
  assert.match(doc, /data-ionic/, "where the page says it too");
  const ionic = body("PluginIonic");
  assert.match(ionic, /\n  version: string;/);
  assert.match(ionic.slice(0, ionic.indexOf("version:")), /major/i, "it says a plugin targets the major");
});

test("the lent Ionic's controllers and helpers are typed on a global of their own", () => {
  const lent = body("FtIonic");
  for (const member of ["version", "ionicons", "components", "icons", "alertController", "toastController", "actionSheetController", "modalController", "popoverController", "loadingController", "addIcons", "getMode"]) {
    assert.match(lent, new RegExp(`\\n  (readonly )?${member}[?]?:`), `${member} is declared`);
  }
  assert.match(types, /\n  var ftIonic: FtIonic \| undefined;/, "absent on an older app");
});

test("the README says how to use the Ionic the app lends, in English", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const start = readme.indexOf("## Ionic, lent by the app");
  assert.ok(start >= 0, "the section is there");
  const section = readme.slice(start, readme.indexOf("\n## ", start + 1));
  for (const needed of [
    "9.0.4", "major", "data-ionic", "ftIonic", "minCoreVersion", "1.6.0",
    "ion-alert", "ion-toast", "ion-action-sheet", "ion-modal",
    "mode", "dir", "--ion-text-color-rgb", "data-fill",
    "<ion-icon name=", "light DOM",
  ]) {
    assert.ok(section.includes(needed), `it says ${needed}`);
  }
  assert.match(section, /must not bundle/i, "packages must not carry Ionic");
  assert.match(section, /<form>/, "the form gotcha");
  assert.match(section, /Android/, "where the form gotcha bites");
  assert.match(section, /confirm\(\)/, "window.confirm answers false in the sandbox");
});
