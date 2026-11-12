import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const types = readFileSync(join(root, "index.d.ts"), "utf8");

const body = (name) => {
  const start = types.indexOf(`export interface ${name} {`);
  assert.ok(start >= 0, `${name} is declared`);
  return types.slice(start, types.indexOf("\n}\n", start));
};

const docAt = (text, at) => {
  const end = text.lastIndexOf("*/", at);
  if (end < 0 || text.slice(end + 2, at).trim() !== "") return "";
  return text.slice(text.lastIndexOf("/**", end) + 3, end).replace(/^\s*\* ?/gm, "").replace(/\s+/g, " ").trim();
};
const docOf = (block, member) => {
  const at = block.indexOf(`\n  ${member}`);
  assert.ok(at >= 0, `${member} is declared`);
  return docAt(block, at);
};
const typeDoc = (declaration) => docAt(types, types.indexOf(declaration));

test("onOpen says which chat the plugin was opened in, when there is one", () => {
  const open = body("PluginOpen");
  assert.match(open, /\n  chat\?: string;/, "an optional string");
  const doc = docOf(open, "chat?:");
  assert.match(doc, /this phone/i, "it is this phone's own");
  assert.match(doc, /never send/i, "so it is never sent to the other side");
});

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
  assert.match(docOf(open, "theme?:"), /--ion-/, "it names the variables");
  assert.match(docOf(open, "theme?:"), /canvas/i, "the values are for drawing on a canvas");
  assert.match(docOf(open, "dark:"), /false/i, "an older app always says light");
  assert.match(docOf(open, "dark:"), /1\.3\.0/, "before which app");
});

test("the README lists the colours a plugin may use, with a fallback", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  for (const name of COLOURS) assert.ok(readme.includes(`\`${name}\``), `${name} is listed`);
  assert.match(readme, /var\(--ion-text-color, /, "with a fallback");
  assert.match(readme, /1\.3\.0/, "and from which app");
});

test("the manifest's translations are typed", () => {
  const locale = body("PluginLocale");
  assert.match(locale, /\n  name\?: string;/);
  assert.match(locale, /\n  summary\?: string;/);
  assert.match(types, /\nexport type PluginLocales = Record<string, PluginLocale>;/);
  const doc = typeDoc("export type PluginLocales");
  assert.match(doc, /zh-CN/, "keyed by the app's language codes");
  assert.match(doc, /English/, "with the English fields as the fallback");
});

test("the README says how to translate a plugin's name and summary", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.match(readme, /"locales"/, "with an example");
  for (const code of ["es", "pt", "fr", "de", "it", "ro", "ru", "uk", "pl", "tr", "ar", "hi", "bn", "id", "vi", "th", "ja", "ko", "zh-CN", "zh-TW"]) {
    assert.ok(readme.includes(`\`${code}\``), `${code} is listed`);
  }
  assert.match(readme, /1\.3\.0/, "and from which app");
});

test("onClose lets a plugin say goodbye when its window closes, on an app that has it", () => {
  const api = body("FlickerTalk");
  assert.match(api, /\n  onClose\?\(handler: \(\) => void \| Promise<void>\): void;/, "an optional method taking a handler");
  const doc = docOf(api, "onClose?(");
  assert.match(doc, /module loads/, "it is registered while the module loads");
  assert.match(doc, /tenths of a second/i, "how little time there is");
  assert.match(doc, /sav(e|ing)/i, "so saving is never left for it");
  assert.match(doc, /if \(ft\.onClose\)/, "how to ask for it");
  assert.match(doc, /1\.3\.0/, "and from which app");
});

test("the README tells how to say goodbye when the window closes", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.ok(readme.includes("`ft.onClose(fn)`"), "it is in the table");
  assert.match(readme, /if \(ft\.onClose\)/, "with the way to ask for it");
});

test("takePhoto opens the phone's camera app, on an app that has it", () => {
  const api = body("FlickerTalk");
  assert.match(api, /\n  takePhoto\?\(\): Promise<PluginFile \| null>;/, "an optional method that resolves like pickFile");
  assert.ok(api.indexOf("takePhoto?(") > api.indexOf("pickFile("), "it sits next to pickFile");
  const doc = docOf(api, "takePhoto?(");
  assert.match(doc, /camera app/i, "the phone's own camera app");
  assert.match(doc, /`null`/, "what backing out or a phone without a camera gives");
  assert.match(doc, /typeof ft\.takePhoto\b/, "how to ask for it");
  assert.match(doc, /1\.4\.1/, "and from which app");
});

test("the README lists takePhoto and how to ask for it", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.ok(readme.includes("`ft.takePhoto()`"), "it is in the table");
  assert.match(readme, /typeof ft\.takePhoto === "function"/, "with the way to ask for it");
  assert.match(readme, /1\.4\.1/, "and from which app");
});

test("notify hands the app a notice to show as a single toast at the top", () => {
  const api = body("FlickerTalk");
  assert.match(
    api,
    /\n  notify\?\(text: string, options\?: \{ sticky\?: boolean \}\): void;/,
    "an optional fire-and-forget method with an optional sticky flag",
  );
  assert.ok(api.indexOf("notify?(") > api.indexOf("say("), "it sits next to say");
  const doc = docOf(api, "notify?(");
  assert.match(doc, /replac/i, "one notice at a time, the new one replaces the last");
  assert.match(doc, /sticky/, "what sticky does");
  assert.match(doc, /notify\(""\)/, "how to clear a sticky notice");
  assert.match(doc, /typeof ft\.notify\b/, "how to ask for it");
  assert.match(doc, /1\.4\.1/, "and from which app");
});

test("the README lists notify and how to ask for it", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.ok(readme.includes("`ft.notify(text, options)`"), "it is in the table");
  assert.match(readme, /typeof ft\.notify === "function"/, "with the way to ask for it");
  assert.match(readme, /notify\(""\)/, "and how to clear a sticky notice");
});

test("the manifest's icon is typed", () => {
  assert.match(types, /\nexport type PluginManifestIcon = string;/);
  assert.match(typeDoc("export type PluginManifestIcon"), /Ionicon/, "an Ionicon's name");
});

test("the README says how to choose the plugin's icon", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.match(readme, /"icon": "[a-z0-9-]+"/, "with an example");
  assert.ok(readme.includes("`extension-puzzle-outline`"), "the tool's fallback");
  assert.ok(readme.includes("`game-controller-outline`"), "the game's fallback");
});

const section = (readme, heading) => {
  const start = readme.indexOf(`\n## ${heading}\n`);
  assert.ok(start >= 0, `the README has a "${heading}" section`);
  const end = readme.indexOf("\n## ", start + 1);
  return readme.slice(start, end === -1 ? readme.length : end);
};

test("the manifest's icon type points at icon.svg", () => {
  const doc = typeDoc("export type PluginManifestIcon");
  assert.match(doc, /`icon\.svg`/, "it names the image");
  assert.match(doc, /fallback|only when|unless/i, "the image wins over the name");
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

test("onOpen says whether the plugin leads or follows a presentation in a call", () => {
  const open = body("PluginOpen");
  assert.match(open, /\n  presenting\?: "lead" \| "follow";/, "an optional lead or follow");
  const doc = docOf(open, "presenting?:");
  assert.match(doc, /call/i, "inside a call");
  assert.match(doc, /"lead"/, "who leads");
  assert.match(doc, /"follow"/, "who follows");
  assert.match(doc, /`live`/, "the two ends talk over live");
});

test("the README tells how a plugin presents in a call", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.match(readme, /`presenting`/, "it names the field");
  assert.match(readme, /"lead"/);
  assert.match(readme, /"follow"/);
  assert.match(readme, /1\.6\.0/, "and from which app");
});

test("onOpen says which Ionic the app lends the frame", () => {
  const open = body("PluginOpen");
  assert.match(open, /\n  ionic\?: PluginIonic;/, "an optional description of the lent Ionic");
  assert.match(docOf(open, "ionic?:"), /data-ionic/, "where the page says it too");
  const ionic = body("PluginIonic");
  assert.match(ionic, /\n  version: string;/);
  assert.match(docOf(ionic, "version:"), /major/i, "a plugin targets the major");
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
  assert.match(docOf(translator, "languages("), /empty/i, "what a phone that cannot translate gives");
  assert.match(docOf(translator, "prepare("), /system sheet/i, "the phone may show its own sheet");
  assert.match(docOf(translator, "remove("), /Android/, "where a pack can be removed");
});

test("ft.translate needs the translate permission, from app 1.7.0", () => {
  const api = body("FlickerTalk");
  assert.match(api, /\n  translate: PluginTranslator;/);
  const doc = docOf(api, "translate:");
  assert.match(doc, /`translate` permission/, "it needs the permission");
  assert.match(doc, /1\.7\.0/, "from which app");
  const translator = typeDoc("export interface PluginTranslator {");
  assert.match(translator, /never leaves the phone/, "the text stays on the phone");
  assert.match(translator, /pair/i, "the state is per pair of languages");
  assert.match(translator, /5 ?000/, "the longest text");
  assert.match(translator, /never throw/i, "a refusal or a failure resolves instead of throwing");
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

const before = docAt;

test("the manifest's hooks are typed: message, composer and settings with its fields", () => {
  assert.match(types, /\nexport type PluginHookName = "message" \| "composer" \| "settings";/);
  const declaration = body("PluginHookDeclaration");
  assert.match(declaration, /\n  label: string;/);
  assert.match(declaration, /\n  icon: string;/);
  const field = body("PluginSettingsField");
  assert.match(field, /\n  key: string;/);
  assert.match(field, /\n  type: "select" \| "toggle";/);
  assert.match(field, /\n  label: string;/);
  const opening = "export interface PluginSettingsDeclaration extends PluginHookDeclaration {";
  assert.ok(types.includes(`\n${opening}`), "the settings extend a hook's declaration");
  const settings = types.slice(types.indexOf(opening), types.indexOf("\n}\n", types.indexOf(opening)));
  assert.match(settings, /\n  fields: PluginSettingsField\[\];/);
  assert.match(settings, /\n  note\?: string;/);
  const hooks = body("PluginManifestHooks");
  assert.match(hooks, /\n  message\?: PluginHookDeclaration;/);
  assert.match(hooks, /\n  composer\?: PluginHookDeclaration;/);
  assert.match(hooks, /\n  settings\?: PluginSettingsDeclaration;/);
  const doc = before(types, types.indexOf("export interface PluginManifestHooks {"));
  assert.match(doc, /tools only/i, "it says a game may not");
  assert.match(doc, /messages: "given"/, "what message and composer need");
  assert.match(doc, /send: "propose"/, "and what composer needs too");
  assert.match(doc, /1\.7\.0/, "from which app");
  assert.ok(!/\bchat hook|`chat`/.test(doc), "no chat hook any more");
  const locale = body("PluginLocale");
  assert.ok(locale.includes("\n  hooks?: { message?: string; composer?: string; settings?: { label?: string; fields?: Record<string, string>; note?: string } };"), "the labels in other languages");
});

test("a hook run hands the tool the text, the chat's key, the message, the language, who started it and the settings' values", () => {
  const hook = body("PluginHook");
  for (const field of ["name: PluginHookName;", "text: string;", "chat: string;", "ref: string | null;", "lang: string;", "manual: boolean;", "answer?: boolean;", "values?: Record<string, string | boolean>;"]) {
    assert.ok(hook.includes(`\n  ${field}`), `${field} is declared`);
  }
  const doc = (field) => before(hook, hook.indexOf(`\n  ${field}`));
  assert.match(doc("text:"), /last 5 texts/, "what settings gets on the hidden run");
  assert.match(doc("chat:"), /PluginOpen\.chat/, "the same key as onOpen's");
  assert.match(doc("ref:"), /PluginOpen\.ref/);
  assert.match(doc("answer?:"), /`ask`/, "it is the answer to the question");
  assert.match(doc("values?:"), /changed/, "the values the user changed");
});

test("a hook run says what the tool runs on: an Android phone, an iPhone or a desktop", () => {
  const hook = body("PluginHook");
  assert.ok(hook.includes('\n  platform: "android" | "ios" | "desktop";'), "platform is declared");
  const doc = before(hook, hook.indexOf("\n  platform:"));
  assert.match(doc, /iPad/, "an iPad is ios too");
  assert.match(doc, /own sheet/, "iOS asks before a download by itself");
  assert.match(doc, /Android/, "Android does not, so the tool asks there");
});

test("the README says a hook tells the platform, and that an iPhone asks before a download by itself", () => {
  const text = section(readFileSync(join(root, "README.md"), "utf8"), "Chat hooks").replace(/\s+/g, " ");
  assert.ok(text.includes("`platform`"), "it names the field");
  for (const value of ['`"android"`', '`"ios"`', '`"desktop"`']) assert.ok(text.includes(value), `it names ${value}`);
  assert.match(text, /own sheet/, "that iOS asks by itself, so the tool does not ask first");
});

test("a hook gives back a text, the settings' values and options, the chat's language, what runs on its own, or a question", () => {
  const result = body("PluginHookResult");
  for (const field of [
    "text?: string;",
    "lang?: string | null;",
    "auto?: { message?: boolean; composer?: boolean };",
    "ask?: { text: string };",
    "values?: Record<string, string | boolean>;",
    "options?: Record<string, { value: string; label: string }[]>;",
  ]) {
    assert.ok(result.includes(`\n  ${field}`), `${field} is declared`);
  }
  const doc = (field) => before(result, result.indexOf(`\n  ${field}`));
  assert.match(doc("lang?:"), /null/, "how to say there is none");
  assert.match(doc("ask?:"), /alert/, "how the app asks it");
  assert.match(doc("ask?:"), /answer: true/, "and what it does on yes");
  assert.match(doc("options?:"), /select/, "the options of a select field");
});

test("onHook and show are typed, and onOpen says which hook brought the window up", () => {
  const api = body("FlickerTalk");
  assert.ok(api.includes("\n  onHook(handler: (hook: PluginHook) => Promise<PluginHookResult | null>): void;"), "onHook is declared");
  assert.ok(api.includes("\n  show(): void;"), "show is declared");
  const doc = (method) => before(api, api.indexOf(`\n  ${method}(`));
  assert.match(doc("onHook"), /module loads/, "registered while the module loads");
  assert.match(doc("onHook"), /5 minutes/, "the limit");
  assert.match(doc("onHook"), /null/, "what to give when there is nothing to show");
  assert.match(doc("show"), /hidden/);
  assert.match(doc("show"), /no-op/i, "and what it does otherwise");
  const opened = body("PluginOpen");
  assert.match(opened, /\n  hook\?: PluginHookName;/);
  assert.match(before(opened, opened.indexOf("\n  hook?:")), /show\(\)/);
  assert.match(before(opened, opened.indexOf("\n  chat?:")), /PluginHook\.chat/, "the chat's key is the same in a hook");
});

test("the README lists onHook and show", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.ok(readme.split("\n").some((line) => line.startsWith("| `ft.onHook(fn)` |")), "onHook is in the table");
  assert.ok(readme.split("\n").some((line) => line.startsWith("| `ft.show()` |")), "show is in the table");
});

test("the README explains the three hooks and how settings run", () => {
  const text = section(readFileSync(join(root, "README.md"), "utf8"), "Chat hooks").replace(/\s+/g, " ");
  assert.ok(text.includes('"hooks": {'), "how to declare them in module.json");
  assert.ok(text.includes('"minCoreVersion": "1.7.0"'), "and from which app");
  for (const name of ["`message`", "`composer`", "`settings`"]) assert.ok(text.includes(name), `it explains ${name}`);
  assert.match(text, /inside each received text message/, "where message appears");
  assert.match(text, /See original/, "a translated message keeps its original a tap away");
  assert.match(text, /no button/, "composer has no button: the app runs it on its own");
  assert.match(text, /contact's or circle's page/, "where settings appear");
  assert.ok(text.includes('"type": "select"') && text.includes('"type": "toggle"'), "the two kinds of field");
  assert.ok(text.includes("`manual: false`") && text.includes("`manual: true`"), "the two settings runs");
  assert.match(text, /last 5 texts received/, "what the hidden run gets");
  for (const field of ["`values`", "`options`", "`auto`", "`lang`", "`ask`", "`answer: true`"]) assert.ok(text.includes(field), `it explains ${field}`);
  assert.match(text, /alert/, "where the app asks the question");
  assert.match(text, /hidden/, "that the app runs the tool hidden");
  assert.match(text, /5 minutes/, "the limit");
  assert.ok(text.includes('messages: "given"') && text.includes('send: "propose"'), "the permissions they need");
  assert.ok(text.includes('"locales"'), "how to translate the labels");
  assert.match(text, /Premium/, "that hooks come with Premium, like every tool");
  assert.match(text, /game/, "that a game may not");
  assert.ok(!/header|`chat` hook|"chat":/.test(text), "no header icon and no chat hook any more");
  assert.ok(!/forever/i.test(text), "never 'forever'");
});
