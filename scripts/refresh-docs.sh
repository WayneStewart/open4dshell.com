#!/bin/sh
# Refresh foundation/docs/ from a Foundation repository checkout.
# Usage: scripts/refresh-docs.sh /path/to/foundation-repo
set -e
SRC="${1:?usage: $0 /path/to/foundation-repo}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$SRC/Resources/Fnd_Shell_Documentation"
[ -d "$DOCS" ] || { echo "not found: $DOCS" >&2; exit 1; }
( cd "$SRC" && node Resources/Fnd_Shell_Documentation/build-current-reference.mjs --check )
HASH="$(cd "$SRC" && git rev-parse --short HEAD)"
rm -rf "$HERE/foundation/docs"
mkdir -p "$HERE/foundation/docs"
rsync -a --exclude 'build-*.mjs' --exclude README.md --exclude .DS_Store "$DOCS/" "$HERE/foundation/docs/"
cp "$SRC/LICENSE" "$HERE/foundation/LICENSE"
cp "$SRC/Documentation/Open-Source/PROVENANCE.md" "$HERE/foundation/PROVENANCE.md"
printf 'Copied from Foundation repository (f6) commit %s on %s\nSource folder: Resources/Fnd_Shell_Documentation\nExcluded: build scripts and README (build tooling only)\n' "$HASH" "$(date +%F)" > "$HERE/foundation/docs/DOCS_SOURCE"
echo "foundation/docs refreshed from $HASH"
