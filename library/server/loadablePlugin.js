import path from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';


function loadablePlugin (opts = {}) {
  const {
    mapFileName = 'static-paths.json',
    cleanupDir  = null
  } = opts;

  /* ─── vars we fill in later ─────────────────────────────── */
  let rootDir   = process.cwd();  // vite config might change this
  let cacheDir  = '.vite';        // defaults; overwritten by configResolved
  let mapJSON   = '{}';           // JSON we’ll write in closeBundle

  return {
    name : 'vite:static-map',
    apply: 'build',
     enforce: 'post',

    /* Grab final root + cacheDir so everything is dynamic */
    configResolved (config) {
      rootDir  = config.root;                // absolute
      cacheDir = config.cacheDir || '.vite'; // usually ".vite"
    },

    generateBundle (_, bundle) {
      const map = {};

   for (const [, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue;

        let id = chunk.facadeModuleId;

        /* ---------- NEW: match chunk.name to a module basename ---------- */
        if (!id) {
            const wanted = chunk.name;                // e.g. 'payRouter'
            const match  = Object.keys(chunk.modules)
            .find(m => path.basename(m, path.extname(m)) === wanted);

            if (match) id = match;                    // prefer exact match
        }

        /* ---------- old fallback (first project file) ------------------- */
        if (!id) {
            id = Object.keys(chunk.modules)
            .find(m => !m.includes('node_modules')) ||
            `virtual:${chunk.name}`;
        }

        // strip project root → "src/GOvendor/pay/payRouter.jsx"
        const rel = path.relative(rootDir, id).split(path.sep).join('/');

        map[rel] = chunk.fileName;
        }

      mapJSON = JSON.stringify(map, null, 2); // keep for later
    },

    /* Write JSON to .vite/ after the build is fully done */
    closeBundle () {
      /* 1.  ensure the cache dir exists */
      const destDir  = path.resolve(rootDir, 'dist', '.vite');
      console.log(rootDir, cacheDir, destDir);
      console.log(`vite:static-map → writing to ${destDir}`);
      mkdirSync(destDir, { recursive: true });

      /* 2.  write the file */
      const destFile = path.join(destDir, mapFileName);
      writeFileSync(destFile, mapJSON);
      this.info(`vite:static-map → wrote ${path.relative(rootDir, destFile)}`);

      /* 3.  optional post-build cleanup */
      if (cleanupDir) {
        const target = path.resolve(rootDir, cleanupDir);
        try {
          rmSync(target, { recursive: true, force: true });
          this.info(`vite:static-map → removed “${cleanupDir}”`);
        } catch (err) {
          this.warn(`vite:static-map → cleanup failed: ${err.message}`);
        }
      }
    }
  };
}

export default loadablePlugin;