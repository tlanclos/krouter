// Upstream connect timeout: the global default for providers that do not set
// their own timeoutMs.
//
// The value is a dashboard setting (settings.fetchConnectTimeoutMs). Like every
// other setting it travels the same route: the UI PATCHes /api/settings, the
// route validates and stores it in the settings DB, and each request reads it
// with getSettings() and passes it down to the provider call. This module holds
// only the default and the accepted range, plus the resolver the executors
// use.

/** Default connect timeout in milliseconds. */
export const FETCH_CONNECT_TIMEOUT_DEFAULT_MS = 60 * 1000;

/** Smallest connect timeout the knob accepts, in milliseconds. */
export const FETCH_CONNECT_TIMEOUT_MIN_MS = 10 * 1000;

/** Largest connect timeout the knob accepts, in milliseconds. */
export const FETCH_CONNECT_TIMEOUT_MAX_MS = 600 * 1000;

/**
 * Clamp a connect timeout into the supported range.
 */
export function clampFetchConnectTimeoutMs(ms) {
  return Math.min(Math.max(ms, FETCH_CONNECT_TIMEOUT_MIN_MS), FETCH_CONNECT_TIMEOUT_MAX_MS);
}

/**
 * The connect timeout to use for a provider request, in milliseconds.
 *
 * `savedMs` is settings.fetchConnectTimeoutMs as read for this request. A
 * missing or unusable value falls back to the default, so a request that
 * predates the setting (or an imported settings row without it) still works.
 * A provider that sets its own timeoutMs overrides this at the call site.
 */
export function resolveFetchConnectTimeoutMs(savedMs) {
  if (typeof savedMs !== "number" || !Number.isFinite(savedMs)) {
    return FETCH_CONNECT_TIMEOUT_DEFAULT_MS;
  }
  return clampFetchConnectTimeoutMs(savedMs);
}
