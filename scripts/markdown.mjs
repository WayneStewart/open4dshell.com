// Markdown helpers shared by the generators. inline(), blocks(), tableHtml()
// and cells() render the Foundation method documentation and PROVENANCE.md;
// guideBlocks() and guideInline() render the Developer Guide, CONTRIBUTING.md
// and UPGRADING.md. Plain Node, no dependencies.

import { esc } from './site-frame.mjs';

export { esc };
export const unescapeMd = (s) => s.replace(/\\([\\`*_{}\[\]()#+\-.!|<>~])/g, '$1');

// Inline markdown: `code` spans and **bold**; everything else is text.
// With opts.rich (used for PROVENANCE.md only) *italics* and bare email
// addresses are rendered too; the method documentation never sets it.
export function inline(s, opts = {}) {
	return s.split(/(`[^`]*`)/).map((part) => {
		if (part.length > 1 && part.startsWith('`') && part.endsWith('`')) {
			return `<code>${esc(part.slice(1, -1))}</code>`;
		}
		let t = esc(unescapeMd(part)).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
		if (opts.rich) {
			t = t.replace(/\*([^*\s](?:[^*]*[^*\s])?)\*/g, '<em>$1</em>')
				.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<a href="mailto:$&">$&</a>');
		}
		return t;
	}).join('');
}

// Block markdown: fenced code, ### headings, bullet lists, column-aligned
// runs (kept as preformatted) and paragraphs. headingFor() renders a heading line.
// With opts.rich (PROVENANCE.md only) numbered lists and pipe tables are
// recognised as well, the column-aligned heuristic is off, and inline() runs rich.
export function blocks(lines, headingFor, opts = {}) {
	const out = [];
	const rich = !!opts.rich;
	const inl = (s) => inline(s, opts);
	let para = [], list = [], pre = [], olist = [], table = [];
	const flush = () => {
		if (para.length) out.push(`<p>${para.map(inl).join(' ')}</p>`);
		if (list.length) out.push(`<ul>\n${list.map((l) => `<li>${inl(l)}</li>`).join('\n')}\n</ul>`);
		if (olist.length) out.push(`<ol>\n${olist.map((l) => `<li>${inl(l)}</li>`).join('\n')}\n</ol>`);
		if (pre.length) out.push(`<pre>${esc(pre.join('\n'))}</pre>`);
		if (table.length) out.push(tableHtml(table, inl));
		para = []; list = []; pre = []; olist = []; table = [];
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
		if (rich && /^\s*\|/.test(line)) {
			if (!table.length) flush();
			table.push(line);
			continue;
		}
		const ol = rich ? line.match(/^\s?\d+\.\s+(.*)$/) : null;
		if (ol) {
			if (!olist.length) flush();
			olist.push(ol[1]);
			continue;
		}
		if (olist.length && /^\s{2,}\S/.test(line)) { olist[olist.length - 1] += ' ' + line.trim(); continue; }
		const li = line.match(/^\s?[-*]\s+(.*)$/);
		if (li) {
			if (para.length || pre.length) flush();
			list.push(li[1]);
			continue;
		}
		if (list.length && /^\s{2,}\S/.test(line)) { list[list.length - 1] += ' ' + line.trim(); continue; }
		// A line aligned in columns starts a preformatted run, which lasts to
		// the next blank line. Other indented lines are wrapped prose.
		if (pre.length || (!rich && /\S {3,}\S/.test(line))) {
			if (para.length || list.length) flush();
			pre.push(unescapeMd(line.replace(/^\s+/, '')));
			continue;
		}
		if (list.length || olist.length || table.length) flush();
		para.push(line.trim());
	}
	flush();
	return out.join('\n');
}

// A pipe table as HTML: first row is the header, the separator row is dropped.
// The wrapper lets a wide table scroll inside the panel on a narrow screen.
export function tableHtml(rows, inl) {
	const parsed = rows.map(cells).filter((c) => !c.every((x) => /^:?-*:?$/.test(x)));
	const [head, ...body] = parsed;
	const tr = (c, tag) => `<tr>${c.map((x) => `<${tag}${tag === 'th' ? ' scope="col"' : ''}>${inl(x)}</${tag}>`).join('')}</tr>`;
	return `<div class="table-wrap">
<table class="provenance">
<thead>${tr(head, 'th')}</thead>
<tbody>
${body.map((c) => tr(c, 'td')).join('\n')}
</tbody>
</table>
</div>`;
}

// Split a markdown table row on unescaped pipes.
export function cells(row) {
	const inner = row.trim().replace(/^\|/, '').replace(/\|$/, '');
	return inner.split(/(?<!\\)\|/).map((c) => unescapeMd(c.trim()));
}

// ---------------------------------------------------------------- guide dialect

// Inline Markdown for the guide: `code`, backslash escapes, [text](url),
// <https://…> autolinks, **bold** and *italic*. linkFor(url) returns either
// { href } or { code } (a repository path that is not published, shown as text).
export function guideInline(s, linkFor = (u) => ({ href: u })) {
	const stash = [];
	const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
	let t = s.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${esc(c)}</code>`));
	t = t.replace(/\\([\\`*_{}\[\]()#+\-.!|<>~])/g, (_, c) => keep(esc(c)));
	t = esc(t);
	const emph = (x) => x
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/(?<![\w*])\*([^*\s](?:[^*]*[^*\s])?)\*(?![\w*])/g, '<em>$1</em>');
	t = t.replace(/&lt;(https?:\/\/[^\s&]+(?:&amp;[^\s&]*)*)&gt;/g, (_, u) => keep(`<a href="${u}">${u}</a>`));
	t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => {
		const href = url.replace(/&amp;/g, '&');
		const r = linkFor(href);
		if (r.href !== undefined) return keep(`<a href="${esc(r.href)}">${emph(text)}</a>`);
		const same = text.replace(/\u0000(\d+)\u0000/g, (_m, i) => stash[i]) === `<code>${esc(r.code)}</code>`;
		return keep(same ? `<code>${esc(r.code)}</code>` : `${emph(text)} (<code>${esc(r.code)}</code>)`);
	});
	t = emph(t);
	while (/\u0000\d+\u0000/.test(t)) t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[i]);
	return t;
}

export function slugify(text) {
	return text.replace(/`/g, '').toLowerCase().replace(/&/g, ' and ')
		.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

function guideCells(row) {
	const inner = row.trim().replace(/^\|/, '').replace(/\|$/, '');
	return inner.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

// Block Markdown for the guide. ctx = { linkFor, slugs: Set, unclassified(i, line, why) }.
// `lines` is the whole file; lines before `from` and any index in ctx.skip are ignored,
// so line numbers in warnings are real file lines (1-based = index + 1).
export function guideBlocks(lines, ctx, from = 0) {
	const inl = (s) => guideInline(s, ctx.linkFor);
	const out = [];
	let para = [];
	const flushPara = () => {
		if (para.length) out.push(`<p>${inl(para.map((l) => l.trim()).join(' '))}</p>`);
		para = [];
	};
	const listItem = (l) => l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
	for (let i = from; i < lines.length; i++) {
		const line = lines[i];
		if (ctx.skip && ctx.skip.has(i)) continue;
		if (/^\s*$/.test(line)) { flushPara(); continue; }
		if (/^\s*```/.test(line)) {
			flushPara();
			const code = [];
			for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
			out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
			continue;
		}
		const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
		if (h) {
			flushPara();
			const level = h[1].length;
			const raw = h[2];
			if (level === 2 || level === 3) {
				let id = slugify(raw) || 'section';
				const base = id;
				for (let n = 2; ctx.slugs.has(id); n++) id = `${base}-${n}`;
				ctx.slugs.add(id);
				out.push(`<h${level} id="${esc(id)}">${inl(raw)}</h${level}>`);
			} else {
				out.push(`<h${level}>${inl(raw)}</h${level}>`);
			}
			continue;
		}
		if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line) && !para.length) { out.push('<hr>'); continue; }
		if (/^\s{0,3}-{3,}\s*$/.test(line) && para.length) { ctx.unclassified(i + 1, line, 'setext heading or rule after a paragraph'); flushPara(); continue; }
		if (/^\s*>/.test(line)) {
			flushPara();
			const q = [];
			for (; i < lines.length && /^\s*>/.test(lines[i]); i++) q.push(lines[i].replace(/^\s*> ?/, ''));
			i--;
			out.push(`<blockquote>\n${guideBlocks(q, { ...ctx, unclassified: (n, l, w) => ctx.unclassified(i + 1, l, w) })}\n</blockquote>`);
			continue;
		}
		if (/^\s*\|/.test(line)) {
			flushPara();
			const rows = [];
			for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(lines[i]);
			i--;
			const parsed = rows.map(guideCells).filter((c) => !c.every((x) => /^:?-*:?$/.test(x)));
			const [head, ...body] = parsed;
			for (const r of body) if (r.length !== head.length) ctx.unclassified(i + 1, rows.join(' / ').slice(0, 60), `table row with ${r.length} cells, header has ${head.length}`);
			const tr = (c, tag) => `<tr>${c.map((x) => `<${tag}${tag === 'th' ? ' scope="col"' : ''}>${inl(x)}</${tag}>`).join('')}</tr>`;
			out.push(`<div class="table-wrap">\n<table class="provenance">\n<thead>${tr(head, 'th')}</thead>\n<tbody>\n${body.map((c) => tr(c, 'td')).join('\n')}\n</tbody>\n</table>\n</div>`);
			continue;
		}
		const li = listItem(line);
		if (li) {
			flushPara();
			// Collect items (with one level of nesting by indentation) until a
			// line that is neither an item, an indented continuation, nor a blank
			// line followed by more of the list.
			const items = [];
			const base = li[1].length;
			for (; i < lines.length; i++) {
				if (ctx.skip && ctx.skip.has(i)) continue;
				const l = lines[i];
				const m = listItem(l);
				if (m && m[1].length >= base) {
					const ordered = /\d/.test(m[2]);
					const nested = m[1].length > base;
					if (nested && !items.length) { ctx.unclassified(i + 1, l, 'indented first list item'); }
					const it = { ordered, num: ordered ? parseInt(m[2], 10) : 0, text: m[3], kids: [], nested };
					if (nested && items.length) items[items.length - 1].kids.push(it); else items.push(it);
					continue;
				}
				if (/^\s*$/.test(l)) {
					let j = i + 1;
					while (j < lines.length && /^\s*$/.test(lines[j])) j++;
					const nx = lines[j];
					if (nx !== undefined && !/^\s*```/.test(nx) && (listItem(nx) && listItem(nx)[1].length >= base)) { i = j - 1; continue; }
					break;
				}
				if (/^\s+\S/.test(l) && !/^\s*```/.test(l) && items.length) {
					const last = items[items.length - 1];
					const tgt = last.kids.length ? last.kids[last.kids.length - 1] : last;
					tgt.text += ' ' + l.trim();
					continue;
				}
				break;
			}
			i--;
			const render = (its) => {
				const ordered = its[0].ordered;
				const tag = ordered ? 'ol' : 'ul';
				const start = ordered && its[0].num !== 1 ? ` start="${its[0].num}"` : '';
				return `<${tag}${start}>\n${its.map((it) => {
					const kids = it.kids.length ? '\n' + render(it.kids) : '';
					return `<li>${inl(it.text)}${kids}</li>`;
				}).join('\n')}\n</${tag}>`;
			};
			out.push(render(items));
			continue;
		}
		// Constructs the renderer does not understand are kept as text but reported.
		if (/^\s*</.test(line) && !/^\s*<https?:\/\/\S+>/.test(line)) ctx.unclassified(i + 1, line, 'raw HTML');
		else if (/^ {4,}\S/.test(line) && !para.length) ctx.unclassified(i + 1, line, 'indented code block');
		else if (/^\s*!\[/.test(line)) ctx.unclassified(i + 1, line, 'image');
		else if (/^\s*~~~/.test(line)) ctx.unclassified(i + 1, line, 'tilde fence');
		else if (/^\s*\[[^\]]+\]:\s/.test(line)) ctx.unclassified(i + 1, line, 'link reference definition');
		para.push(line);
	}
	flushPara();
	return out.join('\n');
}
