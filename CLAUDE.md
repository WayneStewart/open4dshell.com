# open4dshell.com — agent guide

Static site for Open 4D Shell, Wayne Stewart's home for open-source 4D
components. This repository is **public**. Nothing private goes in it:
no signed documents, no correspondence, no credentials, no details of
Foundation's history beyond what `foundation/PROVENANCE.md` states.

Read `README.md` first for layout and the docs refresh procedure. This file
adds what an agent needs to work here safely.

## Working rules

- Australian spelling: licence, organisation, colour, behaviour.
- Plain semantic HTML5, one stylesheet per folder, no frameworks, no
  CDNs, no external fonts. Light and dark via `prefers-color-scheme`.
  Understated tone, no marketing copy.
- No JavaScript in the hand-written pages (`www/`, `foundation/*.html`).
  Every page must read and navigate fully without it. The generated
  reference under `foundation/docs/` carries a small inline script for
  search filtering and hash reveal; that comes from the Foundation
  generator, is self-contained, makes no network requests, and degrades
  to a plain page when scripts are off. It is acceptable as is.
- Contact address everywhere is `wayne@open4dshell.com`.
- Never hand-edit anything under `foundation/docs/`. It is generated in the
  Foundation repository and copied here; see README and
  `scripts/refresh-docs.sh`. Fix the source there and refresh.
- `foundation/LICENSE` and `foundation/PROVENANCE.md` are verbatim copies of
  the Foundation repository's `LICENSE` and
  `Documentation/Open-Source/PROVENANCE.md`. Change them there first.
- Commit with `git add -A`; keep the tree clean. Pushing to `main` deploys.

## Hosting

Cloudflare account (Wayne's), zone `open4dshell.com`, DNS on Cloudflare,
registrar Hover. Two Cloudflare Pages projects connected to this GitHub
repository, production branch `main`, no build command:

| Pages project | Root directory | Hostname |
|---|---|---|
| `open4dshell-www` | `www` | www.open4dshell.com, and the apex |
| `open4dshell-foundation` | `foundation` | foundation.open4dshell.com |

Every push to `main` redeploys both within about a minute; there is
nothing to trigger. Pages serves clean URLs (`/docs/history` for
`/docs/history.html`) with a 308; that is default behaviour, not a bug.
Cloudflare's Email Address Obfuscation rewrites `mailto:` links in the
served HTML; the source stays plain.

A new subdomain = a new top-level folder here + a new Pages project with
that folder as root directory + a custom domain on the project.

A smaller project needs none of that: a folder under `www/` (for
example `www/kvp/`) is served at `www.open4dshell.com/kvp/` on the next
push. Promote to a subdomain later only if the project grows its own
docs and identity.

## Candidate projects (as at 2026-09-15, documented only, no work started)

All are Wayne's own components in private repositories, each still
without a licence file. Adding one (MIT, matching Foundation) is the
first step for any of them. None has a provenance question comparable
to Foundation's, except the logging component, which descends from Dave
Batton's free Foundation 4 Logging component with the author's
permission; its page should say so.

| Project | What it is | Suggested tier | Readiness |
|---|---|---|---|
| nativeObjectTools (OTr) | Native 4D replacement for the ObjectTools plugin API, ~900 methods, extensive specs and a README | Subdomain | Most advanced: public GitHub repository already exists; docs are markdown, not yet built as HTML |
| kvp | Key-value pair component, successor to the 2010-era KVP for 4D v11–v13 | Path under www | Method docs exist; no README |
| logging | Modern logging component: named logs, levels, routing, PostgreSQL delivery; lineage from Foundation 4 Logging | Path under www, possibly subdomain later | Feature document and method docs exist; no README |
| process-viewer | Small process-list viewer utility (~18 methods) | Path under www | Method docs only; last touched January 2025 |
| select | Small selection example/utility component | Path under www | One-line README; last touched January 2025 |

## Verifying a deploy

```bash
for h in www.open4dshell.com foundation.open4dshell.com open4dshell.com; do
  curl -sS -o /dev/null -w "%{http_code} %{url_effective}\n" -L "https://$h/"
done
```

## Relationship to Foundation

The Foundation source lives in a separate, currently private repository
(`f6`). Foundation work, its Jira tickets (FND project) and its release
never happen from this repository. This site only publishes copies.
Foundation's own history is in `foundation/docs/history.html`; the
authoritative source for it is `Documentation/Foundation-History.json`
in the Foundation repository.

## Open items (as at 2026-09-15)

- Apex `open4dshell.com` serves the site directly; a Cloudflare redirect
  rule to `www` is still to be added (zone Rules → Redirect Rules).
- `wayne@open4dshell.com` needs Google Workspace activation of the alias
  domain plus MX (`smtp.google.com`, priority 1, DNS only) and SPF
  (`v=spf1 include:_spf.google.com ~all`) records in Cloudflare DNS.
- `foundation/docs/` will need refreshing once the Foundation repository
  removes its legacy registration module (FND-60 to FND-65).
- When the public Foundation repository exists, replace the "public
  repository coming" line on `foundation/index.html` with the link.
