#!/bin/sh
# Refresh foundation/docs/, LICENSE and PROVENANCE.md from a Foundation repository checkout.
# Usage: scripts/refresh-docs.sh /path/to/foundation-repo
# The HTML reference left Resources/ in f6 commit 1c02b487 and now lives at
# "not res/Fnd_Shell_Documentation" (documentation approach under review).
set -e
SRC="${1:?usage: $0 /path/to/foundation-repo}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$SRC/not res/Fnd_Shell_Documentation"
[ -d "$DOCS" ] || DOCS="$SRC/Resources/Fnd_Shell_Documentation"
[ -d "$DOCS" ] || { echo "documentation folder not found in $SRC" >&2; exit 1; }
# The generator's --check still expects the old Resources/ path; report, don't stop.
( cd "$SRC" && node "$DOCS/build-current-reference.mjs" --check ) || echo "warning: build-current-reference.mjs --check failed; copying the committed output as is" >&2
HASH="$(cd "$SRC" && git rev-parse --short HEAD)"
rm -rf "$HERE/foundation/docs"
mkdir -p "$HERE/foundation/docs"
rsync -a --exclude 'build-*.mjs' --exclude README.md --exclude .DS_Store "$DOCS/" "$HERE/foundation/docs/"
cp "$SRC/LICENSE" "$HERE/foundation/LICENSE"
cp "$SRC/PROVENANCE.md" "$HERE/foundation/PROVENANCE.md"
printf 'Copied from Foundation repository (f6) commit %s on %s\nSource folder: %s\nExcluded: build scripts and README (build tooling only)\n' "$HASH" "$(date +%F)" "${DOCS#$SRC/}" > "$HERE/foundation/docs/DOCS_SOURCE"
echo "foundation/docs refreshed from $HASH"
