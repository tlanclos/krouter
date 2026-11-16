import {
  FETCH_CONNECT_TIMEOUT_MIN_MS,
  FETCH_CONNECT_TIMEOUT_MAX_MS,
} from "open-sse/config/runtimeConfig.js";

/**
 * Set the upstream connect timeout for every provider request.
 *
 * Writes the saved settings.fetchConnectTimeoutMs (the Endpoint page knob) into
 * process.env.FETCH_CONNECT_TIMEOUT_MS, which is where open-sse executors read
 * the timeout from at request time. Env is the only channel guaranteed shared
 * across every Next.js route bundle in the process (same reason
 * applyOutboundProxyEnv writes env instead of mutating a module), so the value
 * applies to the next request without a restart.
 *
 * The value is clamped into the supported range because it can also arrive from
 * an imported or hand-edited settings row. A missing or non-number key is a
 * no-op, so a hand-set FETCH_CONNECT_TIMEOUT_MS in .env survives until the
 * dashboard knob is explicitly saved.
 */
export function applyFetchTimeoutEnv(settings) {
  if (typeof process === "undefined" || !process.env) return;
  const raw = settings?.fetchConnectTimeoutMs;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return;
  const clamped = Math.min(
    Math.max(Math.round(raw), FETCH_CONNECT_TIMEOUT_MIN_MS),
    FETCH_CONNECT_TIMEOUT_MAX_MS,
  );
  process.env.FETCH_CONNECT_TIMEOUT_MS = String(clamped);
}
