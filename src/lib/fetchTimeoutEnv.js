import {
  FETCH_CONNECT_TIMEOUT_MIN_MS,
  FETCH_CONNECT_TIMEOUT_MAX_MS,
} from "open-sse/config/runtimeConfig.js";

/**
 * Mirror settings.fetchConnectTimeoutMs into process.env.FETCH_CONNECT_TIMEOUT_MS.
 *
 * The knob lives in the settings DB (Endpoint page), but open-sse executors read
 * it synchronously at request time — env is the only channel guaranteed shared
 * across every Next.js route bundle in the process (same reason
 * applyOutboundProxyEnv writes env instead of mutating a module). Defensive
 * clamp: the value can also arrive from an imported or hand-edited settings row.
 * A missing or non-number key is a no-op, so a hand-set FETCH_CONNECT_TIMEOUT_MS
 * in .env survives until the dashboard knob is explicitly saved.
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
