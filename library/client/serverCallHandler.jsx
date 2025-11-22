/**
 * ---------------------------------------------------------------------------
 * SSR CLIENT UTILITIES — Documentation & Implementation
 * ---------------------------------------------------------------------------
 *
 * PURPOSE
 * -------
 * These utilities make it simple to:
 *  1) Manage <head> tags (title, meta, link, etc.) during SSR and client hydration.
 *  2) Fetch data on the server (for SSR) and seamlessly hydrate / revalidate on the client.
 *
 * ARCHITECTURE OVERVIEW
 * ---------------------
 * - On the SERVER:
 *   • <DataWrapper> calls an async SSR method via a manager provided by useSSRManager().
 *   • The SSR manager stores results in a server-side store and renders HTML that includes
 *     a bootstrap payload in `window.serverStore[id]` for each DataWrapper.
 *   • <Meta> records head tags into a MetaTagManager; later, `injectIntoHtml(html)` merges
 *     those into your HTML string before sending the response.
 *
 * - On the CLIENT:
 *   • On first paint, <DataWrapper> checks `window.serverStore[id]`:
 *       - If present and flagged as "initial_data", it renders with those cached results
 *         via <StaticDataWrapper> (no network).
 *       - Otherwise it uses SWR (<SyncDataWrapper>) to POST to /ssr (or REACT_APP_SSR_SERVER/ssr)
 *         and fetch fresh data. `credentials: 'include'` is used for session-aware calls.
 *   • <Meta> updates document.head with tags marked data-meta="true".
 *
 * KEY CONTRACTS
 * -------------
 * - useSSRManager():
 *   Must be wired by your SSR runtime and is expected to return an object with:
 *      • ssrMethod(id: string, method: string, data: any): Promise<any>
 *        - Called during server rendering to obtain data for a unique id+method+payload.
 *        - Should store results in a server-side data store so you can serialize them
 *          into the HTML for hydration (window.serverStore).
 *      • setDataInStore(id: string, value: any): any
 *        - Optional helper to write default/fallback data into the SSR store.
 *
 * - window.serverStore (CLIENT GLOBAL):
 *   A simple cache for hydrating client-side:
 *     window.serverStore[id] = {
 *       data: any,
 *       initial_data: true | false,  // true on first client render after SSR; reset to false on cleanup
 *       timestamp: number,
 *       isDefault?: true             // set when defaultData was used due to an error
 *     }
 *
 * ID STABILITY
 * ------------
 * - The `id` prop (string) uniquely identifies each data "slot".
 * - It MUST be stable across server and client for the same view; include route params,
 *   query strings, or other keys that affect what is fetched.
 * - Changing `id` triggers a new fetch on the client.
 *
 * EXAMPLES
 * --------
 * Server setup (conceptual):
 *   <SSRManagerProvider value={managerCreatedPerRequest}>
 *     <MetaTagProvider manager={new MetaTagManager()}>
 *       <App />
 *     </MetaTagProvider>
 *   </SSRManagerProvider>
 *
 * Using DataWrapper:
 *   <DataWrapper
 *     id="user.profile:42"
 *     method="getUserProfile"
 *     data={{ userId: 42 }}
 *     defaultData={{ name: 'Guest' }}
 *     loadingFallback={<Spinner />}
 *   >
 *     {(profile) => <ProfileView profile={profile} />}
 *   </DataWrapper>
 *
 * Managing <head> tags:
 *   <Meta>
 *     <title>Product List</title>
 *     <meta name="description" content="Browse popular products" />
 *     <link rel="canonical" href="https://example.com/products" />
 *   </Meta>
 *
 * On the server, before sending HTML:
 *   const headManager = ... // the MetaTagManager instance you passed to <MetaTagProvider>
 *   const finalHtml = headManager.injectIntoHtml(renderedHtmlString)
 *
 * NOTES & EDGE CASES
 * ------------------
 * - Suspense: <SyncDataWrapper> uses SWR with `suspense: true`. <DataWrapper> already wraps
 *   it in a <Suspense> boundary; you do not need to add another one for these calls.
 * - Errors: If a network error occurs client-side and `defaultData` is provided, the default
 *   is used and flagged with `isDefault: true`.
 * - Credentials: Client fetches include credentials for session-aware SSR endpoints.
 * - Title updates: <Meta> will set document.title on the client. On the server it replaces
 *   <title> in the HTML string when `injectIntoHtml()` is called.
 * - Cleaning hydration flag: On unmount, <DataWrapper> sets `initial_data = false` so
 *   subsequent mounts know to revalidate/fetch.
 */

import React, { Suspense, useState, useEffect, useId, memo, createContext, useContext, useMemo, use } from 'react';
import { useSSRManager } from '../server/ssrContext.jsx';
import useSWR from 'swr'

/**
 * ----------------------------------------------------------------------------
 * MetaTagManager — manages <head> content across SSR and client
 * ----------------------------------------------------------------------------
 *
 * RESPONSIBILITIES
 * - Collects <title>, <meta>, <link>, and other head tags on the server.
 * - Injects these into the HTML string before sending to the client.
 * - On the client, updates document.head by replacing tags with data-meta="true".
 *
 * USAGE
 * - Provide a MetaTagManager instance to <MetaTagProvider>.
 * - Use the <Meta> component where you want to define head content.
 * - On the server, call `injectIntoHtml(html)` with your rendered HTML string.
 */
class MetaTagManager {
  constructor() {
    /** @private @type {string[]} */
    this.metaTags = [];
    /** @private @type {string|null} */
    this.title = null;
  }

  /** Clear all stored head metadata (title + meta tags). */
  clearAll() {
    this.metaTags = [];
    this.title = null;
  }

  /**
   * Set the <title> for the page.
   * @param {string} titleContent
   */
  setTitle(titleContent) {
    this.title = `<title>${titleContent}</title>`;

    // Update document title on client side
    if (typeof document !== 'undefined') {
      document.title = titleContent;
    }
  }

  /**
   * Add a pre-rendered tag string (e.g., `<meta ...>` or `<link ...>...</link>`).
   * The tag must include data-meta="true" for proper client-side replacement.
   * @param {string} tagString
   */
  addMetaTag(tagString) {
    this.metaTags.push(tagString);

    // Update DOM on client side
    if (typeof document !== 'undefined') {
      this._updateClientMetaTags();
    }
  }

  /** @returns {string} The concatenated HTML for all tracked meta/link tags. */
  getAllMetaTags() {
    return this.metaTags.join('\n');
  }

  /** @returns {string} Title + all meta/link tags. */
  getFullHead() {
    return [this.title, ...this.metaTags].join('\n');
  }

  /**
   * Inject collected head content into an HTML string.
   * - Replaces existing <title>...</title> if set.
   * - Removes any existing tags in <head> with data-meta="true".
   * - Appends new meta/link tags before </head>.
   *
   * @param {string} html
   * @returns {string} Updated HTML
   */
  injectIntoHtml(html) {
    // Replace existing title tag
    if (this.title && html.includes('<title>')) {
      html = html.replace(/<title>.*?<\/title>/, this.title);
    } else if (this.title) {
      // Add title if it doesn't exist
      html = html.replace(/<head>/, `<head>\n  ${this.title}`);
    }

    // Replace existing meta tags with data-meta attribute
    const metaRegex = /<meta[^>]*data-meta[^>]*>/g;
    const existingMetaTags = html.match(metaRegex) || [];

    if (existingMetaTags.length > 0) {
      // Remove existing meta tags with data-meta attribute
      existingMetaTags.forEach(tag => {
        html = html.replace(tag, '');
      });
    }

    // Insert new meta tags before </head>
    if (this.metaTags.length > 0) {
      html = html.replace('</head>', `  ${this.getAllMetaTags()}\n</head>`);
    }

    return html;
  }

  /**
   * Update document.head on the client:
   * - Remove all elements with data-meta="true".
   * - Append the current set of tracked tags.
   * @private
   */
  _updateClientMetaTags() {
    if (typeof document === 'undefined') return;

    // Remove existing meta tags with data-meta attribute
    document.querySelectorAll('[data-meta="true"]').forEach(el => {
      el.parentNode.removeChild(el);
    });

    // Create a temporary container
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = this.getAllMetaTags();

    // Append new meta tags to head
    Array.from(tempContainer.children).forEach(node => {
      document.head.appendChild(node);
    });
  }
}

/** A singleton default manager for client-side use (optional). */
const defaultManager = typeof window !== 'undefined' ? new MetaTagManager() : null;

/** @type {React.Context<MetaTagManager|null>} */
const MetaTagContext = createContext(null);

/**
 * MetaTagProvider
 * ---------------
 * Provides a MetaTagManager instance via context.
 *
 * @param {object} props
 * @param {MetaTagManager | null} [props.manager]
 *   - On the SERVER, pass a new MetaTagManager instance per request.
 *   - On the CLIENT, you may omit this and the defaultManager will be used.
 * @param {React.ReactNode} props.children
 */
export function MetaTagProvider({ manager = defaultManager, children }) {
  // Create a new manager instance if not provided and we're on client side
  const metaManager = manager || (typeof window !== 'undefined' ? new MetaTagManager() : null);

  return (
    <MetaTagContext.Provider value={metaManager}>
      {children}
    </MetaTagContext.Provider>
  );
}

/**
 * useMetaTags
 * -----------
 * Access the MetaTagManager from context.
 * @returns {MetaTagManager}
 */
export function useMetaTags() {
  const manager = useContext(MetaTagContext);
  if (!manager) {
    throw new Error("useMetaTags must be used within a MetaTagProvider");
  }
  return manager;
}

/**
 * Meta
 * ----
 * Declarative head management. Place this inside pages/layouts to set
 * <title>, <meta>, <link>, or other head elements.
 *
 * IMPORTANT:
 * - Any added tag is annotated with data-meta="true" so client-side updates
 *   can safely replace previously inserted tags.
 * - For <meta> tags, children are ignored (self-closing).
 *
 * @example
 *   <Meta>
 *     <title>Home</title>
 *     <meta name="description" content="Welcome" />
 *     <link rel="canonical" href="https://example.com/" />
 *   </Meta>
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 */
export function Meta({ children }) {
  const manager = useMetaTags();

  // Memoize metadata extraction based on children
  React.useMemo(() => {
    const tags = [];
    manager.clearAll();
    React.Children.forEach(children, child => {
      if (typeof child === 'string') return;

      const type = child.type?.toLowerCase?.();
      if (type === 'title') {
        manager.setTitle(child.props.children);
      } else if (type === 'meta') {
        const props = { ...child.props, 'data-meta': 'true' };
        const attributes = Object.entries(props)
          .map(([key, value]) => `${key}="${value}"`)
          .join(" ");
        tags.push(`<meta ${attributes}>`);
      } else {
        // Handle other head elements (link, base, etc.)
        const elementType = type || child.type;
        const props = { ...child.props, 'data-meta': 'true' };
        const attributes = Object.entries(props)
          .filter(([key]) => key !== 'children')
          .map(([key, value]) => `${key}="${value}"`)
          .join(" ");
        const content = child.props.children || '';
        tags.push(`<${elementType} ${attributes}>${content}</${elementType}>`);
      }
    });
    tags.forEach(tag => manager.addMetaTag(tag));
  }, [children, manager]);

  return null;
}

export { MetaTagManager };

/**
 * ClientOnly
 * ----------
 * Renders children only after the component mounts on the client.
 * Useful for code that requires browser APIs (window, document) or is not SSR-safe.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.fallback=null] - Rendered until mounted.
 */
export function ClientOnly({ children, fallback = null }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return fallback;
  }
  return <>{children}</>;
}

/**
 * AsyncDataWrapper (SERVER-ONLY)
 * ------------------------------
 * Async function component used during SSR to fetch data via ssrManager.
 *
 * BEHAVIOR:
 * - Calls `ssrManager.ssrMethod(id, method, data)` to fetch and persist server data.
 * - If it fails and `defaultData` is provided, writes that via `setDataInStore` (if available).
 * - Returns `children(fetched)` if children is a function; otherwise returns `children`.
 *
 * NOTE:
 * - This component performs work only on the SERVER. On the client, DataWrapper chooses
 *   between <StaticDataWrapper> or <SyncDataWrapper>.
 *
 * @param {object} props
 * @param {string} props.id - Stable unique key for this data slot.
 * @param {string} props.method - SSR method name to invoke server-side.
 * @param {any} [props.data={}] - Payload object passed to the SSR method.
 * @param {any} [props.defaultData=null] - Used when SSR call fails.
 * @param {Function|React.ReactNode} props.children - Render function or node.
 * @param {React.ReactNode} [props.fallback=null]
 * @param {(err:unknown)=>void} [props.onError]
 */
const AsyncDataWrapper = async ({
  id: providedId,
  method,
  data = {},
  defaultData = null,
  children,
  fallback = null,
  onError = (error) => console.error("AsyncDataWrapper error:", error)
}) => {
  // Generate a stable ID if not provided
  const id = providedId

  if (typeof window != 'undefined') {
    if (!window.ssrComponents) {
      window.ssrComponents = {}
    }
  }

  // Get the SSR manager
  const ssrManager = useSSRManager();

  // Function to fetch data (SERVER path only)
  async function fetchData() {
    // Server-side rendering path
    if (typeof window === 'undefined') {
      if (ssrManager) {
        try {
          // Server SSR call; the manager handles store setting internally.
          return await ssrManager.ssrMethod(id, method, data);
        } catch (error) {
          console.error(`Server data fetch error for method '${method}':`, error);
          if (defaultData !== null) {
            // Store the default data if fetch fails
            return ssrManager.setDataInStore(id, defaultData);
          }
          throw error;
        }
      }

      // Fallback when SSR manager is not available
      console.warn('SSR manager not available, using default data if provided');
      return defaultData;
    }
  }

  try {
    const responseData = await fetchData();
    return typeof children === 'function' ? children(responseData) : children;
  } catch (error) {
    onError(error);
    return fallback || <div>Error loading data</div>;
  }
}

/**
 * fetcher (CLIENT-ONLY)
 * ---------------------
 * SWR-compatible fetcher that posts to the SSR endpoint for client revalidation.
 *
 * PROTOCOL:
 * POST {url} with body:
 *   {
 *     id: string,
 *     method: string,
 *     data: any,
 *     defaultData?: any
 *   }
 *
 * CLIENT CACHE:
 * - If window.serverStore[id]?.initial_data === true, returns cached data.
 * - On successful network response, writes to window.serverStore[id].
 * - On error, if defaultData is provided, stores it with isDefault: true.
 *
 * SECURITY:
 * - Uses `credentials: 'include'` to preserve cookies/sessions.
 *
 * @param {{url: string, payload: {id: string, method: string, data: any, defaultData?: any}}} param0
 * @returns {Promise<any>}
 */
const fetcher = async ({ url, payload }) => {
  const { id, method, data, defaultData } = payload;

  // Initialize our store if it doesn't exist
  if (!window.serverStore) {
    window.serverStore = {};
  }

  // Use SSR hydration data on first client render
  if (window.serverStore[id] && window.serverStore[id]?.initial_data === true) {
    // Mark-as-used semantics: initial_data remains true until <DataWrapper> unmount cleanup.
    return window.serverStore[id].data;
  }

  if (window.serverStore[id] && window.serverStore[id]?.isDefault) {
    return window.serverStore[id].data;
  }

  try {
    // Determine SSR endpoint
    const ssrEndpoint = process.env.REACT_APP_SSR_SERVER != null
      ? process.env.REACT_APP_SSR_SERVER + '/ssr'
      : window.location.origin + '/ssr';

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const result = await response.json();

    // Store for future reference
    window.serverStore[id] = {
      data: result,
      initial_data: true,
      timestamp: Date.now()
    };

    return result;
  } catch (error) {
    console.error('Client fetch error:', error);
    if (defaultData !== null) {
      // Use default data on failure
      window.serverStore[id] = {
        data: defaultData,
        initial_data: true,
        timestamp: Date.now(),
        isDefault: true // Mark as default data
      };
      return defaultData;
    }
    throw error;
  }
}

/**
 * SyncDataWrapper (CLIENT-ONLY)
 * -----------------------------
 * Uses SWR + Suspense to request data from the SSR endpoint.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.method
 * @param {any} [props.data]
 * @param {any} [props.defaultData]
 * @param {Function|React.ReactNode} props.children
 * @param {React.ReactNode} [props.fallback]
 * @param {(err:unknown)=>void} [props.onError]
 */
const SyncDataWrapper = memo(({
  id,
  method,
  data = {},
  defaultData = null,
  children,
  fallback = null,
  onError = (error) => console.error("SyncDataWrapper error:", error)
}) => {
  const ssrEndpoint = process.env.REACT_APP_SSR_SERVER
    ? `${process.env.REACT_APP_SSR_SERVER}/ssr`
    : `${window.location.origin}/ssr`;

  const { data: fetchedData, error } = useSWR(
    { url: ssrEndpoint, payload: { id, method, data, defaultData } },
    fetcher,
    { suspense: true }
  );

  if (error) return <div>Error: {error.message}</div>;

  return typeof children === 'function' ? children(fetchedData) : children;
})

/**
 * StaticDataWrapper (CLIENT-ONLY)
 * -------------------------------
 * Reads previously hydrated data from window.serverStore without refetching.
 * Used for the very first client render after SSR when `initial_data === true`.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.method
 * @param {any} [props.data]
 * @param {any} [props.defaultData]
 * @param {Function|React.ReactNode} props.children
 * @param {React.ReactNode} [props.fallback]
 * @param {(err:unknown)=>void} [props.onError]
 */
const StaticDataWrapper = memo(({
  id: providedId,
  method,
  data = {},
  defaultData = null,
  children,
  fallback = null,
  onError = (error) => console.error("SyncDataWrapper error:", error)
}) => {
  const id = providedId

  try {
    // Client-side check for existing data
    if (typeof window !== 'undefined' && window.serverStore && window.serverStore[id]) {
      const responseData = window.serverStore[id].data;
      return typeof children === 'function' ? children(responseData) : children;
    }
  } catch (error) {
    onError(error);
    return fallback || <div>Error loading data</div>;
  }
})

/**
 * DataWrapper (UNIFIED ENTRYPOINT)
 * --------------------------------
 * Chooses the appropriate data strategy depending on environment and cache state:
 *   - SERVER: <AsyncDataWrapper> (awaits SSR method via manager)
 *   - CLIENT (first render w/ hydration data): <StaticDataWrapper>
 *   - CLIENT (no hydration data): <SyncDataWrapper> (SWR + Suspense + POST /ssr)
 *
 * PROPS
 * -----
 * @param {object} props
 * @param {string} props.id
 *   Stable, unique key for this data slot (MUST match between server render and client).
 * @param {string} props.method
 *   Name of the SSR method to call on the server (interpreted by your manager/endpoint).
 * @param {any} [props.data={}]
 *   Payload sent to SSR method (should be serializable).
 * @param {any} [props.defaultData=null]
 *   Optional default data used when SSR/client fetch fails.
 * @param {Function|React.ReactNode} props.children
 *   Render function or node. If a function is provided, receives (fetchedData).
 * @param {React.ReactNode} [props.loadingFallback]
 *   Fallback element while suspense is pending (client and server).
 * @param {(err:unknown)=>void} [props.onError]
 *
 * LIFECYCLE NOTES
 * ---------------
 * - On cleanup (unmount), this sets `window.serverStore[id].initial_data = false`
 *   so future mounts on the same page instance do not treat it as fresh hydration.
 */
export const DataWrapper = memo((props) => {

  useEffect(() => {

    return (
      () => {
        // Cleanup function to reset the server store for this component
        if (typeof window !== 'undefined' && window.serverStore && window.serverStore[props.id]) {
          window.serverStore[props.id].initial_data = false;
        }
      }
    )
  }, [])

  return (
    <>
      {typeof window == 'undefined' ?
        (
          <React.Suspense fallback={props.loadingFallback || <></>}>
            <AsyncDataWrapper {...props} />
          </React.Suspense>
        )
        :

        (window?.serverStore?.[props.id] != undefined && window?.serverStore?.[props.id]?.initial_data == true) ?
          <StaticDataWrapper {...props} />
          :
          <Suspense fallback={props.loadingFallback || <></>}>
            <SyncDataWrapper {...props} />
          </Suspense>

      }

    </>

  );
})

/**
 * ---------------------------------------------------------------------------
 * QUICK TROUBLESHOOTING
 * ---------------------------------------------------------------------------
 * - Nothing renders on the client?
 *   Ensure `id` is stable and identical between server and client. If `id` changes,
 *   hydration won't use cached data and the client will fetch.
 *
 * - Head tags not showing?
 *   Make sure:
 *     • You're wrapping your tree in <MetaTagProvider>.
 *     • You call headManager.injectIntoHtml(html) on the SERVER before sending the response.
 *     • You include data-meta="true" (done automatically by <Meta>).
 *
 * - Double fetch on client?
 *   This can happen if the component unmounts/remounts quickly or the `id` changes.
 *
 * - Using a remote SSR server?
 *   Set REACT_APP_SSR_SERVER to your SSR host; otherwise `window.location.origin + '/ssr'` is used.
 *
 * - Need to avoid Suspense?
 *   This module uses Suspense deliberately for SWR. Use <StaticDataWrapper> or bespoke hooks
 *   if you require a non-Suspense approach.
 */
