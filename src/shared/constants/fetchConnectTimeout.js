// Upstream connect timeout: the global default for providers that do not set
// their own timeoutMs.
//
// The value lives in the settings DB (settings.fetchConnectTimeoutMs, the
// Endpoint page knob) and is mirrored into this in-process store whenever it
// changes, so the open-sse executors can read it synchronously at request
// time without a DB read on every provider call.
//
// The store hangs off globalThis because Next.js loads each route bundle with
// its own module registry: a plain module-level variable would be per-bundle
// and the settings route's copy would not be visible to the chat route's
// executors. globalThis is shared by every bundle in the process, which is the
// same trick open-sse/services/routingLog.js uses for its ring buffer.

/** Default connect timeout in milliseconds. */
export const FETCH_CONNECT_TIMEOUT_DEFAULT_MS = 60 * 1000;

/** Smallest connect timeout the knob accepts, in milliseconds. */
export const FETCH_CONNECT_TIMEOUT_MIN_MS = 10 * 1000;

/** Largest connect timeout the knob accepts, in milliseconds. */
export const FETCH_CONNECT_TIMEOUT_MAX_MS = 600 * 1000;

const store = (globalThis.__krouterFetchConnectTimeout ??= {
  timeoutMs: FETCH_CONNECT_TIMEOUT_DEFAULT_MS,
});

/**
 * Clamp a connect timeout into the supported range.
 */
export function clampFetchConnectTimeoutMs(ms) {
  return Math.min(Math.max(ms, FETCH_CONNECT_TIMEOUT_MIN_MS), FETCH_CONNECT_TIMEOUT_MAX_MS);
}

/**
 * The connect timeout to use for the next provider request, in milliseconds.
 * Falls back to the default until a saved setting is applied.
 */
export function getFetchConnectTimeoutMs() {
  return store.timeoutMs;
}

/**
 * Apply a saved connect timeout. A missing or non-number value is a no-op, so
 * an existing value is never cleared by a settings read that does not mention
 * the knob.
 */
export function setFetchConnectTimeoutMs(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return;
  store.timeoutMs = clampFetchConnectTimeoutMs(ms);
}
