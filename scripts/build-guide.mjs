#!/usr/bin/env node
// Build the Foundation Developer Guide (foundation/guide/) from the Markdown in
// a Foundation repository checkout.
//
// Usage: node scripts/build-guide.mjs /path/to/f6
//
// Reads (never writes) <f6>/Guide/*.md, <f6>/CONTRIBUTING.md and
// <f6>/Release/UPGRADING.md. Guide/README.md becomes guide/index.html,
// NN-Chapter-Name.md becomes nn-chapter-name.html, CONTRIBUTING.md becomes
// contributing.html and UPGRADING.md becomes upgrading.html. Replaces
// everything under foundation/guide/. Output is deterministic: no timestamps;
// the f6 commit goes in foundation/guide/GUIDE_SOURCE. Plain Node, no
// dependencies, no JavaScript in the generated pages. Lines of Markdown the
// renderer could not classify are listed at the end (file:line).

import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { esc, frame, supportBox } from './site-frame.mjs';
import { guideBlocks, guideInline } from './markdown.mjs';

const f6 = process.argv[2];
if (!f6) {
	console.error('usage: node scripts/build-guide.mjs /path/to/f6');
	process.exit(1);
}
const siteDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'foundation');
const outDir = join(siteDir, 'guide');
const commit = execFileSync('git', ['-C', f6, 'describe', '--tags', '--long', '--always'], { encoding: 'utf8' }).trim();
let version = 'unknown version';
try { version = JSON.parse(readFileSync(join(f6, 'Resources', 'InfoPlist.json'), 'utf8').replace(/^\uFEFF/, '')).CFBundleShortVersionString || version; } catch { /* leave */ }
const readText = (p) => readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');

// ---------------------------------------------------------------- sources

const pageName = (md) => md.replace(/\.md$/, '').toLowerCase() + '.html';
const chapterFiles = readdirSync(join(f6, 'Guide')).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();

const sources = [
	{ path: 'Guide/README.md', out: 'index.html', label: null },
	...chapterFiles.map((f) => ({ path: `Guide/${f}`, out: pageName(f), label: null })),
	{ path: 'Release/UPGRADING.md', out: 'upgrading.html', label: '11. Upgrading from Foundation 5' },
	{ path: 'CONTRIBUTING.md', out: 'contributing.html', label: 'Contributing' },
];
for (const s of sources) {
	s.lines = readText(join(f6, s.path)).split('\n');
	const h1 = s.lines.findIndex((l) => /^#\s+/.test(l));
	s.h1Index = h1;
	s.h1 = h1 >= 0 ? s.lines[h1].replace(/^#\s+/, '').trim() : s.path;
	if (s.label === null) s.label = s.out === 'index.html' ? 'Overview' : s.h1;
}
// Chapter 6's heading is not numbered in the source; the sidebar numbers it.
for (const s of sources) {
	const n = s.path.match(/Guide\/(\d\d)-/);
	if (n && !/^\d+\./.test(s.label)) s.label = `${parseInt(n[1], 10)}. ${s.label}`;
}

// ---------------------------------------------------------------- links

const known = new Map(chapterFiles.map((f) => [f, pageName(f)]));
known.set('../CONTRIBUTING.md', 'contributing.html');
known.set('../Release/UPGRADING.md', 'upgrading.html');

function linkFor(url) {
	if (/^(https?:|mailto:|#)/.test(url)) return { href: url };
	const [path, hash = ''] = url.split('#');
	if (path === '../PROVENANCE.md') return { href: '/licence/#provenance' };
	if (path === 'README.md') return { href: '/guide/' + (hash ? '#' + hash : '') };
	if (known.has(path)) return { href: '/guide/' + known.get(path) + (hash ? '#' + hash : '') };
	return { code: path.replace(/^\.\.\//, '') };
}

// ---------------------------------------------------------------- pages

const unclassified = [];
const sidebar = (current) => `\t<section class="box">
\t\t<h2>Guide</h2>
\t\t<ul class="nav">
\t\t\t<li><a href="/guide/"${current === 'index.html' ? ' aria-current="page"' : ''}>Overview</a></li>
${sources.filter((s) => s.out !== 'index.html').map((s) =>
	`\t\t\t<li><a href="/guide/${s.out}"${s.out === current ? ' aria-current="page"' : ''}>${esc(s.label)}</a></li>`).join('\n')}
\t\t</ul>
\t</section>
\t<section class="box">
\t\t<h2>Reference</h2>
\t\t<ul class="nav">
\t\t\t<li><a href="/docs/">Developer Reference</a></li>
\t\t</ul>
\t</section>
${supportBox}`;

const files = {};
for (const s of sources) {
	const ctx = {
		linkFor,
		slugs: new Set(),
		skip: new Set(s.h1Index >= 0 ? [s.h1Index] : []),
		unclassified: (n, line, why) => unclassified.push(`${s.path}:${n}: ${why}: ${line.trim().slice(0, 70)}`),
	};
	const body = guideBlocks(s.lines, ctx);
	files[s.out] = frame({
		title: `${s.h1} · Foundation Guide`,
		description: `${s.h1}, from the Foundation 6 Developer Guide.`,
		docs: true,
		current: 'guide',
		sidebar: sidebar(s.out),
		body: `<h1>${guideInline(s.h1, linkFor)}</h1>\n\n${body}`,
	});
}

// ---------------------------------------------------------------- write

mkdirSync(outDir, { recursive: true });
for (const entry of readdirSync(outDir)) rmSync(join(outDir, entry), { recursive: true, force: true });
for (const [name, html] of Object.entries(files)) writeFileSync(join(outDir, name), html);
writeFileSync(join(outDir, 'GUIDE_SOURCE'),
	`Generated by scripts/build-guide.mjs from Foundation ${version} (f6 ${commit})\n` +
	`Sources: Guide/*.md, CONTRIBUTING.md, Release/UPGRADING.md\n`);

console.log(`${Object.keys(files).length} guide pages written to foundation/guide/`);
if (unclassified.length) {
	console.log(`\n${unclassified.length} line(s) the renderer could not classify (kept as text):`);
	for (const u of unclassified) console.log(`  ${u}`);
}
