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

test("a viewer names exact kinds of file", () => {
  const viewer = { ...board, id: "com.flickertalk.pdfviewer", components: ["ft-pdf-viewer"], permissions: {}, opens: ["application/pdf"], views: ["application/pdf"] };
  assert.ok(validate(viewer), JSON.stringify(validate.errors));
  for (const wrong of [{ ...viewer, views: ["application/*"] }, { ...viewer, views: ["*/*"] }, { ...viewer, views: ["pdf"] }]) {
    assert.equal(validate(wrong), false, JSON.stringify(wrong.views));
  }
});

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
  assert.match(permission.description, /1\.7\.0/, "it says from which app");
});

const settings = {
  label: "Translation",
  icon: "language-outline",
  fields: [
    { key: "lang", type: "select", label: "Language" },
    { key: "receive", type: "toggle", label: "Translate what I receive" },
    { key: "send", type: "toggle", label: "Send translated" },
  ],
  note: "Language packs are downloaded once; translation happens on the phone.",
};
const hooked = {
  id: "com.flickertalk.translate",
  name: "Translator",
  version: "1.1.0",
  minCoreVersion: "1.7.0",
  components: ["ft-translate"],
  hooks: {
    message: { label: "Translate", icon: "language-outline" },
    composer: { label: "Translate", icon: "language-outline" },
    settings,
  },
  permissions: { messages: "given", translate: true, send: "propose", storage: "small" },
};

test("a tool may bind to the conversation's hooks, each with a label and a lent icon", () => {
  assert.ok(validate(hooked), JSON.stringify(validate.errors));
  assert.ok(validate({ ...hooked, kind: "tool" }), JSON.stringify(validate.errors));
  assert.ok(validate({ ...hooked, hooks: { message: hooked.hooks.message } }), JSON.stringify(validate.errors));
  assert.ok(validate({ ...hooked, hooks: { message: { label: "x".repeat(64), icon: "x".repeat(64) } } }), JSON.stringify(validate.errors));
  assert.ok(validate(manifest), "a manifest without hooks is still valid");
  for (const wrong of [
    { chat: { label: "Chat language", icon: "language-outline" } },
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
    { message: { label: "Translate", icon: "language-outline", fields: settings.fields } },
    { message: "Translate" },
    ["message"],
  ]) {
    assert.ok(!validate({ ...hooked, hooks: wrong }), `hooks ${JSON.stringify(wrong)} should be refused`);
  }
  const hooks = schema.properties.hooks;
  for (const word of ["message", "composer", "settings", 'messages: "given"', 'send: "propose"', "game", "1.7.0"]) {
    assert.ok(hooks.description.includes(word), `the description says ${word}`);
  }
});

test("a tool's settings are fields the app draws: selects and toggles, each with a key and a label, and a note", () => {
  const with_ = (changed) => ({ ...hooked, hooks: { settings: { ...settings, ...changed } } });
  assert.ok(validate(with_({})), JSON.stringify(validate.errors));
  assert.ok(validate(with_({ note: undefined })), "the note is optional");
  assert.ok(validate(with_({ fields: [{ key: "on", type: "toggle", label: "On" }] })), JSON.stringify(validate.errors));
  for (const wrong of [
    { fields: [] },
    { fields: undefined },
    { fields: Array.from({ length: 9 }, (_, index) => ({ key: `k${index}`, type: "toggle", label: "On" })) },
    { fields: [{ key: "lang", type: "text", label: "Language" }] },
    { fields: [{ key: "lang", type: "select" }] },
    { fields: [{ type: "select", label: "Language" }] },
    { fields: [{ key: "Lang", type: "select", label: "Language" }] },
    { fields: [{ key: "my-lang", type: "select", label: "Language" }] },
    { fields: [{ key: "x".repeat(33), type: "select", label: "Language" }] },
    { fields: [{ key: "lang", type: "select", label: "" }] },
    { fields: [{ key: "lang", type: "select", label: "x".repeat(65) }] },
    { fields: [{ key: "lang", type: "select", label: "Language", options: [] }] },
    { note: "" },
    { note: "x".repeat(201) },
    { label: "" },
    { icon: "Language" },
    { extra: true },
  ]) {
    const manifestWith = with_(wrong);
    if ("fields" in wrong && wrong.fields === undefined) delete manifestWith.hooks.settings.fields;
    assert.ok(!validate(manifestWith), `settings with ${JSON.stringify(wrong)} should be refused`);
  }
});

test("a hook that reads the text needs messages given, and the composer's also send propose", () => {
  const settingsOnly = { ...hooked, hooks: { settings } };
  assert.ok(validate((({ permissions, ...rest }) => rest)(settingsOnly)), "the settings need nothing");
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
  for (const hooks of [{ settings }, hooked.hooks]) {
    assert.ok(!validate({ ...chess, hooks }), `a game with ${JSON.stringify(hooks)} should be refused`);
  }
});

test("a hook's labels, the settings' fields and note may be given in the app's languages", () => {
  const translated = {
    ...hooked,
    locales: {
      es: {
        name: "Traductor",
        hooks: {
          message: "Traducir",
          composer: "Traducir",
          settings: { label: "Traducción", fields: { lang: "Idioma", receive: "Traducir lo que recibo", send: "Enviar traducido" }, note: "Los paquetes de idioma se descargan una vez." },
        },
      },
      "zh-TW": { hooks: { settings: { fields: { lang: "語言" } } } },
    },
  };
  assert.ok(validate(translated), JSON.stringify(validate.errors));
  for (const wrong of [
    { es: { hooks: { chat: "Idioma del chat" } } },
    { es: { hooks: { reply: "Responder" } } },
    { es: { hooks: { message: "" } } },
    { es: { hooks: { message: "   " } } },
    { es: { hooks: { message: "x".repeat(65) } } },
    { es: { hooks: { message: { label: "Traducir" } } } },
    { es: { hooks: "Traducir" } },
    { es: { hooks: { settings: "Traducción" } } },
    { es: { hooks: { settings: { label: "" } } } },
    { es: { hooks: { settings: { fields: { lang: "" } } } } },
    { es: { hooks: { settings: { fields: { Lang: "Idioma" } } } } },
    { es: { hooks: { settings: { fields: { lang: "x".repeat(65) } } } } },
    { es: { hooks: { settings: { note: "x".repeat(201) } } } },
    { es: { hooks: { settings: { extra: "no" } } } },
  ]) {
    assert.ok(!validate({ ...hooked, locales: wrong }), `${JSON.stringify(wrong)} should be refused`);
  }
});

const LANGUAGES = ["es", "pt", "fr", "de", "it", "ro", "ru", "uk", "pl", "tr", "ar", "hi", "bn", "id", "vi", "th", "ja", "ko", "zh-CN", "zh-TW"];

test("a plugin may give its name and summary in the app's languages", () => {
  const translated = {
    ...chess,
    summary: "Chess with the other person in the chat.",
    locales: { es: { name: "Ajedrez", summary: "Ajedrez con la otra persona del chat." }, "zh-TW": { name: "西洋棋" } },
  };
  assert.ok(validate(translated), JSON.stringify(validate.errors));
  assert.ok(validate({ ...manifest, locales: { de: { summary: "Übersetzt eine Nachricht." } } }), JSON.stringify(validate.errors));
  assert.ok(validate({ ...manifest, locales: Object.fromEntries(LANGUAGES.map((code) => [code, { name: "x".repeat(64), summary: "y".repeat(200) }])) }), JSON.stringify(validate.errors));
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
    { en: { name: "Translator" } },
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

test("a plugin may name the Ionicon the app shows for it", () => {
  assert.ok(validate({ ...manifest, icon: "image-outline" }), JSON.stringify(validate.errors));
  assert.ok(validate({ ...chess, icon: "shield-outline" }), JSON.stringify(validate.errors));
  assert.ok(validate({ ...manifest, icon: "x".repeat(64) }), JSON.stringify(validate.errors));
  assert.ok(validate(manifest), "a manifest without icon is still valid");
  for (const wrong of ["Icon-Outline", "image outline", "x".repeat(65), "../x", "icon/image-outline.svg", "", 7]) {
    assert.ok(!validate({ ...manifest, icon: wrong }), `icon ${JSON.stringify(wrong)} should be refused`);
  }
});

test("the schema's descriptions carry no plan references or dates", () => {
  const descriptions = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (key === "description" && typeof value === "string") descriptions.push(value);
      else walk(value);
    }
  };
  walk(schema);
  assert.ok(descriptions.length > 20, "the descriptions are found");
  for (const text of descriptions) assert.doesNotMatch(text, /\u00a7|\bPlan\b|\b20\d\d-\d\d-\d\d\b/, text);
});
