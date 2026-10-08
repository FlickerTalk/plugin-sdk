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

// 2026-10-02 (plan of the games): a plugin is a tool unless it says it is a game. A game may talk
// to its twin and write in the chat, and nothing else; it is never handed a file. The same cases
// as `ft-plugins` (`a_game_may_ask_only_for_the_live_channel_and_sending`).
const chess = {
  id: "com.flickertalk.game.chess",
  name: "Chess",
  version: "1.0.0",
  minCoreVersion: "1.3.0",
  components: ["ft-chess"],
  kind: "game",
  permissions: { live: true, send: "propose" },
};

test("a plugin says whether it is a tool or a game", () => {
  assert.ok(validate(chess), JSON.stringify(validate.errors));
  assert.ok(validate({ ...board, kind: "tool" }), JSON.stringify(validate.errors));
  assert.ok(validate(board), "a tool unless it says otherwise");
  assert.ok(!validate({ ...board, kind: "widget" }), "a kind the app does not know");
});

test("a game may ask only for the live channel and sending, and opens no file", () => {
  assert.ok(validate((({ permissions, ...rest }) => rest)(chess)), JSON.stringify(validate.errors));
  for (const wrong of [
    { network: ["api.example.com"] },
    { messages: "given" },
    { print: true },
    { remind: true },
    { drive: true },
    { storage: "large" },
    // It proposes a line for the chat; it never sends on the user's behalf.
    { send: "auto" },
  ]) {
    const game = { ...chess, permissions: { live: true, ...wrong } };
    assert.ok(!validate(game), `a game with ${JSON.stringify(wrong)} should be refused`);
    assert.ok(validate({ ...game, kind: "tool" }), `a tool with ${JSON.stringify(wrong)} is fine`);
  }
  for (const wrong of [{ opens: ["image/*"] }, { opens: ["application/x-ftchess"], views: ["application/x-ftchess"] }]) {
    assert.ok(!validate({ ...chess, ...wrong }), `a game with ${JSON.stringify(wrong)} should be refused`);
    assert.ok(validate({ ...chess, ...wrong, kind: "tool" }), `a tool with ${JSON.stringify(wrong)} is fine`);
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

// 2026-10-02 (plan of the catalogue's translations, option A): a plugin may give its name and its
// summary in the app's other languages. The top-level ones stay required and in English: they are
// the fallback, and what an app older than 1.3.0 shows. The same limits as `ft-plugins`.
const LANGUAGES = ["es", "pt", "fr", "de", "it", "ro", "ru", "uk", "pl", "tr", "ar", "hi", "bn", "id", "vi", "th", "ja", "ko", "zh-CN", "zh-TW"];

test("a plugin may give its name and summary in the app's languages", () => {
  const translated = {
    ...chess,
    summary: "Chess with the other person in the chat.",
    locales: { es: { name: "Ajedrez", summary: "Ajedrez con la otra persona del chat." }, "zh-TW": { name: "西洋棋" } },
  };
  assert.ok(validate(translated), JSON.stringify(validate.errors));
  // Markdown and PDF keep their name: a language may carry the summary alone.
  assert.ok(validate({ ...manifest, locales: { de: { summary: "Übersetzt eine Nachricht." } } }), JSON.stringify(validate.errors));
  assert.ok(validate({ ...manifest, locales: Object.fromEntries(LANGUAGES.map((code) => [code, { name: "x".repeat(64), summary: "y".repeat(200) }])) }), JSON.stringify(validate.errors));
  // A language the app does not speak yet is fine: the app looks up only its own.
  assert.ok(validate({ ...manifest, locales: { nl: { name: "Vertaler" }, "pt-BR": { name: "Tradutor" }, "zh-Hant": { name: "翻譯" } } }), JSON.stringify(validate.errors));
  assert.ok(validate(manifest), "a manifest without locales is still valid");
});

test("a translated name or summary keeps the limits of the English one", () => {
  for (const wrong of [
    { es: { name: "" } },
    { es: { name: "   " } },
    { es: { name: "x".repeat(65) } },
    { es: { summary: "" } },
    { es: { summary: "y".repeat(201) } },
    { es: { name: 7 } },
    { es: { name: "Traductor", description: "no" } },
    { es: "Traductor" },
    // The English text is the top-level one; there is no second place for it.
    { en: { name: "Translator" } },
    // A language tag, as the app spells it: lowercase language, uppercase region.
    { ES: { name: "Traductor" } },
    { "zh-cn": { name: "翻译" } },
    { zh_CN: { name: "翻译" } },
    { spanish: { name: "Traductor" } },
    { "": { name: "Traductor" } },
  ]) {
    assert.ok(!validate({ ...manifest, locales: wrong }), `${JSON.stringify(wrong)} should be refused`);
  }
  const tooMany = Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`l${String.fromCharCode(97 + (index % 26))}${String.fromCharCode(97 + Math.floor(index / 26))}`, { name: "x" }]));
  assert.equal(Object.keys(tooMany).length, 65);
  assert.ok(!validate({ ...manifest, locales: tooMany }), "no more than 64 languages");
});

// 2026-10-08 (plan of the Apps grid, decision 2): a plugin may name the Ionicon the app shows for
// it in its Apps grid and sheets. Only a name, never a path or a file: the app draws its own copy.
test("a plugin may name the Ionicon the app shows for it", () => {
  assert.ok(validate({ ...manifest, icon: "image-outline" }), JSON.stringify(validate.errors));
  assert.ok(validate({ ...chess, icon: "shield-outline" }), JSON.stringify(validate.errors));
  assert.ok(validate({ ...manifest, icon: "x".repeat(64) }), JSON.stringify(validate.errors));
  assert.ok(validate(manifest), "a manifest without icon is still valid");
  for (const wrong of ["Icon-Outline", "image outline", "x".repeat(65), "../x", "icon/image-outline.svg", "", 7]) {
    assert.ok(!validate({ ...manifest, icon: wrong }), `icon ${JSON.stringify(wrong)} should be refused`);
  }
});
