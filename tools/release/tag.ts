/**
 * Tag the release sitting in package.json.
 *
 * `changeset git-tag` skips private packages, and this one stays private,
 * so the tag is made here: an annotated `v1.0.0` on the commit that
 * carries the bump.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const manifest: unknown = JSON.parse(readFileSync('package.json', 'utf8'));

const version =
  typeof manifest === 'object' &&
  manifest != null &&
  'version' in manifest &&
  typeof manifest.version === 'string'
    ? manifest.version
    : null;

if (version == null || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('No usable version in package.json. Run `pnpm cs:ver` first.');
  process.exit(1);
}

const tag = `v${version}`;

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

if (git('tag', '-l', tag) !== '') {
  console.error(`${tag} already exists. Delete it first if you meant to move it.`);
  process.exit(1);
}

if (git('status', '--porcelain') !== '') {
  console.error('Working tree is dirty. Commit the version bump before tagging.');
  process.exit(1);
}

git('tag', '-a', tag, '-m', `Writbearer ${tag}`);
console.log(`Tagged ${tag} at ${git('rev-parse', '--short', 'HEAD')}.`);
console.log(`Push it with: git push origin ${tag}`);
