// Post-build step: esbuild with --packages=external leaves relative imports
// extensionless, but Node ESM requires explicit .js extensions. This rewrites
// `from './x'` → `from './x.js'` (and the same for dynamic `import()`) in dist/**/*.js.
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist');

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
    } else if (entry.name.endsWith('.js')) {
      const src = readFileSync(p, 'utf8');
      const fixed = src.replace(
        /(from\s+|import\(\s*)(['"])(\.\.?\/[^'"]+?)(['"])/g,
        (match, prefix, quote, path) => {
          if (path.endsWith('.js') || path.endsWith('.json') || path.endsWith('.mjs')) return match;
          return `${prefix}${quote}${path}.js${quote}`;
        },
      );
      if (fixed !== src) {
        writeFileSync(p, fixed);
        console.log('[fix-esm-ext]', p.replace(distDir, 'dist'));
      }
    }
  }
}

walk(distDir);
console.log('[fix-esm-ext] done');
