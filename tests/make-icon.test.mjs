// `tools/make-icon.mjs` (2026-10-08, plan of the Apps grid, "a plugin's image"): builds a plugin's
// `icon.svg` from a filled Ionicon on a colour square, and checks an `icon.svg` against the rules
// the app applies when it opens a package, so an author learns before publishing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIcon, checkSvg, IONICONS_DIR } from "../tools/make-icon.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tool = join(root, "tools", "make-icon.mjs");
const run = (...args) => spawnSync(process.execPath, [tool, ...args], { encoding: "utf8" });
const scratch = () => mkdtempSync(join(tmpdir(), "make-icon-"));

const FILLED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="ionicon"><title>X</title><path d="M0 0h512v512H0z"/><circle cx="1" cy="2" r="3"/></svg>';
const STROKED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="ionicon"><path d="M1 1h9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="44px" style="x"/></svg>';
const ok = (body, vb = "0 0 64 64") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;
const refused = (svg, why) => assert.ok(checkSvg(svg).some((e) => why.test(e)), `${svg} should be refused for ${why}`);

test("builds a 64x64 icon with a full-bleed square background", () => {
  const svg = buildIcon(FILLED, "#2563EB");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">/);
  assert.match(svg, /<rect width="64" height="64" fill="#2563EB"\/>/);
  assert.doesNotMatch(svg, /rx=/, "the app rounds the corners, the file is a plain square");
});

test("scales the 512 glyph to 34 px and centres it with a 15 px inset", () => {
  const svg = buildIcon(FILLED, "#000000");
  assert.match(svg, /<g fill="#fff" transform="translate\(15 15\) scale\(0\.06640625\)">/);
});

test("keeps filled shapes white and drops class, style and title", () => {
  const svg = buildIcon(FILLED, "#000000");
  assert.match(svg, /<path d="M0 0h512v512H0z"\/>/);
  assert.match(svg, /<circle cx="1" cy="2" r="3"\/>/);
  assert.doesNotMatch(svg, /class=|style=|<title/);
});

test("turns stroked shapes into white strokes without units", () => {
  const svg = buildIcon(STROKED, "#000000");
  assert.match(svg, /<path d="M1 1h9" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="44"\/>/);
  assert.doesNotMatch(svg, /currentColor|style=/);
});

test("rejects an ionicon with an element outside the whitelist", () => {
  assert.throws(() => buildIcon('<svg viewBox="0 0 512 512"><image href="x"/></svg>', "#000"), /image/);
});

test("rejects a background that is not a hex colour", () => {
  assert.throws(() => buildIcon(FILLED, "pink"), /hex/);
});

test("a generated icon passes the check", () => {
  assert.deepEqual(checkSvg(buildIcon(STROKED, "#123456")), []);
  assert.deepEqual(checkSvg(buildIcon(FILLED, "#DB2777")), []);
});

test("check accepts shapes, groups, gradients by url(#id), title and the five XML entities", () => {
  assert.deepEqual(checkSvg(ok('<rect width="64" height="64" fill="url(#g)"/>')), []);
  assert.deepEqual(
    checkSvg(ok('<title>A &amp; B</title><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs><g><path d="M0 0"/></g>')),
    [],
  );
  assert.deepEqual(checkSvg(ok("<rect/>", "0 0 128 128")), [], "any square viewBox");
});

test("check rejects scripts, handlers, hrefs, external urls and bad viewBoxes", () => {
  refused(ok("<script>alert(1)</script>"), /script/);
  refused(ok('<rect onclick="x"/>'), /onclick/);
  refused(ok('<path xlink:href="#a"/>'), /href/);
  refused(ok('<path href="#a"/>'), /href/);
  refused(ok('<path fill="url(http://e.com/a)"/>'), /url/);
  refused(ok("<rect/>", "0 0 64 32"), /viewBox/);
  refused('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', /viewBox/);
  refused(ok("<g>"), /well-formed|unclosed/);
  refused(ok(`<path d="${"M0 0".repeat(1100)}"/>`), /bytes/);
  refused('<g viewBox="0 0 64 64"></g>', /root/);
});

test("check rejects every element outside the whitelist", () => {
  for (const name of ["style", "image", "use", "a", "foreignObject", "animate", "animateTransform", "set", "filter", "text"]) {
    refused(ok(`<${name}/>`), new RegExp(`<${name}>`));
  }
});

// The app refuses these too (its own scanner, stricter than XML): checking here must not pass an
// icon the app would then reject with the whole package.
test("check rejects an inline style attribute, as the app does", () => {
  refused(ok('<rect style="fill:red"/>'), /style/);
});

test("check rejects comments, CDATA, DOCTYPE and processing instructions, as the app does", () => {
  refused(ok("<!-- hi --><rect/>"), /comment|DOCTYPE|CDATA/);
  refused(ok("<title><![CDATA[x]]></title>"), /comment|DOCTYPE|CDATA/);
  refused(`<!DOCTYPE svg [<!ENTITY x "y">]>${ok("<rect/>")}`, /comment|DOCTYPE|CDATA/);
  refused(`<?xml version="1.0"?>${ok("<rect/>")}`, /processing instruction|<\?/);
});

test("check rejects any entity but the five of XML, also in attribute values", () => {
  refused(ok("<title>&nbsp;</title>"), /entity/);
  refused(ok("<title>&#65;</title>"), /entity/);
  refused(ok('<path d="M0 0&x;"/>'), /entity/);
});

test("by default the Ionicons come from the ionicons devDependency of this package", () => {
  assert.equal(IONICONS_DIR, join(root, "node_modules", "ionicons", "dist", "svg"));
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.ok(pkg.devDependencies?.ionicons, "ionicons is a devDependency");
  assert.ok(!pkg.dependencies, "nothing is needed at run time");
  assert.equal(pkg.scripts?.icon, "node tools/make-icon.mjs");
});

test("the command line writes a valid icon from a real Ionicon", () => {
  const out = join(scratch(), "icon.svg");
  const result = run("image", "#DB2777", out);
  assert.equal(result.status, 0, result.stderr);
  const svg = readFileSync(out, "utf8");
  assert.match(svg, /fill="#DB2777"/);
  assert.deepEqual(checkSvg(svg), []);
});

test("--ionicons takes the Ionicons from another folder", () => {
  const dir = scratch();
  mkdirSync(join(dir, "svg"));
  writeFileSync(join(dir, "svg", "dot.svg"), FILLED);
  const out = join(dir, "icon.svg");
  const result = run("--ionicons", join(dir, "svg"), "dot", "#16A34A", out);
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(out, "utf8"), /<circle cx="1" cy="2" r="3"\/>/);
  assert.notEqual(run("--ionicons", join(dir, "svg"), "image", "#16A34A", out).status, 0, "image is not in that folder");
});

test("the command line refuses a name that is not an Ionicon's", () => {
  assert.notEqual(run("../x", "#16A34A", join(scratch(), "icon.svg")).status, 0);
});

test("--check passes good icons and fails bad ones with the reasons", () => {
  const dir = scratch();
  const good = join(dir, "good.svg");
  const bad = join(dir, "bad.svg");
  writeFileSync(good, buildIcon(FILLED, "#0284C7"));
  writeFileSync(bad, ok('<rect onload="x"/>'));
  const pass = run("--check", good);
  assert.equal(pass.status, 0, pass.stderr);
  assert.match(pass.stdout, /ok/);
  const fail = run("--check", good, bad);
  assert.equal(fail.status, 1);
  assert.match(fail.stderr, /FAIL .*bad\.svg/);
  assert.match(fail.stderr, /onload/);
});

test("without arguments it prints the usage", () => {
  const result = run();
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage/);
  assert.match(result.stderr, /--check/);
  assert.match(result.stderr, /--ionicons/);
});
