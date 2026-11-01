#!/usr/bin/env node
// Build the Foundation Developer Reference (foundation/docs/) from the
// method and class documentation in a Foundation repository checkout. Also
// copies <f6>/LICENSE and <f6>/PROVENANCE.md verbatim to foundation/ and
// writes the Licence page, foundation/licence/index.html, from those two files.
//
// Usage: node scripts/build-docs.mjs /path/to/f6
//
// Reads (never writes) Methods/*.md, Classes/*.md and Foundation-History.json
// from <f6>/Builds/Docs/Foundation-<version>/Documentation when that exists
// (private methods already removed), else from <f6>/Documentation with a
// warning; also <f6>/LICENSE and <f6>/PROVENANCE.md. The site frame is in
// site-frame.mjs and the Markdown helpers in markdown.mjs.
// Replaces everything under foundation/docs/ except
// original/ and the hand-written docs.css. Output is deterministic: no timestamps; the f6 commit goes in
// foundation/docs/DOCS_SOURCE. Plain Node, no dependencies, no JavaScript in
// the generated pages.

import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, frame, newsBox, supportBox } from './site-frame.mjs';
import { unescapeMd, inline, blocks, cells } from './markdown.mjs';
import { execFileSync } from 'node:child_process';

const f6 = process.argv[2];
if (!f6) {
	console.error('usage: node scripts/build-docs.mjs /path/to/f6');
	process.exit(1);
}

// Documentation input. A release build of the documentation, with private
// methods already removed, lives at Builds/Docs/Foundation-<version>/Documentation;
// use it when present (the version in Resources/InfoPlist.json if that folder
// exists, otherwise the highest version found). Without one, fall back to the
// working documentation in <f6>/Documentation, which includes private methods.
function findDocsSource() {
	const base = join(f6, 'Builds', 'Docs');
	if (existsSync(base)) {
		const found = readdirSync(base).filter((d) => d.startsWith('Foundation-') && existsSync(join(base, d, 'Documentation')));
		if (found.length) {
			let wanted = null;
			try { wanted = JSON.parse(readFileSync(join(f6, 'Resources', 'InfoPlist.json'), 'utf8').replace(/^\uFEFF/, '')).CFBundleShortVersionString; } catch { /* use the highest */ }
			const pick = found.includes(`Foundation-${wanted}`)
				? `Foundation-${wanted}`
				: found.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).at(-1);
			return { dir: join(base, pick, 'Documentation'), label: `Builds/Docs/${pick}/Documentation` };
		}
	}
	console.warn('WARNING: no Builds/Docs/Foundation-<version>/Documentation in the Foundation checkout;\n' +
		'falling back to <f6>/Documentation, which includes private methods. Do not publish this output.');
	return { dir: join(f6, 'Documentation'), label: 'Documentation' };
}
const docsSource = findDocsSource();
const srcDocs = docsSource.dir;
const siteDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'foundation');
const outDir = join(siteDir, 'docs');
const commit = execFileSync('git', ['-C', f6, 'describe', '--tags', '--long', '--always'], { encoding: 'utf8' }).trim();
let version = 'unknown version';
try { version = JSON.parse(readFileSync(join(f6, 'Resources', 'InfoPlist.json'), 'utf8').replace(/^\uFEFF/, '')).CFBundleShortVersionString || version; } catch { /* leave */ }

// ---------------------------------------------------------------- text helpers

const readText = (p) => readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');
const byName = (a, b) => {
	const x = a.toLowerCase(), y = b.toLowerCase();
	return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
};


const DIRECTION = { '➡️': 'in', '⬅️': 'out', '↔️': 'in/out', '➡': 'in', '⬅': 'out', '↔': 'in/out' };

// ---------------------------------------------------------------- methods

const failures = [];
const methods = [];

for (const file of readdirSync(join(srcDocs, 'Methods')).filter((f) => f.endsWith('.md')).sort(byName)) {
	let text = readText(join(srcDocs, 'Methods', file));
	let summary = '';
	const comment = text.match(/^\s*<!--([\s\S]*?)-->/);
	if (comment) {
		summary = comment[1].split('\n')[0].trim();
		text = text.slice(comment[0].length);
	}
	const lines = text.split('\n');
	const hIdx = lines.findIndex((l) => /^##\s+/.test(l));
	const aIdx = lines.findIndex((l) => /^\s*Attributes:/.test(l));
	if (hIdx < 0) { failures.push(`${file}: no "## Name" heading`); continue; }
	if (aIdx < 0) { failures.push(`${file}: no "Attributes:" line`); continue; }
	if (aIdx < hIdx) { failures.push(`${file}: "Attributes:" line precedes the heading`); continue; }
	const attributes = lines[aIdx].replace(/^\s*Attributes:\s*/, '').split(',').map((s) => s.trim()).filter(Boolean);
	if (!attributes.includes('Shared')) continue;

	const name = unescapeMd(lines[hIdx].replace(/^##\s+/, '').trim());
	const body = lines.slice(hIdx + 1, aIdx);
	while (body.length && !body[0].trim()) body.shift();

	let syntax = '';
	const desc = [];
	if (body.length && unescapeMd(body[0].trim()).startsWith(name)) {
		const first = unescapeMd(body.shift().trim());
		const cut = first.indexOf(' // ');
		if (cut >= 0) { syntax = first.slice(0, cut).trim(); desc.push(first.slice(cut + 4).trim(), ''); }
		else syntax = first;
	} else if (summary.startsWith(name)) {
		syntax = summary;
	} else if (body.length && summary && unescapeMd(body[0].trim()) === summary) {
		syntax = unescapeMd(body.shift().trim());
		failures.push(`${file}: syntax line names ${syntax.split(/[ (]/)[0]}, not ${name}`);
	} else {
		syntax = name;
		failures.push(`${file}: no syntax line (shown as the bare name)`);
	}
	desc.push(...body);

	const params = [];
	let noParams = false;
	for (const l of lines.slice(aIdx + 1)) {
		if (!/^\s*\|/.test(l)) continue;
		const c = cells(l);
		if (c.every((x) => /^-*$/.test(x))) continue;
		if (/^Parameters?$/.test(c[0])) continue;
		if (c.length === 1) { if (/no|not require/i.test(c[0])) noParams = true; continue; }
		if (c.length < 4) { failures.push(`${file}: parameter row with ${c.length} cells`); continue; }
		const dir = DIRECTION[c[2]];
		if (dir === undefined) failures.push(`${file}: unknown direction "${c[2]}" for ${c[0]}`);
		params.push({ name: c[0], type: c[1], dir: dir ?? c[2], desc: c.slice(3).join(' | ') });
	}

	const m = name.match(/^Fnd_([A-Za-z0-9]+)_/);
	const module = m ? `Fnd_${m[1]}` : 'Other';
	methods.push({ name, file, syntax, desc, params, noParams, module, attributes });
}

methods.sort((a, b) => byName(a.name, b.name));
const modules = new Map();
for (const m of methods) {
	if (!modules.has(m.module)) modules.set(m.module, []);
	modules.get(m.module).push(m);
}
const moduleNames = [...modules.keys()].filter((k) => k !== 'Other').sort(byName);
if (modules.has('Other')) moduleNames.push('Other');
const pageOf = (mod) => (mod === 'Other' ? 'other' : mod.slice(4).toLowerCase()) + '.html';
const moduleLabel = (mod) => (mod === 'Other' ? 'Other shared methods' : mod);

// ---------------------------------------------------------------- classes

const classes = [];
for (const file of readdirSync(join(srcDocs, 'Classes')).filter((f) => f.endsWith('.md')).sort(byName)) {
	const text = readText(join(srcDocs, 'Classes', file));
	const lines = text.split('\n');
	const hIdx = lines.findIndex((l) => /^##\s+/.test(l));
	const members = lines.filter((l) => /^###\s+/.test(l)).map((l) => unescapeMd(l.replace(/^###\s+/, '').trim()));
	if (hIdx < 0 || !members.length) { failures.push(`Classes/${file}: no class heading or no members; omitted`); continue; }
	const title = unescapeMd(lines[hIdx].replace(/^##\s+/, '').trim());
	const id = basename(file, '.md');
	classes.push({ id, title, members, lines: lines.slice(hIdx + 1) });
}

const history = JSON.parse(readText(join(srcDocs, 'Foundation-History.json')));

// ---------------------------------------------------------------- page frame


const page = (args) => frame({ ...args, docs: true, current: 'docs' });

function modulesBox(current) {
	const items = moduleNames.map((mod) => {
		const cur = mod === current ? ' aria-current="page"' : '';
		return `\t\t<li><a href="/docs/${pageOf(mod)}"${cur}>${esc(moduleLabel(mod))}</a></li>`;
	});
	return `\t<section class="box">
	<h2>Reference</h2>
	<ul class="nav">
		<li><a href="/docs/">Contents</a></li>
		<li><a href="/docs/all.html">All methods</a></li>
		<li><a href="/docs/classes.html">Classes</a></li>
		<li><a href="/docs/history.html">History</a></li>
	</ul>
	</section>
	<section class="box">
	<h2>Modules</h2>
	<ul class="nav">
${items.join('\n')}
	</ul>
	</section>`;
}

// ---------------------------------------------------------------- pages

const files = {};

function methodHtml(m) {
	const parts = [`<section class="method" id="${esc(m.name)}">`,
		`<h2><a href="#${esc(m.name)}">${esc(m.name)}</a></h2>`,
		`<p class="syntax"><code>${esc(m.syntax)}</code></p>`];
	const d = blocks(m.desc);
	if (d) parts.push(d);
	if (m.params.length) {
		parts.push('<table class="params">',
			'<thead><tr><th scope="col">Parameter</th><th scope="col">Type</th><th scope="col">Direction</th><th scope="col">Description</th></tr></thead>',
			'<tbody>');
		for (const p of m.params) {
			parts.push(`<tr><td><code>${esc(p.name)}</code></td><td>${esc(p.type)}</td><td>${esc(p.dir)}</td><td>${esc(p.desc)}</td></tr>`);
		}
		parts.push('</tbody>', '</table>');
	} else {
		parts.push('<p class="noparams">No parameters.</p>');
	}
	parts.push('</section>');
	return parts.join('\n');
}

for (const mod of moduleNames) {
	const list = modules.get(mod);
	const jump = list.map((m) => `<li><a href="#${esc(m.name)}">${esc(m.name)}</a></li>`).join('\n');
	const side = list.map((m) => `\t\t<li><a href="#${esc(m.name)}">${esc(m.name)}</a></li>`).join('\n');
	files[pageOf(mod)] = page({
		title: `${moduleLabel(mod)} — Foundation Developer Reference`,
		description: `Shared methods of Foundation's ${moduleLabel(mod)} module.`,
		sidebar: `${modulesBox(mod)}
	<section class="box">
	<h2>${esc(moduleLabel(mod))}</h2>
	<ul class="nav methods">
${side}
	</ul>
	</section>`,
		body: `<h1>${esc(moduleLabel(mod))}</h1>

<p>${list.length} shared method${list.length === 1 ? '' : 's'}.</p>

<ul class="jump">
${jump}
</ul>

${list.map(methodHtml).join('\n\n')}`,
	});
}

// all.html
{
	const rows = methods.map((m) =>
		`<li><a href="/docs/${pageOf(m.module)}#${esc(m.name)}">${esc(m.name)}</a></li>`).join('\n');
	files['all.html'] = page({
		title: 'All methods — Foundation Developer Reference',
		description: 'Every shared Foundation method, in one alphabetical list.',
		sidebar: modulesBox(null),
		body: `<h1>All methods</h1>

<p>${methods.length} shared methods in alphabetical order. Use your browser's
find command (Ctrl-F or ⌘-F) to search this page.</p>

<ul class="all">
${rows}
</ul>`,
	});
}

// classes.html
{
	const body = classes.map((c) => {
		const heading = (level, text) => {
			if (level === 3) {
				const id = `${c.id}.${text}`;
				return `<h3 id="${esc(id)}"><a href="#${esc(id)}">${esc(text)}</a></h3>`;
			}
			return `<h${level + 1}>${esc(text)}</h${level + 1}>`;
		};
		return `<section class="class" id="${esc(c.id)}">
<h2><a href="#${esc(c.id)}">${esc(c.title)}</a></h2>
${blocks(c.lines, heading)}
</section>`;
	}).join('\n\n');
	const side = classes.map((c) => `\t\t<li><a href="#${esc(c.id)}">${esc(c.title)}</a></li>`).join('\n');
	files['classes.html'] = page({
		title: 'Classes — Foundation Developer Reference',
		description: "Foundation's classes and their functions.",
		sidebar: `${modulesBox(null)}
	<section class="box">
	<h2>Classes</h2>
	<ul class="nav">
${side}
	</ul>
	</section>`,
		body: `<h1>Classes</h1>

<ul class="jump">
${classes.map((c) => `<li><a href="#${esc(c.id)}">${esc(c.title)}</a></li>`).join('\n')}
</ul>

${body}`,
	});
}

// history.html
{
	const p = (s) => `<p>${esc(s)}</p>`;
	const milestones = (history.milestones || []).map((m) => `<section class="milestone">
<h3>${esc(m.title)}</h3>
<p class="period">${esc(m.period)}</p>
${p(m.text)}
</section>`).join('\n\n');
	const contributors = (history.contributors || []).map((c) => `<dt>${esc(c.name)}</dt>
<dd>${esc(c.credit)}${c.sources && c.sources.length ? `
<ul class="sources">${c.sources.map((s) => `<li><code>${esc(s)}</code></li>`).join('')}</ul>` : ''}</dd>`).join('\n');
	files['history.html'] = page({
		title: 'History and acknowledgements — Foundation',
		description: "Foundation's history: original authorship, stewardship, maintenance and the 2026 transfer, with acknowledgements.",
		sidebar: modulesBox(null),
		body: `<h1>History and acknowledgements</h1>

${p(history.introduction)}

<h2>Milestones</h2>

${milestones}

<h2>The Foundation 5 upgrade</h2>

${p(history.upgradeAcknowledgement)}

<h2>Contributors</h2>

<p>The files listed under each name are examples of the evidence in the
Foundation source, not a complete record.</p>

<dl class="contributors">
${contributors}
</dl>

<h2>Community</h2>

${p(history.community)}

<h2>About this record</h2>

${p(history.recordNote)}

<p>The <a href="/docs/original/Fnd_5.4_Docs.pdf">Foundation 5.4 manual</a>
(PDF) is kept as the historical reference.</p>`,
	});
}

// index.html
{
	const rows = moduleNames.map((mod) =>
		`<tr><td><a href="/docs/${pageOf(mod)}">${esc(moduleLabel(mod))}</a></td><td class="num">${modules.get(mod).length}</td></tr>`).join('\n');
	const cls = classes.map((c) =>
		`<li><a href="/docs/classes.html#${esc(c.id)}"><code>${esc(c.title)}</code></a> (${c.members.length} function${c.members.length === 1 ? '' : 's'})</li>`).join('\n');
	files['index.html'] = page({
		title: 'Developer Reference — Foundation',
		description: 'Reference for the shared methods and classes of Foundation 6, generated from the Foundation source.',
		sidebar: modulesBox(null),
		body: `<h1>Developer Reference</h1>

<p>This reference lists the ${methods.length} shared methods of Foundation 6,
the methods a host database may call, grouped by module, and Foundation's
classes. It is generated from the method documentation in the Foundation
source. Methods not marked Shared are internal to the component and are
not listed.</p>

<p>To find a method by name, use the <a href="/docs/all.html">list of all
methods</a> and your browser's find command.</p>

<h2>Modules</h2>

<table class="modules">
<thead><tr><th scope="col">Module</th><th scope="col" class="num">Methods</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>

<h2>Classes</h2>

<ul>
${cls}
</ul>

<h2>History</h2>

<p><a href="/docs/history.html">History and acknowledgements</a>: original
authorship, stewardship, maintenance and the 2026 transfer.</p>

<h2>Foundation 5.4 manual</h2>

<p>The <a href="/docs/original/Fnd_5.4_Docs.pdf">Foundation 5.4 manual</a>
(PDF) is the historical reference for Foundation 5. Much of it still
describes Foundation 6, but where it differs from this reference, this
reference is current.</p>`,
	});
}

// ---------------------------------------------------------------- write

for (const entry of readdirSync(outDir)) {
	if (entry === 'original' || entry === 'docs.css') continue;
	rmSync(join(outDir, entry), { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });
for (const [name, html] of Object.entries(files)) writeFileSync(join(outDir, name), html);
writeFileSync(join(outDir, 'DOCS_SOURCE'),
	`Generated by scripts/build-docs.mjs from Foundation ${version} (f6 ${commit})\n` +
	`Sources: ${docsSource.label}/Methods, ${docsSource.label}/Classes, ${docsSource.label}/Foundation-History.json\n`);

// ---------------------------------------------------------------- licence

copyFileSync(join(f6, 'LICENSE'), join(siteDir, 'LICENSE'));
copyFileSync(join(f6, 'PROVENANCE.md'), join(siteDir, 'PROVENANCE.md'));

{
	const licenceText = readText(join(f6, 'LICENSE')).replace(/\n+$/, '');
	const provLines = readText(join(f6, 'PROVENANCE.md')).split('\n');
	const h1 = provLines.findIndex((l) => /^#\s+/.test(l));
	if (h1 >= 0) provLines.splice(h1, 1);
	const provenance = blocks(provLines, (level, text) => `<h${level + 1}>${esc(text)}</h${level + 1}>`, { rich: true });
	mkdirSync(join(siteDir, 'licence'), { recursive: true });
	writeFileSync(join(siteDir, 'licence', 'index.html'), frame({
		title: 'Licence · Foundation',
		description: 'The MIT licence under which Foundation is released, and the provenance of its title.',
		current: 'licence',
		sidebar: `${newsBox}
${supportBox}`,
		body: `<h1>Licence</h1>

<p>Foundation is released under the MIT licence. The text below is the
<a href="/LICENSE">LICENSE</a> file that ships in the repository and with
every build. The <a href="#provenance">provenance</a> below records the chain
of title from Dave Batton to Walt Nelson to Wayne Stewart, and the
conditions of the 2026 assignment.</p>

<pre class="licence">${esc(licenceText)}</pre>

<h2 id="provenance">Provenance</h2>

${provenance}`,
	}));
}

console.log(`${methods.length} shared methods, ${moduleNames.length} module pages, ${classes.length} classes, ${Object.keys(files).length + 1} files written (plus docs.css and original/)`);
if (failures.length) {
	console.log(`\n${failures.length} source files not parsed or incomplete:`);
	for (const f of failures) console.log(`  ${f}`);
}
