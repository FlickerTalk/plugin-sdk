#!/usr/bin/env node
// Builds a plugin `icon.svg` from a filled Ionicon on a full-bleed colour square, and checks
// SVGs against the rules the app applies when it opens a package (see "The plugin's icon" in the
// README). A package whose `icon.svg` breaks them is refused whole.
//
//   node tools/make-icon.mjs [--ionicons <dir>] <ionicon-name> <background-colour> <out.svg>
//   node tools/make-icon.mjs --check <file.svg>...
//
// No runtime dependencies: Node >= 20. The Ionicons (MIT) come from the `ionicons` devDependency
// (`node_modules/ionicons/dist/svg`), or from the folder given with `--ionicons`.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const IONICONS_DIR = resolve(HERE, '../node_modules/ionicons/dist/svg');

export const MAX_BYTES = 4096;
export const ALLOWED_ELEMENTS = new Set([
  'svg', 'g', 'title', 'desc', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline',
  'polygon', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask',
]);
// Shapes copied from an Ionicon into the icon; anything else in the source is an error.
const GLYPH_ELEMENTS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'g']);
const SKIPPED_ELEMENTS = new Set(['title', 'desc']);
// Geometry and stroke attributes worth keeping from the source.
const KEPT_ATTRIBUTES = new Set([
  'd', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points',
  'transform', 'fill-rule', 'clip-rule', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-width', 'opacity',
]);

const SIZE = 64;
const GLYPH = 34;
const INSET = (SIZE - GLYPH) / 2;
const SCALE = GLYPH / 512;

// The five entities of XML; any other (named or numeric) is refused, as the app does.
const ENTITY = /&(?!(?:amp|lt|gt|quot|apos);)/;

const TAG = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/y;
const ATTR = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Minimal XML tokenizer for the flat SVGs we handle. Throws if it is not well formed. */
export function parse(text) {
  const root = { name: '#root', attrs: [], children: [] };
  const stack = [root];
  let i = text.startsWith('<?xml') ? text.indexOf('?>') + 2 : 0;
  if (i === 1) throw new Error('not well-formed: unterminated XML prolog');
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    const chunk = text.slice(i, lt === -1 ? text.length : lt);
    if (chunk.trim()) {
      const top = stack[stack.length - 1];
      if (top === root) throw new Error('not well-formed: text outside the root element');
      if (ENTITY.test(chunk)) throw new Error('bad entity: only &amp; &lt; &gt; &quot; &apos; are allowed');
    }
    if (lt === -1) break;
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt);
      if (end === -1) throw new Error('not well-formed: unterminated comment');
      i = end + 3;
      continue;
    }
    if (text[lt + 1] === '!' || text[lt + 1] === '?') throw new Error('not well-formed: DOCTYPE, CDATA or processing instruction');
    TAG.lastIndex = lt;
    const m = TAG.exec(text);
    if (!m) throw new Error(`not well-formed: bad tag at ${lt}`);
    const [, closing, name, rawAttrs, selfClosing] = m;
    if (closing) {
      const open = stack.pop();
      if (rawAttrs.trim() || selfClosing || open.name !== name) throw new Error(`not well-formed: </${name}> closes <${open.name}>`);
    } else {
      const attrs = [...rawAttrs.matchAll(ATTR)].map((a) => [a[1], a[2] ?? a[3]]);
      if (new Set(attrs.map(([k]) => k)).size !== attrs.length) throw new Error(`not well-formed: duplicate attribute in <${name}>`);
      const node = { name, attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!selfClosing) stack.push(node);
    }
    i = TAG.lastIndex;
  }
  if (stack.length !== 1) throw new Error(`not well-formed: unclosed <${stack[stack.length - 1].name}>`);
  if (root.children.length !== 1) throw new Error('not well-formed: expected a single root element');
  return root.children[0];
}

const esc = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function glyphNode(node) {
  if (SKIPPED_ELEMENTS.has(node.name)) return '';
  if (!GLYPH_ELEMENTS.has(node.name)) throw new Error(`unsupported element in ionicon: <${node.name}>`);
  const attrs = new Map(node.attrs);
  const out = [];
  for (const [k, v] of node.attrs) {
    if (!KEPT_ATTRIBUTES.has(k)) continue;
    out.push([k, k === 'stroke-width' ? v.replace(/px$/, '') : v]);
  }
  const stroked = attrs.has('stroke') && attrs.get('stroke') !== 'none';
  const unfilled = attrs.get('fill') === 'none';
  // Order: geometry first, then paint, then stroke details (stable, readable output).
  const geometry = out.filter(([k]) => !k.startsWith('stroke-'));
  const strokeDetails = out.filter(([k]) => k.startsWith('stroke-'));
  const paint = [];
  if (unfilled) paint.push(['fill', 'none']);
  if (stroked) paint.push(['stroke', '#fff']);
  const all = [...geometry, ...paint, ...(stroked ? strokeDetails : [])];
  const open = `<${node.name}${all.map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}`;
  const inner = node.children.map(glyphNode).join('');
  return inner ? `${open}>${inner}</${node.name}>` : `${open}/>`;
}

/** Builds the icon SVG text from an Ionicon's SVG text and a background colour. */
export function buildIcon(ioniconSvg, background) {
  const root = parse(ioniconSvg);
  if (root.name !== 'svg') throw new Error('ionicon root is not <svg>');
  const viewBox = new Map(root.attrs).get('viewBox');
  if (viewBox !== '0 0 512 512') throw new Error(`unexpected ionicon viewBox: ${viewBox}`);
  if (!/^#[0-9a-fA-F]{3,8}$/.test(background)) throw new Error(`background must be a hex colour: ${background}`);
  const glyph = root.children.map(glyphNode).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">`
    + `<rect width="${SIZE}" height="${SIZE}" fill="${background}"/>`
    + `<g fill="#fff" transform="translate(${INSET} ${INSET}) scale(${SCALE})">${glyph}</g>`
    + '</svg>\n';
}

/** Returns the list of rule violations of an icon SVG (empty when it is valid). */
export function checkSvg(text) {
  const errors = [];
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > MAX_BYTES) errors.push(`too big: ${bytes} bytes > ${MAX_BYTES}`);
  // The app takes no XML declaration, comment, DOCTYPE, CDATA or processing instruction.
  if (/<[!?]/.test(text)) errors.push('no XML declaration, comment, DOCTYPE, CDATA or processing instruction (<! or <?)');
  let root;
  try {
    root = parse(text);
  } catch (e) {
    return [...errors, e.message];
  }
  if (root.name !== 'svg') errors.push(`root must be <svg>, got <${root.name}>`);
  const vb = new Map(root.attrs).get('viewBox');
  const parts = vb?.trim().split(/[\s,]+/).map(Number);
  if (!parts || parts.length !== 4 || parts.some(Number.isNaN) || parts[0] !== 0 || parts[1] !== 0 || parts[2] !== parts[3] || parts[2] <= 0) {
    errors.push(`viewBox must be square "0 0 N N", got ${JSON.stringify(vb)}`);
  }
  const walk = (node) => {
    if (!ALLOWED_ELEMENTS.has(node.name)) errors.push(`element not allowed: <${node.name}>`);
    for (const [k, v] of node.attrs) {
      const local = k.toLowerCase().split(':').pop();
      if (/^on/i.test(k) || local.startsWith('on')) errors.push(`event handler not allowed: ${k} on <${node.name}>`);
      if (local === 'href') errors.push(`href not allowed: ${k} on <${node.name}>`);
      if (local === 'style') errors.push(`style not allowed: ${k} on <${node.name}>`);
      if (ENTITY.test(v)) errors.push(`bad entity in ${k} on <${node.name}>: only &amp; &lt; &gt; &quot; &apos; are allowed`);
      for (const u of v.matchAll(/url\(\s*['"]?([^)'"]*)/gi)) {
        if (!/^#[\w-]+$/.test(u[1])) errors.push(`only url(#id) is allowed: ${k}="${v}" on <${node.name}>`);
      }
    }
    node.children.forEach(walk);
  };
  walk(root);
  return errors;
}

function main(args) {
  const argv = [...args];
  let ionicons = IONICONS_DIR;
  const at = argv.indexOf('--ionicons');
  if (at !== -1) {
    if (at + 1 >= argv.length) return usage();
    ionicons = resolve(argv[at + 1]);
    argv.splice(at, 2);
  }
  if (argv[0] === '--check') {
    if (argv.length < 2) return usage();
    let bad = 0;
    for (const file of argv.slice(1)) {
      const errors = checkSvg(readFileSync(file, 'utf8'));
      if (errors.length) {
        bad++;
        console.error(`FAIL ${file}\n  ${errors.join('\n  ')}`);
      } else {
        console.log(`ok   ${file} (${readFileSync(file).length} bytes)`);
      }
    }
    return bad ? 1 : 0;
  }
  if (argv.length !== 3) return usage();
  const [name, background, out] = argv;
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`bad ionicon name: ${name}`);
  const svg = buildIcon(readFileSync(resolve(ionicons, `${name}.svg`), 'utf8'), background);
  const errors = checkSvg(svg);
  if (errors.length) throw new Error(`generated icon breaks the rules:\n  ${errors.join('\n  ')}`);
  writeFileSync(out, svg);
  console.log(`wrote ${out} (${Buffer.byteLength(svg)} bytes)`);
  return 0;
}

function usage() {
  console.error(
    'usage: make-icon.mjs [--ionicons <dir>] <ionicon-name> <background-colour> <out.svg>\n'
    + '       make-icon.mjs --check <file.svg>...',
  );
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
