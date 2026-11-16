import { setFetchConnectTimeoutMs } from "@/shared/constants/fetchConnectTimeout.js";

/**
 * Apply the saved upstream connect timeout to the running process.
 *
 * The Endpoint page knob is stored in the settings DB; this copies it into the
 * in-process store that the open-sse executors read at request time, so a save
 * takes effect on the next request without a restart.
 *
 * A missing or non-number value is a no-op, so reading settings that do not
 * mention the knob never clears the value already in effect.
 */
export function applyFetchTimeoutSetting(settings) {
  setFetchConnectTimeoutMs(settings?.fetchConnectTimeoutMs);
}
