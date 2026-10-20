// Rewrites root-relative links in the generated static site so it works under a sub-path,
// e.g. https://sb-xcvi.github.io/stanbonke/ instead of a domain root.
//   node scripts/prefix-base-path.mjs storage/app/static /stanbonke
// With an empty base path, or "/" (a custom domain), it does nothing.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [dir, rawBase = ''] = process.argv.slice(2);
const base = rawBase.replace(/\/+$/, '');

if (!dir) {
    console.error('Usage: node scripts/prefix-base-path.mjs <dir> <base-path>');
    process.exit(1);
}
if (!base) {
    console.log('No base path, nothing to rewrite.');
    process.exit(0);
}

async function* htmlFiles(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) yield* htmlFiles(path);
        else if (entry.name.endsWith('.html')) yield path;
    }
}

// href="/x" and src="/x", but not protocol-relative "//x" and not links that already start with the base.
const attribute = new RegExp(`\\b(href|src|action)="/(?!/|${base.slice(1)}/)`, 'g');

let count = 0;
for await (const file of htmlFiles(dir)) {
    const html = await readFile(file, 'utf8');
    const rewritten = html.replace(attribute, `$1="${base}/`);
    if (rewritten !== html) {
        await writeFile(file, rewritten);
        count++;
    }
}
console.log(`Prefixed links with ${base} in ${count} file(s).`);
