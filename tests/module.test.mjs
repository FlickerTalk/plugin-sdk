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
    { translate: true },
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

// 2026-10-20 (app#177): the translator asks to translate text with the phone's own translator.
// A yes or a no, like location; a game may not ask for it (it only talks to its twin and the chat).
test("a plugin may ask to translate text on the phone, and only as a yes or a no", () => {
  const translate = {
    id: "com.flickertalk.translate",
    name: "Translator",
    version: "1.0.0",
    minCoreVersion: "1.7.0",
    components: ["ft-translate"],
    opens: ["text/plain"],
    permissions: { messages: "given", translate: true, send: "propose", storage: "small" },
  };
  assert.ok(validate(translate), JSON.stringify(validate.errors));
  assert.ok(validate({ ...translate, permissions: { translate: false } }), JSON.stringify(validate.errors));
  for (const wrong of [
    { ...translate, permissions: { translate: "always" } },
    { ...translate, permissions: { translate: 1 } },
    { ...translate, permissions: { translate: "true" } },
    { ...chess, permissions: { live: true, translate: true } },
  ]) {
    assert.equal(validate(wrong), false, JSON.stringify(wrong));
  }
  const permission = schema.properties.permissions.properties.translate;
  assert.match(permission.description, /never leaves the phone/, "it says the text stays on the phone");
  assert.match(permission.description, /Apple or Google/, "it says where the language packs come from");
  assert.match(permission.description, /ML Kit/, "it names Android's translator");
  assert.match(permission.description, /not the text/, "it says what Google receives, and what not");
  assert.match(permission.description, /2026-10-20/);
});

// 2026-10-20 (app#177, chat hooks): a tool may bind to the chat's hooks: a button on a held
// message, a button in the composer, and a row in the chat's options. The app runs it hidden and
// knows nothing of what it does. Hooks that read the text need `messages: "given"`; the composer's
// also needs `send: "propose"`. Never a game. The same cases as `ft-plugins`.
const hooked = {
  id: "com.flickertalk.translate",
  name: "Translator",
  version: "1.1.0",
  minCoreVersion: "1.7.0",
  components: ["ft-translate"],
  hooks: {
    message: { label: "Translate", icon: "language-outline" },
    composer: { label: "Translate", icon: "language-outline" },
    chat: { label: "Chat language", icon: "language-outline" },
  },
  permissions: { messages: "given", translate: true, send: "propose", storage: "small" },
};

test("a tool may bind to the chat's hooks, each with a label and a lent icon", () => {
  assert.ok(validate(hooked), JSON.stringify(validate.errors));
  assert.ok(validate({ ...hooked, kind: "tool" }), JSON.stringify(validate.errors));
  assert.ok(validate({ ...hooked, hooks: { message: hooked.hooks.message } }), JSON.stringify(validate.errors));
  assert.ok(validate({ ...hooked, hooks: { message: { label: "x".repeat(64), icon: "x".repeat(64) } } }), JSON.stringify(validate.errors));
  assert.ok(validate(manifest), "a manifest without hooks is still valid");
  for (const wrong of [
    { reply: { label: "Reply", icon: "arrow-undo-outline" } },
    { message: { label: "Translate" } },
    { message: { icon: "language-outline" } },
    { message: { label: "", icon: "language-outline" } },
    { message: { label: "   ", icon: "language-outline" } },
    { message: { label: "x".repeat(65), icon: "language-outline" } },
    { message: { label: 7, icon: "language-outline" } },
    { message: { label: "Translate", icon: "Language Outline" } },
    { message: { label: "Translate", icon: "icon/language-outline.svg" } },
    { message: { label: "Translate", icon: "" } },
    { message: { label: "Translate", icon: "language-outline", order: 1 } },
    { message: "Translate" },
    ["message"],
  ]) {
    assert.ok(!validate({ ...hooked, hooks: wrong }), `hooks ${JSON.stringify(wrong)} should be refused`);
  }
  const hooks = schema.properties.hooks;
  for (const word of ["message", "composer", "chat", 'messages: "given"', 'send: "propose"', "game", "2026-10-20"]) {
    assert.ok(hooks.description.includes(word), `the description says ${word}`);
  }
});

test("a hook that reads the text needs messages given, and the composer's also send propose", () => {
  const chatOnly = { ...hooked, hooks: { chat: hooked.hooks.chat } };
  assert.ok(validate((({ permissions, ...rest }) => rest)(chatOnly)), "the chat's row needs nothing");
  for (const [hooks, permissions] of [
    [{ message: hooked.hooks.message }, undefined],
    [{ message: hooked.hooks.message }, { send: "propose" }],
    [{ message: hooked.hooks.message }, { messages: "none" }],
    [{ composer: hooked.hooks.composer }, { send: "propose" }],
    [{ composer: hooked.hooks.composer }, { messages: "given" }],
    [{ composer: hooked.hooks.composer }, { messages: "given", send: "nothing" }],
    [{ composer: hooked.hooks.composer }, { messages: "given", send: "auto" }],
  ]) {
    const wrong = { ...hooked, hooks, permissions };
    if (permissions === undefined) delete wrong.permissions;
    assert.ok(!validate(wrong), `${JSON.stringify(hooks)} with ${JSON.stringify(permissions)} should be refused`);
  }
  assert.ok(validate({ ...hooked, hooks: { message: hooked.hooks.message }, permissions: { messages: "given" } }), JSON.stringify(validate.errors));
  assert.ok(validate({ ...hooked, hooks: { composer: hooked.hooks.composer }, permissions: { messages: "given", send: "propose" } }), JSON.stringify(validate.errors));
});

test("a game binds to no hook", () => {
  for (const hooks of [{ chat: hooked.hooks.chat }, hooked.hooks]) {
    assert.ok(!validate({ ...chess, hooks }), `a game with ${JSON.stringify(hooks)} should be refused`);
  }
});

test("a hook's label may be given in the app's languages", () => {
  const translated = {
    ...hooked,
    locales: { es: { name: "Traductor", hooks: { message: "Traducir", composer: "Traducir", chat: "Idioma del chat" } }, "zh-TW": { hooks: { chat: "聊天語言" } } },
  };
  assert.ok(validate(translated), JSON.stringify(validate.errors));
  for (const wrong of [
    { es: { hooks: { reply: "Responder" } } },
    { es: { hooks: { message: "" } } },
    { es: { hooks: { message: "   " } } },
    { es: { hooks: { message: "x".repeat(65) } } },
    { es: { hooks: { message: { label: "Traducir" } } } },
    { es: { hooks: "Traducir" } },
  ]) {
    assert.ok(!validate({ ...hooked, locales: wrong }), `${JSON.stringify(wrong)} should be refused`);
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
