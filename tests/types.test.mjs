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

// 2026-10-20 (app#177): on-device translation. The core serves it with the phone's translator
// (Translation on iOS, ML Kit on Android); the state is per pair of languages because Apple only
// gives it that way, and the flow is explicit: detect → status → prepare → translate.
test("the translator's state of a pair of languages is typed", () => {
  assert.match(types, /\nexport type PluginTranslationStatus = "installed" \| "downloadable" \| "unsupported";/);
});

test("the translator has the six calls of the contract, with their shapes", () => {
  const translator = body("PluginTranslator");
  for (const signature of [
    "languages(): Promise<string[]>;",
    "detect(text: string): Promise<string | null>;",
    "status(from: string, to: string): Promise<PluginTranslationStatus>;",
    "prepare(from: string, to: string): Promise<boolean>;",
    "remove(from: string, to: string): Promise<boolean>;",
    "translate(text: string, from: string, to: string): Promise<string | null>;",
  ]) {
    assert.ok(translator.includes(`\n  ${signature}`), `${signature} is declared`);
  }
  const doc = (method) => translator.slice(translator.lastIndexOf("/**", translator.indexOf(`\n  ${method}(`)), translator.indexOf(`\n  ${method}(`));
  assert.match(doc("languages"), /empty/i, "it says what a phone that cannot translate gives");
  assert.match(doc("prepare"), /system sheet/i, "it says the phone may show its own sheet");
  assert.match(doc("remove"), /Android/, "it says where a pack can be removed");
  assert.match(doc("translate"), /required/i, "it says both languages are given");
});

test("ft.translate needs the translate permission, from app 1.7.0", () => {
  const api = body("FlickerTalk");
  assert.match(api, /\n  translate: PluginTranslator;/);
  const doc = api.slice(api.lastIndexOf("/**", api.indexOf("\n  translate:")), api.indexOf("\n  translate:"));
  assert.match(doc, /Needs the `translate` permission/);
  assert.match(doc, /1\.7\.0/, "from which app");
  const translator = types.slice(types.lastIndexOf("/**", types.indexOf("export interface PluginTranslator {")), types.indexOf("export interface PluginTranslator {"));
  assert.match(translator, /never leaves the phone/, "it says the text stays on the phone");
  assert.match(translator, /per pair/i, "it says the state is per pair of languages");
  assert.match(translator, /5 ?000/, "it gives the longest text");
  assert.match(translator, /never throws/i, "it says what a refusal or a failure gives");
});

test("the README lists ft.translate with its permission", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const row = readme.split("\n").find((line) => line.startsWith("| `ft.translate."));
  assert.ok(row, "it is in the table");
  assert.ok(row.includes("`ft.translate.languages/detect/status/prepare/remove/translate`"), "with its six calls");
  assert.match(row, /\| `translate` \|$/, "and its permission");
});

test("the README explains on-device translation: the flow, the pair, the limits and the privacy", () => {
  const text = section(readFileSync(join(root, "README.md"), "utf8"), "On-device translation").replace(/\s+/g, " ");
  assert.ok(text.includes('"translate": true'), "how to ask for it in module.json");
  assert.ok(text.includes('"minCoreVersion": "1.7.0"'), "and from which app");
  for (const call of ["languages()", "detect(text)", "status(from, to)", "prepare(from, to)", "translate(text, from, to)", "remove(from, to)"]) {
    assert.ok(text.includes(`\`${call}\``), `it explains ${call}`);
  }
  assert.ok(text.indexOf("`detect(text)`") < text.indexOf("`status(from, to)`"), "detect, then status");
  assert.ok(text.indexOf("`status(from, to)`") < text.indexOf("`prepare(from, to)`"), "status, then prepare");
  assert.ok(text.indexOf("`prepare(from, to)`") < text.indexOf("`translate(text, from, to)`"), "prepare, then translate");
  assert.match(text, /per pair of languages/, "the state is per pair");
  for (const status of ['"installed"', '"downloadable"', '"unsupported"']) assert.ok(text.includes(`\`${status}\``), `it says what ${status} means`);
  assert.match(text, /5 000 characters/, "the longest text");
  assert.match(text, /never throws/, "what a refusal or a failure gives");
  assert.ok(text.includes("The text never leaves the phone."));
  assert.ok(text.includes("On iPhone the translation is done by iOS."));
  assert.ok(text.includes("On Android the translator is Google's ML Kit, built into the app: the text stays on the phone. Google receives which languages are used and diagnostic data about the app, not the text."));
  assert.match(text, /downloaded once from Apple or Google/, "where the language packs come from");
});

// 2026-10-20 (app#177, chat hooks): a tool binds to the chat's hooks in module.json; the app runs
// it hidden, hands it the hook with `onHook` and waits for its result. `show()` brings the window
// up when the tool needs to ask the user something.
test("the manifest's hooks are typed: three names, each with a label and an icon", () => {
  assert.match(types, /\nexport type PluginHookName = "message" \| "composer" \| "chat";/);
  const declaration = body("PluginHookDeclaration");
  assert.match(declaration, /\n  label: string;/);
  assert.match(declaration, /\n  icon: string;/);
  assert.match(types, /\nexport type PluginManifestHooks = Partial<Record<PluginHookName, PluginHookDeclaration>>;/);
  const at = types.indexOf("export type PluginManifestHooks");
  const doc = types.slice(types.lastIndexOf("/**", at), at);
  assert.match(doc, /tools only/i, "it says a game may not");
  assert.match(doc, /messages: "given"/, "what message and composer need");
  assert.match(doc, /send: "propose"/, "and what composer needs too");
  assert.match(doc, /1\.7\.0/, "from which app");
  assert.match(body("PluginLocale"), /\n  hooks\?: Partial<Record<PluginHookName, string>>;/, "the labels in other languages");
});

test("a hook run hands the tool the text, the chat's key, the message, the language and who started it", () => {
  const hook = body("PluginHook");
  for (const field of ["name: PluginHookName;", "text: string;", "chat: string;", "ref: string | null;", "lang: string;", "manual: boolean;"]) {
    assert.ok(hook.includes(`\n  ${field}`), `${field} is declared`);
  }
  const doc = (field) => hook.slice(hook.lastIndexOf("/**", hook.indexOf(`\n  ${field}:`)), hook.indexOf(`\n  ${field}:`));
  assert.match(doc("text"), /"" for `chat`/, "the chat's row has no text");
  assert.match(doc("chat"), /PluginOpen\.chat/, "the same key as onOpen's");
  assert.match(doc("ref"), /PluginOpen\.ref/);
  assert.match(doc("manual"), /automatic/, "false means automatic");
  const result = body("PluginHookResult");
  assert.match(result, /\n  text\?: string;/);
  assert.match(result, /\n  auto\?: \{ message\?: boolean; composer\?: boolean \};/);
});

test("onHook and show are typed, and onOpen says which hook opened the window", () => {
  const api = body("FlickerTalk");
  assert.ok(api.includes("\n  onHook(handler: (hook: PluginHook) => Promise<PluginHookResult | null>): void;"), "onHook is declared");
  assert.ok(api.includes("\n  show(): void;"), "show is declared");
  const doc = (method) => api.slice(api.lastIndexOf("/**", api.indexOf(`\n  ${method}(`)), api.indexOf(`\n  ${method}(`));
  assert.match(doc("onHook"), /once per hook run/i);
  assert.match(doc("onHook"), /Register it while the module loads/);
  assert.match(doc("onHook"), /5 minutes/, "the limit");
  assert.match(doc("onHook"), /null/, "what to give when there is nothing to show");
  assert.match(doc("show"), /hidden/);
  assert.match(doc("show"), /no-op/i, "and what it does otherwise");
  const opened = body("PluginOpen");
  assert.match(opened, /\n  hook\?: PluginHookName;/);
  const hookDoc = opened.slice(opened.lastIndexOf("/**", opened.indexOf("\n  hook?:")), opened.indexOf("\n  hook?:"));
  assert.match(hookDoc, /`chat` hook/);
  assert.match(hookDoc, /show\(\)/);
  const chatDoc = opened.slice(opened.lastIndexOf("/**", opened.indexOf("\n  chat?:")), opened.indexOf("\n  chat?:"));
  assert.match(chatDoc, /PluginHook\.chat/, "the chat's key is the same in a hook");
});

test("the README lists onHook and show", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.ok(readme.split("\n").some((line) => line.startsWith("| `ft.onHook(fn)` |")), "onHook is in the table");
  assert.ok(readme.split("\n").some((line) => line.startsWith("| `ft.show()` |")), "show is in the table");
});

test("the README explains the chat hooks", () => {
  const text = section(readFileSync(join(root, "README.md"), "utf8"), "Chat hooks").replace(/\s+/g, " ");
  assert.ok(text.includes('"hooks": {'), "how to declare them in module.json");
  assert.ok(text.includes('"minCoreVersion": "1.7.0"'), "and from which app");
  for (const name of ["`message`", "`composer`", "`chat`"]) assert.ok(text.includes(name), `it explains ${name}`);
  assert.match(text, /held/, "where message appears");
  assert.match(text, /composer/, "where composer appears");
  assert.match(text, /hidden/, "that the app runs the tool hidden");
  assert.ok(text.includes("`ft.show()`"), "and how it comes into view");
  assert.match(text, /5 minutes/, "the limit");
  assert.ok(text.includes("`auto`"), "the automatic runs");
  assert.ok(text.includes('messages: "given"') && text.includes('send: "propose"'), "the permissions they need");
  assert.ok(text.includes('"locales"'), "how to translate the labels");
  assert.match(text, /Premium/, "that hooks come with Premium, like every tool");
  assert.match(text, /game/, "that a game may not");
  assert.ok(!/forever/i.test(text), "never 'forever'");
});
