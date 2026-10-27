#!/usr/bin/env bash
# Publishes the version in package.json as a tagged GitHub release, with that
# version's CHANGELOG section as the notes. Run by the release workflow once no
# changesets are pending, so a version already released is left alone.
set -euo pipefail

version="$(node -p "require('./package.json').version")"
tag="v$version"

if gh release view "$tag" > /dev/null 2>&1; then
  echo "$tag is already released"
  exit 0
fi

# No changeset has been versioned yet, so there is nothing to release
if [ ! -f CHANGELOG.md ]; then
  echo "No CHANGELOG.md yet, so $tag is not released"
  exit 0
fi

notes="$(mktemp)"
awk -v v="$version" '$0 == "## " v {found=1; next} found && /^## / {exit} found {print}' \
  CHANGELOG.md > "$notes"

if [ ! -s "$notes" ]; then
  echo "CHANGELOG.md has no section for $version" >&2
  exit 1
fi

# The same annotated tag `pnpm cs:tag` makes by hand, unless GitHub has it already
git fetch --tags --quiet
if [ -z "$(git tag -l "$tag")" ]; then
  node tools/release/tag.ts
  git push origin "$tag"
fi

gh release create "$tag" --title "Writbearer $tag" --notes-file "$notes" --verify-tag
