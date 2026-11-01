# open4dshell.com

Source for the Open 4D Shell static site. Wayne Stewart's home for
open-source 4D components since 2010; Foundation is the main project.

## Layout

One folder per Cloudflare Pages project, each mapped to its own
subdomain via the project's "root directory" setting:

| Folder | Cloudflare Pages root directory | Subdomain |
|---|---|---|
| `www/` | `www` | www.open4dshell.com |
| `foundation/` | `foundation` | foundation.open4dshell.com |

Each folder is a self-contained static site: plain HTML5, one small
stylesheet, no JavaScript, no build step at deploy time (the
reference is generated locally and committed).

## Generated pages

Three scripts (plain Node, no dependencies) build the generated parts of
`foundation/`. They share `scripts/site-frame.mjs` (the site chrome: masthead,
tabs, sidebar, colophon) and `scripts/markdown.mjs` (the Markdown renderers).
Output is deterministic, so a rebuild against the same input changes nothing.

### Developer Reference: foundation/docs/

```sh
node scripts/build-docs.mjs /path/to/f6
```

Reads `Methods/*.md`, `Classes/*.md` and `Foundation-History.json` from
`<f6>/Builds/Docs/Foundation-<version>/Documentation` (the release build of the
documentation, private methods already removed; the version comes from
`Resources/InfoPlist.json`, else the highest found). When that folder does not
exist it falls back to `<f6>/Documentation` and prints a warning: that source
includes private methods, so do not publish the result. It writes:

- `index.html`: contents, module list with method counts, classes, history;
- one page per module (`Fnd_Dlg_…` → `dlg.html`), shared methods only,
  each anchored by its exact name;
- `all.html`: every shared method in one list (browser find is the search);
- `classes.html` and `history.html`;
- `DOCS_SOURCE`: the f6 commit the pages were built from.

It deletes everything else under `foundation/docs/` except `original/`
(the Foundation 5.4 manual) and the hand-written `docs.css`. Source files it
cannot parse are listed on the console; fix them in f6.

The same run copies `LICENSE` and `PROVENANCE.md` from the f6 root to
`foundation/LICENSE` and `foundation/PROVENANCE.md`, and regenerates the
Licence page, `foundation/licence/index.html`, from them.

### Developer Guide: foundation/guide/

```sh
node scripts/build-guide.mjs /path/to/f6
```

Renders `Guide/*.md`, `CONTRIBUTING.md` and `Release/UPGRADING.md` from f6:
`Guide/README.md` is `guide/index.html`, `NN-Chapter.md` is `nn-chapter.html`,
`CONTRIBUTING.md` is `contributing.html` and `UPGRADING.md` is
`upgrading.html`. Links between these files are rewritten; a link to any other
repository path is shown as text with the path in `<code>`, because the
repository is private. Any line the renderer cannot classify is listed at the
end. `GUIDE_SOURCE` records the f6 commit. The script replaces everything in
`foundation/guide/`.

### Download page: foundation/download/

```sh
node scripts/build-download.mjs
```

Renders `foundation/download/index.html` from the hand-maintained
`foundation/download/releases.json` (versions, file URLs and SHA-256 hashes;
an empty value shows as "not yet published"). URLs are used as written.

## Licence

Site content (this README, page copy, layout) is © Wayne Stewart.
Foundation itself — the software and its documentation under
`foundation/docs/` — is released under the MIT licence; see
`foundation/LICENSE` and `foundation/PROVENANCE.md`.
