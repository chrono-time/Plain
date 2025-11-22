// asset-loader.mjs                Node ≥ 20.6  •  pure-ESM loader
// -----------------------------------------------------------------------------
// Mirrors Vite’s asset-import behaviour inside a plain Node runtime:
//
//   • Inlines anything ≤ 4 KB as a data-URI
//   • Copies larger files to  dist/assets/<name>.<hash>.<ext>
//   • Handles the query flags ?url  ?inline  ?raw
//   • Exports width/height for raster images
// -----------------------------------------------------------------------------

import { readFile, copyFile, mkdir } from 'node:fs/promises';
import { createHash }                 from 'node:crypto';
import { extname, basename, join }    from 'node:path';
import { fileURLToPath }              from 'node:url';
import mime                           from 'mime';
import sizeOf                         from 'image-size';

/* ───────────────────────────────  CONFIG  ──────────────────────────────── */
const ASSET_RE      = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp|mp4|webm|mp3|wav|ogg|flac|aac|woff2?|eot|ttf|otf)$/i;
const INLINE_LIMIT  = 4 * 1024;                       // 4 KB (Vite default)
const OUT_DIR       = join(process.cwd(), 'dist/assets');
/* ────────────────────────────────────────────────────────────────────────── */

/* 1️⃣  resolve hook – decide whether we care about this specifier */
export async function resolve(specifier, context, nextResolve) {
  const [bare, query = ''] = specifier.split('?');

  if (ASSET_RE.test(bare)) {
    // Convert to absolute file URL so Node can open it
    const url = new URL(bare, context.parentURL).href + (query ? `?${query}` : '');
    return { url, shortCircuit: true };          // we’ll handle loading
  }

  // Defer everything else to the built-in resolver chain
  return nextResolve(specifier, context, nextResolve);
}

/* 2️⃣  load hook – return ESM source code for the asset */
export async function load(urlWithQuery, context, nextLoad) {
  // Strip query for filesystem ops, keep it for flags
  const [url, query = ''] = urlWithQuery.split('?');

  if (!ASSET_RE.test(url)) {
    // Not an asset we handle → fall back to default loader
    return nextLoad(urlWithQuery, context, nextLoad);
  }

  /* ------------------  decide inline vs file vs raw  ------------------ */
  const buf         = await readFile(fileURLToPath(url));
  const ext         = extname(url);
  const type        = mime.getType(ext) || 'application/octet-stream';

  const alwaysURL    = query.includes('url');
  const alwaysInline = query.includes('inline');
  const raw          = query.includes('raw');
  const inline       = (!alwaysURL && (alwaysInline || buf.length <= INLINE_LIMIT));

  /* 2a.  ?raw  — export file contents as UTF-8 string */
  if (raw) {
    const text = buf.toString('utf8');
    return {
      format: 'module',
      source: `export default ${JSON.stringify(text)};`,
      shortCircuit: true
    };
  }
  console.log(inline)
  /* 2b.  inline data-URI */
  if (inline) {
    const dataURI = `data:${type};base64,${buf.toString('base64')}`;
    return {
      format: 'module',
      source: `export default ${JSON.stringify(dataURI)};`,
      shortCircuit: true
    };
  }

  /* 2c.  external hashed file */
  const file  = `${basename(url, ext)}${ext}`;

  const pubURL = `/_assets/${file}`;

  /* Optional width/height export for raster images */
  let dims = '';
  try {
    const { width, height } = sizeOf(buf);
    if (width && height) dims = `\nexport const width=${width}, height=${height};`;
  } catch { /* non-image types → ignore */ }

  return {
    format: 'module',
    source: `export default ${JSON.stringify(pubURL)};${dims}`,
    shortCircuit: true
  };
}
