import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => JSON.parse(readFileSync(join(root, name), "utf8"));

const KIT_CAST = {
  who: ["ari", "noa", "milo", "juno", "kit", "lou", "rio", "sam", "umi", "val", "zuri", "nico"],
  hair: [
    "none", "long-fringe", "ponytail", "braids", "long-braid", "bun", "bob", "curly-puff", "two-puffs", "wavy-headband",
    "messy-fringe", "short-crop", "side-part", "spiky", "curls", "quiff", "undercut", "cap", "mini-twists",
  ],
  hairColour: ["ink", "chestnut", "copper", "golden", "cream", "silver"],
};

test("the cast is the games kit's: twelve profiles, nineteen hairstyles and six hair colours, in its order", () => {
  assert.deepEqual(read("avatars.json"), KIT_CAST);
});

test("every list of the cast holds unique ids of lowercase letters and dashes", () => {
  const cast = read("avatars.json");
  assert.deepEqual(Object.keys(cast), ["who", "hair", "hairColour"]);
  for (const [list, ids] of Object.entries(cast)) {
    assert.ok(Array.isArray(ids) && ids.length > 0, `${list} is a list`);
    assert.equal(new Set(ids).size, ids.length, `${list} has no id twice`);
    for (const id of ids) assert.match(id, /^[a-z-]{1,24}$/, `${list}: ${id}`);
  }
});

test("nobody can pick the FlickerTalk contact's own face", () => {
  for (const ids of Object.values(read("avatars.json"))) assert.ok(!ids.includes("flick"));
});

test("the package ships the cast and the player schema", () => {
  const { files } = read("package.json");
  assert.ok(files.includes("avatars.json"));
  assert.ok(files.includes("player.schema.json"));
});

const compiled = () => new Ajv({ strict: false }).compile(read("player.schema.json"));

const player = { who: "ari", hair: "none", hairColour: "ink", name: "" };

test("the player schema takes its ids from the cast, in the same order", () => {
  const cast = read("avatars.json");
  const schema = read("player.schema.json");
  for (const list of ["who", "hair", "hairColour"]) assert.deepEqual(schema.properties[list].enum, cast[list], list);
  assert.deepEqual([...schema.required].sort(), ["hair", "hairColour", "name", "who"]);
});

test("a player with ids from the cast and a clean name of up to 40 characters is valid", () => {
  const validate = compiled();
  for (const valid of [
    player,
    { who: "nico", hair: "mini-twists", hairColour: "silver", name: "Ana" },
    { ...player, name: "Ana María de la Luz" },
    { ...player, name: "李雷" },
    { ...player, name: "Zoë 🚀" },
    { ...player, name: "x".repeat(40) },
    { ...player, name: "😀".repeat(40) },
  ]) {
    assert.ok(validate(valid), `${JSON.stringify(valid)}: ${JSON.stringify(validate.errors)}`);
  }
});

test("what the app would refuse, the schema refuses first", () => {
  const validate = compiled();
  for (const wrong of [
    { ...player, who: "flick" },
    { ...player, who: "bob" },
    { ...player, who: "Ari" },
    { ...player, who: "" },
    { ...player, hair: "mohawk" },
    { ...player, hair: "ink" },
    { ...player, hairColour: "blue" },
    { ...player, hairColour: 1 },
    { ...player, name: "x".repeat(41) },
    { ...player, name: "😀".repeat(41) },
    { ...player, name: 7 },
    { ...player, name: null },
    { ...player, name: ["Ana"] },
    { ...player, name: " Ana" },
    { ...player, name: "Ana " },
    { ...player, name: "An  a" },
    { ...player, name: "An\na" },
    { ...player, name: "An\ta" },
    { ...player, name: "An a" },
    { ...player, name: "An\u0000a" },
    { ...player, name: "Ana‎" },
    { ...player, name: "‮Ana" },
    { ...player, name: "An⁦a" },
    { ...player, name: "﻿Ana" },
    { ...player, vehicle: "bus" },
    (({ name, ...rest }) => rest)(player),
    (({ hairColour, ...rest }) => rest)(player),
    null,
    "ari",
    [player],
  ]) {
    assert.ok(!validate(wrong), `${JSON.stringify(wrong)} should be refused`);
  }
});
