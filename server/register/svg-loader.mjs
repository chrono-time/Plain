// svg-loader.mjs      (Node ≥ 16, ESM only)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { transform } from '@svgr/core';
import { transform as esbuild } from 'esbuild';

/* 1️⃣  resolve hook */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.svg')) {
    return {
      url: new URL(specifier, context.parentURL).href,
      shortCircuit: true        // ← tell Node “stop-the-chain, we handled it”
    };
  }
  return nextResolve(specifier, context, nextResolve);
}

/* 2️⃣  load hook */
export async function load(url, context, nextLoad) {
  if (url.endsWith('.svg')) {
    const svg = String(readFileSync(fileURLToPath(url), 'utf8'));
    const source = await transform(
      svg,
      { jsxRuntime: 'automatic',  plugins: ["@svgr/plugin-jsx"] }
    );

    const { code } = await esbuild(source, {
      loader: 'tsx',
      format: 'esm',
      jsx: 'automatic',
      target: 'es2020',
    });


    return {
      format: 'module',
      source: code,
      shortCircuit: true        // ← again, declare intentional short circuit
    };
  }
  return nextLoad(url, context, nextLoad);
}
