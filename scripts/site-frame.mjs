// The site frame shared by every generated Foundation page (build-docs.mjs,
// build-guide.mjs, build-download.mjs). Plain Node, no dependencies.

export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The site frame shared by every page. `docs` pages add docs.css and mark the
// Docs tab current; the Licence page marks its own tab. Links are root-relative.
export function frame({ title, description, sidebar, body, docs = false, current = 'docs' }) {
	const tab = (href, label, key) =>
		`\t\t<li><a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a></li>`;
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png">
<link rel="stylesheet" href="/styles.css">${docs ? '\n<link rel="stylesheet" href="/docs/docs.css">' : ''}
</head>
<body>

<header class="masthead">
	<a class="wordmark" href="/">Foundation</a>
	<span class="edition">6</span>
</header>

<nav class="tabs" aria-label="Site">
	<ul>
${tab('/', 'Home', 'home')}
${tab('/start/', 'Getting started', 'start')}
${tab('/guide/', 'Guide', 'guide')}
${tab('/docs/', 'Docs', 'docs')}
${tab('/download/', 'Download', 'download')}
${tab('/licence/', 'Licence', 'licence')}
${tab('#contact', 'Contact', 'contact')}
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
	<p>Released under the <a href="/licence/">MIT licence</a>.</p>
	<p id="contact">Contact: <a href="mailto:wayne@4dtoday.com">wayne@4dtoday.com</a></p>
</footer>

</body>
</html>
`;
}

// Sidebar boxes common to the generated pages outside the Developer Reference.
export const newsBox = `\t<section class="box">
\t\t<h2>News</h2>
\t\t<p><time datetime="2026-11-08">8 Nov 2026</time>: Foundation
\t\t6.0.0-beta.2 adds a search box and font choices to the list window.
\t\t<a href="/guide/upgrading.html#600-beta2-private-beta-8-november-2026">What changed</a>.</p>
\t\t<p><time datetime="2026-11-01">1 Nov 2026</time>: Foundation
\t\t6.0.0-beta.1 opens as a private beta.</p>
\t</section>`;

export const supportBox = `\t<section class="box">
\t\t<h2>Support</h2>
\t\t<p><a href="https://github.com/open4dshell/Foundation-Product-Sales/issues">Issues</a>
\t\tin Foundation Product Sales (beta testers).</p>
\t\t<p>Email: see <a href="#contact">contact</a>.</p>
\t</section>`;
