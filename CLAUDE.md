# open4dshell.com — agent guide

Static site for Open 4D Shell, Wayne Stewart's home for open-source 4D
components. This repository is **public**. Nothing private goes in it:
no signed documents, no correspondence, no credentials, no details of
Foundation's history beyond what `foundation/PROVENANCE.md` states.

Read `README.md` first for layout and the docs refresh procedure. This file
adds what an agent needs to work here safely.

## Working rules

- Australian spelling: licence, organisation, colour, behaviour.
- Plain semantic HTML5, one stylesheet per folder, no JavaScript, no
  frameworks, no CDNs, no external fonts. Light and dark via
  `prefers-color-scheme`. Understated tone, no marketing copy.
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
