import { register } from 'node:module';
register('./noop-css.mjs', import.meta.url);
register('./auto-react-import-loader.mjs', import.meta.url);
register('./client-env-loader.mjs', import.meta.url);
register('./svg-loader.mjs', import.meta.url);
register('./asset.mjs', import.meta.url);
