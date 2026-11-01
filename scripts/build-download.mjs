#!/usr/bin/env node
// Build the Download page, foundation/download/index.html, from
// foundation/download/releases.json.
//
// Usage: node scripts/build-download.mjs
//
// releases.json lists releases, newest first; each has a version, date, commit,
// four artefacts (target, label, dmg, zip, sha256dmg, sha256zip) and a
// checksums URL. An empty string means "not yet published". URLs are used
// exactly as written (Dropbox links carry ?dl=1). Plain Node, no dependencies,
// no JavaScript in the generated page.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, frame, newsBox, supportBox } from './site-frame.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'foundation', 'download');
const { releases = [] } = JSON.parse(readFileSync(join(dir, 'releases.json'), 'utf8'));

const pending = '<span class="pending">not yet published</span>';
const link = (url, name) => (url ? `<a href="${esc(url)}">${esc(name)}</a>` : pending);
const longDate = (iso) => {
	const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || '');
	if (!m) return '';
	const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	return `${parseInt(m[3], 10)} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
};

function releaseHtml(r) {
	const rows = (r.artefacts || []).map((a) => {
		const base = `Foundation-${r.version}-${a.target}`;
		const sums = [a.sha256dmg, a.sha256zip].filter(Boolean);
		const sha = sums.length
			? sums.map((h) => `<code>${esc(h)}</code>`).join('<br>')
			: pending;
		return `<tr><td>${esc(a.target)}</td><td>${esc(a.label)}</td><td>${link(a.dmg, base + '.dmg')}</td><td>${link(a.zip, base + '.zip')}</td><td class="hash">${sha}</td></tr>`;
	}).join('\n');
	const date = longDate(r.date);
	return `<h2>Foundation ${esc(r.version)}</h2>
${date ? `\n<p class="release-date"><time datetime="${esc(r.date)}">${esc(date)}</time></p>\n` : ''}
<div class="table-wrap">
<table class="data">
<thead><tr><th scope="col">Target</th><th scope="col">4D</th><th scope="col">macOS (DMG)</th><th scope="col">Windows (ZIP)</th><th scope="col">SHA-256</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>

<p>Checksums for every file: ${r.checksums ? `<a href="${esc(r.checksums)}">checksums file</a>` : pending}.</p>`;
}

const html = frame({
	title: 'Download · Foundation',
	description: 'Download Foundation 6: the compiled component for 4D 20 LTS, 20 R, 21 LTS and 21 R, with checksums.',
	current: 'download',
	sidebar: `${newsBox}\n${supportBox}`,
	body: `<h1>Download</h1>

<p>Each release ships the compiled component for four 4D targets: as a
code-signed, notarised DMG for macOS, and as a ZIP of the same component for
Windows. The floor is 4D 20 LTS. Pick the file that matches the 4D your host
database runs on.</p>

${releases.map(releaseHtml).join('\n\n')}

<h2>Verifying a download</h2>

<p>Compare the SHA-256 of the file you downloaded with the value above. On
macOS run <code>shasum -a 256 &lt;file&gt;</code>; on Windows run
<code>certutil -hashfile &lt;file&gt; SHA256</code>.</p>

<h2>Installing</h2>

<p>Copy <code>Foundation.4dbase</code> into your project's
<code>Components/</code> folder. <a href="/start/">Getting started</a> walks
through the rest.</p>`,
});
writeFileSync(join(dir, 'index.html'), html);
console.log(`download/index.html written (${releases.length} release${releases.length === 1 ? '' : 's'})`);
