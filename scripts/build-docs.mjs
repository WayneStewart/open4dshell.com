#!/usr/bin/env node
// Build the Foundation Developer Reference (foundation/docs/) from the
// method and class documentation in a Foundation repository checkout.
//
// Usage: node scripts/build-docs.mjs /path/to/f6
//
// Reads (never writes) <f6>/Documentation/Methods/*.md, Classes/*.md and
// Foundation-History.json. Replaces everything under foundation/docs/ except
// original/ and the hand-written docs.css. Output is deterministic: no timestamps; the f6 commit goes in
// foundation/docs/DOCS_SOURCE. Plain Node, no dependencies, no JavaScript in
// the generated pages.

import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const f6 = process.argv[2];
if (!f6) {
	console.error('usage: node scripts/build-docs.mjs /path/to/f6');
	process.exit(1);
}
const srcDocs = join(f6, 'Documentation');
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'foundation', 'docs');
const commit = execFileSync('git', ['-C', f6, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();

// ---------------------------------------------------------------- text helpers

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescapeMd = (s) => s.replace(/\\([\\`*_{}\[\]()#+\-.!|<>~])/g, '$1');
const readText = (p) => readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');
const byName = (a, b) => {
	const x = a.toLowerCase(), y = b.toLowerCase();
	return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
};

// Inline markdown: `code` spans and **bold**; everything else is text.
function inline(s) {
	return s.split(/(`[^`]*`)/).map((part) => {
		if (part.length > 1 && part.startsWith('`') && part.endsWith('`')) {
			return `<code>${esc(part.slice(1, -1))}</code>`;
		}
		return esc(unescapeMd(part)).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	}).join('');
}

// Block markdown: fenced code, ### headings, bullet lists, column-aligned
// runs (kept as preformatted) and paragraphs. headingFor() renders a heading line.
function blocks(lines, headingFor) {
	const out = [];
	let para = [], list = [], pre = [];
	const flush = () => {
		if (para.length) out.push(`<p>${para.map(inline).join(' ')}</p>`);
		if (list.length) out.push(`<ul>\n${list.map((l) => `<li>${inline(l)}</li>`).join('\n')}\n</ul>`);
		if (pre.length) out.push(`<pre>${esc(pre.join('\n'))}</pre>`);
		para = []; list = []; pre = [];
	};
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const fence = line.match(/^\s*```/);
		if (fence) {
			flush();
			const code = [];
			for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
			out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
			continue;
		}
		const h = line.match(/^(#{2,4})\s+(.*)$/);
		if (h && headingFor) { flush(); out.push(headingFor(h[1].length, unescapeMd(h[2].trim()))); continue; }
		if (/^\s*$/.test(line)) { flush(); continue; }
		const li = line.match(/^\s?[-*]\s+(.*)$/);
		if (li) {
			if (para.length || pre.length) flush();
			list.push(li[1]);
			continue;
		}
		if (list.length && /^\s{2,}\S/.test(line)) { list[list.length - 1] += ' ' + line.trim(); continue; }
		// A line aligned in columns starts a preformatted run, which lasts to
		// the next blank line. Other indented lines are wrapped prose.
		if (pre.length || /\S {3,}\S/.test(line)) {
			if (para.length || list.length) flush();
			pre.push(unescapeMd(line.replace(/^\s+/, '')));
			continue;
		}
		if (list.length) flush();
		para.push(line.trim());
	}
	flush();
	return out.join('\n');
}

// Split a markdown table row on unescaped pipes.
function cells(row) {
	const inner = row.trim().replace(/^\|/, '').replace(/\|$/, '');
	return inner.split(/(?<!\\)\|/).map((c) => unescapeMd(c.trim()));
}

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

function page({ title, description, sidebar, body }) {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/docs/docs.css">
</head>
<body>

<header class="masthead">
	<a class="wordmark" href="/">Foundation</a>
	<span class="edition">6</span>
</header>

<nav class="tabs" aria-label="Site">
	<ul>
		<li><a href="/">Home</a></li>
		<li><a href="/start/">Getting started</a></li>
		<li><a href="/docs/" aria-current="page">Docs</a></li>
		<li><a href="/LICENSE">Licence</a></li>
		<li><a href="#contact">Contact</a></li>
	</ul>
</nav>

<div class="frame">

<aside class="sidebar">
${sidebar}
</aside>

<main class="panel">

${body}

</main>

</div>

<footer class="colophon">
	<p>Copyright &copy; 1993–2008 Dave Batton<br>
	Copyright &copy; 2008–2026 Walt Nelson<br>
	Copyright &copy; 2026 Wayne Stewart</p>
	<p>Released under the <a href="/LICENSE">MIT licence</a>.</p>
	<p id="contact">Contact: <a href="mailto:wayne.b.stewart@gmail.com">wayne.b.stewart@gmail.com</a></p>
</footer>

</body>
</html>
`;
}

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
	`Generated by scripts/build-docs.mjs from Foundation repository (f6) commit ${commit}\n` +
	`Sources: Documentation/Methods, Documentation/Classes, Documentation/Foundation-History.json\n`);

console.log(`${methods.length} shared methods, ${moduleNames.length} module pages, ${classes.length} classes, ${Object.keys(files).length + 1} files written (plus docs.css and original/)`);
if (failures.length) {
	console.log(`\n${failures.length} source files not parsed or incomplete:`);
	for (const f of failures) console.log(`  ${f}`);
}
