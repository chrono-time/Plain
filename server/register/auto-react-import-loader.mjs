// auto-react-import-loader.mjs
// --------------------------------------------------------------
// Adds a default React import only when BOTH conditions hold:
//   1. File contains JSX.
//   2. No existing import/require brings a symbol named "React"
//      from the 'react' package.
//
//   node --experimental-loader ./auto-react-import-loader.mjs entry.jsx
// --------------------------------------------------------------
import { fileURLToPath } from 'node:url';
import { extname }       from 'node:path';

/* quick helpers ----------------------------------------------- */
const isJSXish = (code) => /<\s*[A-Za-z]/.test(code);

/* recognises ANY React import style, e.g.
   - import React from 'react'
   - import * as React from 'react'
   - import React, { useState } from 'react'
   - const React = require('react')
*/
const hasReactAlready = (code) =>
  /import\s+(?:[^'"]*\bReact\b[^'"]*)\s+from\s+['"]react['"]/.test(code) ||
  /require\(\s*['"]react['"]\s*\)/.test(code);

/* -------------------------------------------------------------- */
export async function resolve(specifier, context, defaultResolve) {
  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  const result = await defaultLoad(url, context, defaultLoad);

  /* -------- operate only on real JS/TS/JSX/TSX source -------- */
  if (!url.startsWith('file://'))     return result;
  if (result.format !== 'module')     return result;
  if (!/\.(jsx?|tsx?)$/i.test(extname(fileURLToPath(url))))
    return result;

  const src = result.source.toString();

  if (isJSXish(src) && !hasReactAlready(src)) {
    return {
      ...result,
      source: `import React from 'react';\n${src}`,
    };
  }

  return result; // unchanged
}
