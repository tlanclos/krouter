// Bounds for the upstream connect timeout, shared by the server (open-sse
// executors and the settings API) and the dashboard client.
//
// These live here rather than in open-sse/config/runtimeConfig.js because that
// module reads process.env at module scope, which would drag server-only code
// into the browser bundle. open-sse/config/runtimeConfig.js re-exports these
// so there is still exactly one definition of each value.

/** Default connect timeout in milliseconds. */
export const FETCH_CONNECT_TIMEOUT_DEFAULT_MS = 60 * 1000;

/** Smallest connect timeout the knob accepts, in milliseconds. */
export const FETCH_CONNECT_TIMEOUT_MIN_MS = 10 * 1000;

/** Largest connect timeout the knob accepts, in milliseconds. */
export const FETCH_CONNECT_TIMEOUT_MAX_MS = 600 * 1000;
