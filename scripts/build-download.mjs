#!/usr/bin/env node
// Build the Download page, foundation/download/index.html, from
// foundation/download/releases.json.
//
// Usage: node scripts/build-download.mjs
//
// releases.json lists releases, newest first; each has a version, a date and
// a folder URL (a shared Dropbox folder holding every file and the checksums
// file). A release marked "withdrawn": true is listed by version and date
// only, as no longer available. The per-file fields kept in the JSON for older
// releases are a record and are not shown. Plain Node, no dependencies, no
// JavaScript in the generated page.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, frame, newsBox, supportBox } from './site-frame.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'foundation', 'download');
const { releases = [] } = JSON.parse(readFileSync(join(dir, 'releases.json'), 'utf8'));

const pending = '<span class="pending">not yet published</span>';
const longDate = (iso) => {
	const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || '');
	if (!m) return '';
	const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	return `${parseInt(m[3], 10)} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
};
const dated = (r) => (longDate(r.date) ? `<time datetime="${esc(r.date)}">${esc(longDate(r.date))}</time>` : '');

function releaseHtml(r) {
	return `<h2>Foundation ${esc(r.version)}</h2>

<p class="release-date">${dated(r)}</p>

<p>Contains builds for 4D 20 and 21, LTS and the latest R release, for Mac
(DMG) and Windows (ZIP).</p>

<p class="download">${r.folder ? `<a href="${esc(r.folder)}">Open the download folder on Dropbox</a>` : pending}</p>

<p>Download the files you need from the folder. Each file name ends with its
4D target: <code>20L</code> and <code>21L</code> for the LTS releases,
<code>20R</code> and <code>21R</code> for the R releases. A checksums file
is in the folder too.</p>`;
}

const current = releases.filter((r) => !r.withdrawn);
const withdrawn = releases.filter((r) => r.withdrawn);
const earlier = withdrawn.length
	? `<h2>Earlier releases</h2>

<p>No longer available; each was replaced by the one after it.</p>

<ul>
${withdrawn.map((r) => `<li>Foundation ${esc(r.version)}, ${dated(r)}</li>`).join('\n')}
</ul>`
	: '';

const html = frame({
	title: 'Download · Foundation',
	description: 'Download Foundation 6: the compiled component for 4D 20 LTS, 20 R, 21 LTS and 21 R, with checksums.',
	current: 'download',
	sidebar: `${newsBox}\n${supportBox}`,
	body: `<h1>Download</h1>

<p>Foundation is a compiled 4D component. The floor is 4D 20 LTS.</p>

${current.map(releaseHtml).join('\n\n')}

<h2>Installing</h2>

<p>Copy <code>Foundation.4dbase</code> into your project's
<code>Components/</code> folder. <a href="/start/">Getting started</a> walks
through the rest.</p>

<h2>Verifying a download</h2>

<p>Compare the SHA-256 of the file you downloaded with its line in the
checksums file. On macOS run <code>shasum -a 256 &lt;file&gt;</code>; on
Windows run <code>certutil -hashfile &lt;file&gt; SHA256</code>.</p>

${earlier}`,
});
writeFileSync(join(dir, 'index.html'), html);
console.log(`download/index.html written (${releases.length} release${releases.length === 1 ? '' : 's'})`);
