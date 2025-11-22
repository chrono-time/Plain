// client-env-loader.mjs
// Injects a scoped process.env with only client-safe values into source files under src/.
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const srcRoot = path.resolve(process.cwd(), 'src');
const validExts = new Set(['.js', '.jsx', '.ts', '.tsx']);

const pickClientEnv = () => {
  const allowed = new Set(['NODE_ENV', 'NODE_COMPILE']);
  const env = {};

  for (const key of Object.keys(process.env || {})) {
    if (key.startsWith('REACT_APP_') || key.startsWith('VITE_') || allowed.has(key)) {
      env[key] = process.env[key];
    }
  }

  return env;
};

// Snapshot client-safe env values once at startup.
const CLIENT_ENVS = pickClientEnv();

const envPrelude = `const __CLIENT_ENVS__ = ${JSON.stringify(CLIENT_ENVS)};const process = {env:__CLIENT_ENVS__};`;

const shouldInject = (url) => {
  if (!url.startsWith('file://')) return false;
  const filePath = fileURLToPath(url.split('?')[0]);
  return filePath.startsWith(srcRoot) && validExts.has(path.extname(filePath));
};

export async function resolve(specifier, context, nextResolve) {
  return nextResolve(specifier, context, nextResolve);
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context, nextLoad);

  if (!shouldInject(url)) return result;
  if (!result || result.format !== 'module' || result.source == null) return result;

  return {
    ...result,
    source: `${envPrelude}${result.source.toString()}`,
  };
}
