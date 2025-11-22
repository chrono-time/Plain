// ignore-css-loader.mjs
export async function resolve(specifier, context, defaultResolve) {
  if (specifier.endsWith('.css')) {
    // Return a synthetic module URL using a data: URL.
    // Note: For resolve hooks, you typically don’t need shortCircuit here
    // if you’re returning a simple URL. However, check Node's docs if you run into issues.
    return { url: 'data:text/javascript,' };
  }
  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.startsWith('data:text/javascript,')) {
    return {
      format: 'module',
      source: '',
      shortCircuit: true  // Explicitly short-circuit the loader chain.
    };
  }
  return defaultLoad(url, context, defaultLoad);
}
